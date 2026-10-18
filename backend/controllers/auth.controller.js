import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { getAuth } from 'firebase-admin/auth'
import crypto from 'node:crypto'
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { env } from '../config/env.js'
import cloudinary from '../lib/cloudinary.js'
import admin from '../lib/firebaseAdmin.js'
import {
	sendAccountVerificationEmail,
	sendPasswordAddedEmail,
	sendProviderLinkedEmail,
	sendPasswordResetEmail,
} from '../lib/mailer.js'
import { hashPassword } from '../lib/password.js'
import { publicUserFields } from '../lib/userProjection.js'
import { emitUserEvent } from '../lib/realtime.js'
import { describeUserAgent, endOtherSessions, endSession, listSessions, renewSession, startSession } from '../lib/sessions.js'
import { clearAuthCookie } from '../lib/utils.js'
import Session from '../models/session.model.js'
import PasskeyChallenge from '../models/passkeyChallenge.model.js'
import PasswordResetToken from '../models/passwordResetToken.model.js'
import User from '../models/user.model.js'

const getPasskeyRp = () => {
	const frontendUrl = new URL(env.frontendUrl)
	return {
		rpID: frontendUrl.hostname,
		expectedOrigin: frontendUrl.origin,
	}
}

const REAUTH_WINDOW_MS = 5 * 60 * 1000
const hasRecentReauthentication = (user) =>
	Boolean(user.lastReauthenticatedAt) && Date.now() - user.lastReauthenticatedAt.getTime() <= REAUTH_WINDOW_MS

// Well-known authenticators by AAGUID, so a passkey says where it lives.
const PASSKEY_PROVIDERS = {
	'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
	'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain',
	'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
	'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
	'08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
	'9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
	'6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
	'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
	'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
	'531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
	'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
	'0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keeper',
	'53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
	'771b48fd-d3d4-4f74-9232-fc157ab0507a': 'Edge on Mac',
	'891494da-2c90-4d31-a9cd-4eab0aed1309': 'Sésame',
	'f3809540-7f14-49c1-a8b3-8f813b225541': 'Enpass',
	'b5397666-4885-aa6b-cebf-e52262a439a2': 'Chromium Browser',
}

const passkeyProviderName = (aaguid, transports = []) => {
	if (aaguid && PASSKEY_PROVIDERS[aaguid]) return PASSKEY_PROVIDERS[aaguid]
	if (transports.some((transport) => ['usb', 'nfc', 'ble'].includes(transport))) return 'Security key'
	return ''
}

// "Chrome on macOS" when nothing better is known.
const defaultPasskeyName = (req) => {
	const { browser, os } = describeUserAgent(req.get('user-agent') || '')
	return [browser, os].filter(Boolean).join(' · ') || 'Passkey'
}

export const createPasskeyRegistrationOptions = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('email name passkeys password lastReauthenticatedAt')
		if (!user) return res.status(404).json({ message: 'User not found' })
		// A passkey outlives password changes, so a stolen session alone must not be able to add one.
		if (user.password && !hasRecentReauthentication(user)) {
			return res.status(401).json({ message: 'Confirm your password to add a passkey.', code: 'reauth_required' })
		}
		const { rpID } = getPasskeyRp()
		const options = await generateRegistrationOptions({
			rpName: 'KanbanHub',
			rpID,
			userID: Buffer.from(String(user._id)),
			userName: user.email,
			userDisplayName: user.name || user.email,
			attestationType: 'none',
			excludeCredentials: user.passkeys.map((passkey) => ({
				id: passkey.credentialID,
				transports: passkey.transports,
			})),
			authenticatorSelection: {
				residentKey: 'preferred',
				userVerification: 'required',
			},
		})
		user.passkeyRegistrationChallenge = options.challenge
		user.passkeyRegistrationChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000)
		await user.save()
		return res.json(options)
	} catch (error) {
		console.error('Passkey options error:', error)
		return res.status(500).json({ message: 'Could not start passkey setup' })
	}
}

export const verifyPasskeyRegistration = async (req, res) => {
	try {
		const user = await User.findById(req.user._id)
		if (!user) return res.status(404).json({ message: 'User not found' })
		if (!user.passkeyRegistrationChallenge || !user.passkeyRegistrationChallengeExpiresAt || user.passkeyRegistrationChallengeExpiresAt < new Date()) {
			return res.status(400).json({ message: 'Passkey setup session expired' })
		}
		const { rpID, expectedOrigin } = getPasskeyRp()
		const { passkeyName, ...attestation } = req.body
		const verification = await verifyRegistrationResponse({
			response: attestation,
			expectedChallenge: user.passkeyRegistrationChallenge,
			expectedOrigin,
			expectedRPID: rpID,
			requireUserVerification: true,
		})
		if (!verification.verified || !verification.registrationInfo) {
			return res.status(400).json({ message: 'Passkey could not be verified' })
		}
		const { credential, aaguid } = verification.registrationInfo
		const credentialId = credential.id
		const alreadyRegistered = user.passkeys.some((passkey) => passkey.credentialID === credentialId)
		if (!alreadyRegistered) {
			const provider = passkeyProviderName(aaguid, credential.transports)
			user.passkeys.push({
				credentialID: credentialId,
				publicKey: Buffer.from(credential.publicKey),
				counter: credential.counter,
				transports: credential.transports || [],
				name: passkeyName || provider || defaultPasskeyName(req),
				provider,
				createdAt: new Date(),
			})
		}
		user.passkeyRegistrationChallenge = ''
		user.passkeyRegistrationChallengeExpiresAt = null
		await user.save()
		return res.json({ message: 'Passkey added successfully' })
	} catch (error) {
		console.error('Passkey verification error:', error)
		return res.status(400).json({ message: 'Passkey could not be verified' })
	}
}

export const removePasskey = async (req, res) => {
	try {
		const credentialId = String(req.params.credentialId || '')
		if (!/^[A-Za-z0-9_-]+$/.test(credentialId)) {
			return res.status(400).json({ message: 'Invalid passkey ID' })
		}
		const user = await User.findById(req.user._id)
		if (!user) return res.status(404).json({ message: 'User not found' })
		if (user.password) await assertCurrentPassword(user, req.body?.currentPassword)
		const initialCount = user.passkeys.length
		user.passkeys = user.passkeys.filter((passkey) => passkey.credentialID !== credentialId)
		if (user.passkeys.length === initialCount) {
			return res.status(404).json({ message: 'Passkey not found' })
		}
		await user.save()
		return res.json({ message: 'Passkey removed successfully' })
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: 'Current password is incorrect' })
		console.error('Passkey removal error:', error)
		return res.status(500).json({ message: 'Could not remove passkey' })
	}
}

export const renamePasskey = async (req, res) => {
	try {
		const credentialId = req.params.credentialId
		const result = await User.updateOne(
			{ _id: req.user._id, 'passkeys.credentialID': credentialId },
			{ $set: { 'passkeys.$.name': req.body.name } },
		)
		if (!result.matchedCount) return res.status(404).json({ message: 'Passkey not found' })
		return res.status(204).send()
	} catch (error) {
		console.error('Passkey rename error:', error)
		return res.status(500).json({ message: 'Could not rename passkey' })
	}
}

export const createPasskeyAuthenticationOptions = async (req, res) => {
	try {
		const { rpID } = getPasskeyRp()
		const options = await generateAuthenticationOptions({
			rpID,
			userVerification: 'required',
		})
		await PasskeyChallenge.create({
			challenge: options.challenge,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
		})
		return res.json(options)
	} catch (error) {
		console.error('Passkey authentication options error:', error)
		return res.status(500).json({ message: 'Could not start passkey sign-in' })
	}
}

const readClientChallenge = (clientDataJSON) => {
	try {
		const clientData = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'))
		return typeof clientData.challenge === 'string' ? clientData.challenge : ''
	} catch {
		return ''
	}
}

export const authenticateWithPasskey = async (req, res) => {
	try {
		const credentialId = req.body.id
		const challenge = readClientChallenge(req.body.response.clientDataJSON)
		// Claim the challenge before verifying so an assertion can never be replayed.
		const claimedChallenge = challenge
			? await PasskeyChallenge.findOneAndDelete({ challenge, expiresAt: { $gt: new Date() } })
			: null
		if (!claimedChallenge) {
			return res.status(400).json({ message: 'Passkey sign-in session expired' })
		}
		const user = await User.findOne({ 'passkeys.credentialID': credentialId })
		if (!user) return res.status(400).json({ message: 'Passkey is not valid' })
		const storedCredential = user.passkeys.find((passkey) => passkey.credentialID === credentialId)
		const { rpID, expectedOrigin } = getPasskeyRp()
		const verification = await verifyAuthenticationResponse({
			response: req.body,
			expectedChallenge: claimedChallenge.challenge,
			expectedOrigin,
			expectedRPID: rpID,
			credential: {
				id: storedCredential.credentialID,
				publicKey: storedCredential.publicKey,
				counter: storedCredential.counter,
				transports: storedCredential.transports,
			},
			requireUserVerification: true,
		})
		if (!verification.verified) return res.status(400).json({ message: 'Passkey is not valid' })
		storedCredential.counter = verification.authenticationInfo.newCounter
		storedCredential.lastUsedAt = new Date()
		await user.save()
		await startSession(req, res, user, 'passkey')
		return res.json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			provider: user.provider,
			profileSetup: user.profileSetup,
			emailVerified: user.emailVerified,
			requiresVerification: !user.emailVerified,
		})
	} catch (error) {
		console.error('Passkey authentication error:', error)
		return res.status(400).json({ message: 'Could not sign in with passkey' })
	}
}

export const assertProviderEmailVerified = (decodedToken) => {
	if (decodedToken.email_verified !== true) {
		const error = new Error(
			'Provider email must be verified before continuing.',
		)
		error.statusCode = 403
		throw error
	}
}

export const assertProviderIdentityAvailable = async ({
	provider,
	providerUid,
	userId,
}) => {
	const existingProviderUser = await User.findOne({
		$or: [
			{ provider, providerUid },
			{ 'linkedProviders.provider': provider, 'linkedProviders.providerUid': providerUid },
		],
	}).select('_id')
	if (
		existingProviderUser &&
		String(existingProviderUser._id) !== String(userId)
	) {
		const error = new Error(
			'This provider is already linked to another account.',
		)
		error.statusCode = 409
		throw error
	}
}

export const assertCurrentPassword = async (user, currentPassword) => {
	if (
		!currentPassword ||
		!user.password ||
		!(await bcrypt.compare(currentPassword, user.password))
	) {
		const error = new Error('Re-authentication required.')
		error.statusCode = 401
		throw error
	}
}

export const assertFreshProviderToken = (decodedToken) => {
	const now = Math.floor(Date.now() / 1000)
	const tokenAge = now - Number(decodedToken.iat)
	if (
		!Number.isFinite(Number(decodedToken.iat)) ||
		tokenAge < -60 ||
		tokenAge > 5 * 60
	) {
		const error = new Error('A fresh provider token is required.')
		error.statusCode = 401
		throw error
	}
}

export const getDuplicateAuthErrorMessage = (error) =>
	error?.code === 11000
		? 'Email or provider identity is already registered.'
		: null

export const verifySocialProviderToken = async (idToken, provider) => {
	let decodedToken
	try {
		decodedToken = await getAuth().verifyIdToken(idToken, true)
	} catch (error) {
		if (
			error?.code === 'auth/id-token-expired' ||
			error?.code === 'auth/id-token-revoked' ||
			error?.code === 'auth/argument-error'
		) {
			const tokenError = new Error('Invalid or expired provider token.')
			tokenError.statusCode = 401
			throw tokenError
		}
		throw error
	}

	assertProviderEmailVerified(decodedToken)
	const providerByFirebaseId = {
		'google.com': 'google',
		'microsoft.com': 'microsoft',
		'apple.com': 'apple',
	}
	if (
		providerByFirebaseId[decodedToken.firebase?.sign_in_provider] !== provider
	) {
		const error = new Error('Social provider does not match the token.')
		error.statusCode = 401
		throw error
	}
	return decodedToken
}

export const socialSignin = async (req, res) => {
	try {
		if (!admin.getApps().length) {
			return res
				.status(500)
				.json({ message: 'Social auth is not configured on the server.' })
		}

		const { idToken, provider } = req.body
		const decodedToken = await verifySocialProviderToken(idToken, provider)

		const { email, name, picture } = decodedToken
		if (!email)
			return res.status(400).json({ message: 'Invalid token: missing email' })

		// Match the provider identity first: an email alone must never sign someone in,
		// because a different account at the same provider can claim the same address.
		const user =
			(await User.findOne({
				$or: [
					{ provider, providerUid: decodedToken.uid },
					{ 'linkedProviders.provider': provider, 'linkedProviders.providerUid': decodedToken.uid },
				],
			})) || (await User.findOne({ email: email.toLowerCase() }))
		if (!user)
			return res
				.status(404)
				.json({ message: 'User not found. Please sign up first.' })
		const linkedProvider = user.linkedProviders?.some(
			(link) => link.provider === provider && link.providerUid === decodedToken.uid,
		)
		const isPrimaryIdentity = user.provider === provider && user.providerUid === decodedToken.uid
		if (!isPrimaryIdentity && !linkedProvider) {
			if (user.provider === 'local') {
				return res.status(409).json({
					message: `This email belongs to a local account. Connect ${provider} in Settings first.`,
				})
			}
			if (user.provider !== provider) {
				return res.status(409).json({
					message: `This email is already registered with ${user.provider}.`,
				})
			}
			if (user.providerUid) {
				return res.status(409).json({
					message: `This email is linked to a different ${provider} account.`,
				})
			}
			// Accounts created before provider UIDs were stored adopt the first verified identity.
			const bound = await User.updateOne(
				{ _id: user._id, provider, $or: [{ providerUid: null }, { providerUid: { $exists: false } }] },
				{ $set: { providerUid: decodedToken.uid } },
			)
			if (!bound.modifiedCount) {
				return res.status(409).json({ message: 'Provider identity changed. Please try again.' })
			}
		}
		await startSession(req, res, user, provider)

		return res.status(200).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			profileSetup: user.profileSetup,
			provider: user.provider,
			linkedProviders: user.linkedProviders?.map(({ provider: linkedProviderName, linkedAt }) => ({ provider: linkedProviderName, linkedAt })),
		})
	} catch (error) {
		console.error('Social Signin Error:', error)
		return res
			.status(error.statusCode || 500)
			.json({
				message: error.statusCode ? error.message : 'Social login failed',
			})
	}
}

export const socialSignup = async (req, res) => {
	try {
		if (!admin.getApps().length)
			return res
				.status(500)
				.json({ message: 'Social auth is not configured on the server.' })
		const { idToken, provider } = req.body
		const decodedToken = await verifySocialProviderToken(idToken, provider)
		const { email, name, picture } = decodedToken
		if (!email)
			return res.status(400).json({ message: 'Invalid token: missing email' })
		const existingUser = await User.findOne({ email: email.toLowerCase() })
		if (existingUser) {
			if (existingUser.provider === 'local')
				return res
					.status(409)
					.json({
						message: `This email belongs to a local account. Connect ${provider} in Settings first.`,
					})
			return res
				.status(409)
				.json({
					message:
						'An account already exists with this provider. Please sign in.',
				})
		}
		const user = await User.create({
			email: email.toLowerCase(),
			name: name || '',
			avatar: picture || '',
			provider,
			providerUid: decodedToken.uid,
			password: null,
			emailVerified: true,
			profileSetup: false,
		})
		await startSession(req, res, user, provider)
		return res
			.status(201)
			.json({
				_id: user._id,
				email: user.email,
				name: user.name,
				avatar: user.avatar,
				profileSetup: user.profileSetup,
				provider: user.provider,
				emailVerified: user.emailVerified,
				hasPassword: user.hasPassword,
				linkedProviders: [],
			})
	} catch (error) {
		console.error('Social Signup Error:', error)
		const duplicateMessage = getDuplicateAuthErrorMessage(error)
		if (duplicateMessage)
			return res.status(409).json({ message: duplicateMessage })
		return res
			.status(error.statusCode || 500)
			.json({
				message: error.statusCode ? error.message : 'Social signup failed',
			})
	}
}

export const connectSocialAccount = async (req, res) => {
	try {
		if (!admin.getApps().length)
			return res
				.status(500)
				.json({ message: 'Social auth is not configured on the server.' })
		const { idToken, provider, currentPassword } = req.body
		const decodedToken = await verifySocialProviderToken(idToken, provider)

		const user = await User.findById(req.user._id)
		if (!user || user.provider !== 'local')
			return res
				.status(409)
				.json({ message: 'Only local accounts can connect a provider.' })

		// Re-auth before any information-revealing checks. Mobile redirect flows
		// use the short-lived server timestamp created by /reauthenticate.
		if (currentPassword) {
			await assertCurrentPassword(user, currentPassword)
		} else if (!hasRecentReauthentication(user)) {
			const error = new Error('Re-authentication required.')
			error.statusCode = 401
			throw error
		}

		if (
			!decodedToken.email ||
			decodedToken.email.toLowerCase() !== user.email.toLowerCase()
		)
			return res
				.status(409)
				.json({
					message:
						'Use the same email as your current account to connect this provider.',
				})

		// ownership check LAST, right before mutating state
		await assertProviderIdentityAvailable({
			provider,
			providerUid: decodedToken.uid,
			userId: req.user._id,
		})

		const alreadyLinked = user.linkedProviders.some(
			(link) => link.provider === provider && link.providerUid === decodedToken.uid,
		)
		if (!alreadyLinked) {
			user.linkedProviders.push({ provider, providerUid: decodedToken.uid })
		}
		user.emailVerificationTokenHash = ''
		user.emailVerificationTokenExpiresAt = null
		await user.save()

		if (!alreadyLinked) {
			try {
				await sendProviderLinkedEmail({
					email: user.email,
					language: user.language,
					provider,
					settingsUrl: `${env.frontendUrl}/settings#security`,
				})
			} catch (mailError) {
				console.error('Provider linking notification email failed:', mailError.message)
			}
		}

		return res
			.status(200)
			.json({
				_id: user._id,
				email: user.email,
				name: user.name,
				avatar: user.avatar,
				profileSetup: user.profileSetup,
				provider: user.provider,
				linkedProviders: user.linkedProviders.map(({ provider: linkedProviderName, linkedAt }) => ({ provider: linkedProviderName, linkedAt })),
			})
	} catch (error) {
		console.error('Connect Social Error:', error)
		const duplicateMessage = getDuplicateAuthErrorMessage(error)
		if (duplicateMessage)
			return res.status(409).json({ message: duplicateMessage })
		return res
			.status(error.statusCode || 500)
			.json({
				message: error.statusCode
					? error.message
					: 'Could not connect social account',
			})
	}
}

export const disconnectSocialAccount = async (req, res) => {
	try {
		const provider = String(req.params.provider || '')
		if (!['google', 'microsoft', 'apple'].includes(provider)) return res.status(400).json({ message: 'Invalid provider' })
		const user = await User.findById(req.user._id)
		if (!user) return res.status(404).json({ message: 'User not found' })
		if (user.password) await assertCurrentPassword(user, req.body.currentPassword)

		const isPrimary = user.provider === provider
		const linked = user.linkedProviders.find((item) => item.provider === provider)
		if (!isPrimary && !linked) return res.status(404).json({ message: 'Provider is not connected' })
		const remainingLinked = user.linkedProviders.filter((item) => item.provider !== provider)
		if (isPrimary) {
			const fallback = remainingLinked[0]
			if (fallback) {
				user.provider = fallback.provider
				user.providerUid = fallback.providerUid
				user.linkedProviders = remainingLinked.slice(1)
			} else if (user.password || user.passkeys?.length) {
				user.provider = 'local'
				user.providerUid = undefined
				user.linkedProviders = []
			} else {
				return res.status(409).json({ message: 'Add a password or another sign-in method before disconnecting this provider.' })
			}
		} else {
			user.linkedProviders = remainingLinked
		}
		await user.save()
		return res.json({ message: 'Provider disconnected successfully' })
	} catch (error) {
		return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Could not disconnect provider' })
	}
}

export const setSocialPassword = async (req, res) => {
	try {
		if (!admin.getApps().length)
			return res
				.status(500)
				.json({ message: 'Social auth is not configured on the server.' })

		const { idToken, provider, password, currentPassword } = req.body
		const decodedToken = await verifySocialProviderToken(idToken, provider)
		assertFreshProviderToken(decodedToken)

		const user = await User.findById(req.user._id)
		if (!user) {
			const error = new Error('Provider identity could not be verified.')
			error.statusCode = 401
			throw error
		}

		if (
			user.provider !== provider ||
			!user.providerUid ||
			String(decodedToken.uid) !== String(user.providerUid)
		) {
			const error = new Error('Provider identity does not match this account.')
			error.statusCode = 401
			throw error
		}

		if (
			!decodedToken.email ||
			decodedToken.email.toLowerCase() !== user.email.toLowerCase()
		)
			return res.status(409).json({
				message: 'Provider email does not match this account.',
			})

		if (user.provider === 'local')
			return res
				.status(409)
				.json({ message: 'Only social accounts can add a provider password.' })

		if (user.hasPassword) {
			await assertCurrentPassword(user, currentPassword)
		}

		user.password = await hashPassword(password)
		user.hasPassword = true
		await user.save()

		try {
			await sendPasswordAddedEmail({
				email: user.email,
				language: user.language,
				settingsUrl: `${env.frontendUrl}/settings`,
			})
		} catch (mailError) {
			console.error('Password notification email failed:', mailError.message)
		}

		return res.status(200).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			profileSetup: user.profileSetup,
			provider: user.provider,
			hasPassword: user.hasPassword,
		})
	} catch (error) {
		console.error('Set Social Password Error:', error)
		return res
			.status(error.statusCode || 500)
			.json({
				message: error.statusCode
					? error.message
					: 'Could not set account password',
			})
	}
}

export const signup = async (req, res) => {
	try {
		const { email, password, provider = 'local', language } = req.body

		if (!email || !provider) {
			return res
				.status(400)
				.json({ message: 'Email and provider are required.' })
		}
		if (provider !== 'local') {
			return res.status(400).json({
				message: 'Social accounts must use their provider sign-in flow.',
			})
		}

		if (provider === 'local') {
			if (!password) {
				return res
					.status(400)
					.json({ message: 'Password is required for local signup.' })
			}
		}

		const normalizedEmail = email.trim().toLowerCase()
		const existingUser = await User.findOne({ email: normalizedEmail })
		if (existingUser?.provider && existingUser.provider !== 'local') {
			return res
				.status(409)
				.json({
					message: `This email is registered with ${existingUser.provider}. Please use ${existingUser.provider} sign-in.`,
				})
		}
		if (existingUser)
			return res
				.status(409)
				.json({ message: 'A local account already exists. Please sign in.' })

		let hashedPassword = null
		if (provider === 'local') {
			const salt = await bcrypt.genSalt(10)
			hashedPassword = await bcrypt.hash(password, salt)
		}

		const rawVerificationToken = crypto.randomBytes(32).toString('hex')
		const verificationTokenHash = crypto
			.createHash('sha256')
			.update(rawVerificationToken)
			.digest('hex')
		const emailVerificationExpiresAt = new Date(
			Date.now() + env.emailVerificationMinutes * 60 * 1000,
		)

		const newUser = new User({
			email: normalizedEmail,
			password: hashedPassword,
			hasPassword: Boolean(hashedPassword),
			provider,
			emailVerified: provider !== 'local',
			emailVerificationTokenHash:
				provider === 'local' ? verificationTokenHash : '',
			emailVerificationTokenExpiresAt:
				provider === 'local' ? emailVerificationExpiresAt : null,
			emailVerificationLastSentAt: provider === 'local' ? new Date() : null,
			profileSetup: false,
			...(language ? { language } : {}),
		})

		await newUser.save()

		if (provider === 'local') {
			const verificationUrl = `${env.frontendUrl}/verify-email?token=${rawVerificationToken}`
			try {
				await sendAccountVerificationEmail({
					email: newUser.email,
					language: newUser.language,
					verificationUrl,
				})
			} catch (mailError) {
				console.error('Verification email failed:', mailError.message)
				await User.deleteOne({ _id: newUser._id })
				return res.status(503).json({
					message: 'Could not send the verification email. Please try signing up again.',
				})
			}
			return res.status(201).json({
				message: 'Account created. Please verify your email before continuing.',
				requiresVerification: true,
				email: newUser.email,
			})
		}

		await startSession(req, res, newUser, 'signup')
		return res.status(201).json({
			_id: newUser._id,
			email: newUser.email,
			provider: newUser.provider,
			profileSetup: newUser.profileSetup,
		})
	} catch (error) {
		console.error('Error in signup controller:', error)
		const duplicateMessage = getDuplicateAuthErrorMessage(error)
		if (duplicateMessage)
			return res.status(409).json({ message: duplicateMessage })
		res.status(500).json({ message: 'Server error during signup' })
	}
}

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-password', 10)

export const login = async (req, res) => {
	const { email, password } = req.body

	try {
		const user = await User.findOne({ email })

		if (!user) {
			// Spend the same bcrypt time as a real check so response timing does not reveal accounts.
			await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
			return res.status(400).json({ message: 'Credentials are not valid' })
		}

		// If user signed up with a social provider but doesn't have a password
		if (
			['google', 'microsoft', 'apple'].includes(user.provider) &&
			!user.password
		) {
			return res.status(400).json({
				message: `This account is registered with ${user.provider}. Please log in using ${user.provider} or set a password.`,
			})
		}

		const isPasswordCorrect = Boolean(user.password) && await bcrypt.compare(password, user.password)
		if (!isPasswordCorrect) {
			return res.status(400).json({ message: 'Credentials are not valid' })
		}

		// Generate token even if email is not verified
		// This allows the user to verify their email
		await startSession(req, res, user, 'password')

		if (!user.emailVerified) {
			return res.status(200).json({
				_id: user._id,
				email: user.email,
				name: user.name,
				avatar: user.avatar,
				profileSetup: user.profileSetup,
				emailVerified: false,
				requiresVerification: true,
			})
		}

		// Return user data
		res.status(200).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			profileSetup: user.profileSetup,
			emailVerified: true,
		})
	} catch (error) {
		console.error('Error in login controller:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

export const validatePasswordResetToken = async (req, res) => {
	try {
		const token = req.query?.token
		if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
			return res.status(400).json({ message: 'Reset token is required' })
		}

		const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
		const resetToken = await PasswordResetToken.findOne({ tokenHash })

		if (!resetToken) {
			return res.status(400).json({
				message: 'This reset link has expired or is no longer valid.',
				code: 'expired',
			})
		}

		if (resetToken.usedAt) {
			return res.status(410).json({
				message: 'This reset link has expired or is no longer valid.',
				code: 'expired',
			})
		}

		if (new Date(resetToken.expiresAt) <= new Date()) {
			return res.status(410).json({
				message: 'This reset link has expired or is no longer valid.',
				code: 'expired',
			})
		}

		const user = await User.findById(resetToken.user).select('_id email')
		if (!user) {
			return res.status(404).json({ message: 'User not found' })
		}

		return res.status(200).json({ valid: true, email: user.email })
	} catch (error) {
		console.error('Password reset token validation failed:', error)
		return res.status(500).json({ message: 'Could not validate reset link' })
	}
}

export const requestPasswordReset = async (req, res) => {
	try {
		const email = req.body.email?.trim().toLowerCase()
		const genericResponse = {
			message:
				'If an account exists for this email, a reset link has been sent.',
		}

		if (!email) return res.status(400).json({ message: 'Email is required' })

		const user = await User.findOne({ email })
		if (!user) return res.status(200).json(genericResponse)

		await PasswordResetToken.deleteMany({ user: user._id })
		const rawToken = crypto.randomBytes(32).toString('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		const expiresAt = new Date(
			Date.now() + env.passwordResetMinutes * 60 * 1000,
		)

		await PasswordResetToken.create({ user: user._id, tokenHash, expiresAt })
		const resetUrl = `${env.frontendUrl}/login/resetpassword?token=${rawToken}`

		try {
			await sendPasswordResetEmail({ email: user.email, resetUrl, language: user.language })
		} catch (mailError) {
			await PasswordResetToken.deleteOne({ tokenHash })
			console.error('Password reset email failed:', mailError.message)
			return res.status(503).json({
				message: 'Password reset email service is not configured.',
			})
		}

		return res.status(200).json(genericResponse)
	} catch (error) {
		console.error('Password reset request failed:', error)
		return res.status(500).json({ message: 'Could not request password reset' })
	}
}

export const resetPassword = async (req, res) => {
	try {
		const { token, password } = req.body
		if (!token || !password) {
			return res
				.status(400)
				.json({ message: 'Token and password are required' })
		}
		if (password.length < 8) {
			return res
				.status(400)
				.json({ message: 'Password must be at least 8 characters long' })
		}

		const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
		const resetToken = await PasswordResetToken.findOne({
			tokenHash,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		})
		if (!resetToken) {
			return res.status(400).json({
				message: 'This reset link has expired or is no longer valid.',
				code: 'expired',
			})
		}
		const user = await User.findById(resetToken.user)
		if (!user) return res.status(404).json({ message: 'User not found' })

		const isSameAsCurrentPassword = Boolean(user.password) && await bcrypt.compare(
			password,
			user.password,
		)
		if (isSameAsCurrentPassword) {
			return res.status(400).json({
				message: 'New password must be different from your current password',
			})
		}

		const claimedToken = await PasswordResetToken.findOneAndUpdate(
			{
				_id: resetToken._id,
				usedAt: null,
				expiresAt: { $gt: new Date() },
			},
			{ $set: { usedAt: new Date() } },
			{ returnDocument: 'after' },
		)
		if (!claimedToken) {
			return res.status(410).json({
				message: 'This reset link has expired or is no longer valid.',
				code: 'expired',
			})
		}

		const salt = await bcrypt.genSalt(10)
		user.password = await bcrypt.hash(password, salt)
		user.hasPassword = true
		user.sessionVersion = Number(user.sessionVersion || 0) + 1
		await user.save()
		await endOtherSessions(user._id)
		await PasswordResetToken.deleteMany({
			user: user._id,
			_id: { $ne: claimedToken._id },
		})

		return res.status(200).json({ message: 'Password updated successfully' })
	} catch (error) {
		console.error('Password reset failed:', error)
		return res.status(500).json({ message: 'Could not reset password' })
	}
}

export const verifyEmail = async (req, res) => {
	try {
		const token = req.body?.token || req.query?.token
		if (!token) {
			return res.status(400).json({ message: 'Verification token is required' })
		}

		// Require authentication - user must be logged in to verify their email
		if (!req.user || !req.user._id) {
			return res.status(401).json({ 
				message: 'Authentication required. Please log in to verify your email.',
				code: 'auth_required'
			})
		}

		const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
		
		// Find the user using the token AND verify it belongs to the authenticated user
		const user = await User.findOne({
			_id: req.user._id,
			emailVerificationTokenHash: tokenHash,
			emailVerificationTokenExpiresAt: { $gt: new Date() },
			emailVerified: false, // Ensure email is not already verified
		})

		if (!user) {
			return res
				.status(400)
				.json({ message: 'Verification link is invalid or expired' })
		}

		user.emailVerified = true
		user.emailVerificationTokenHash = ''
		user.emailVerificationTokenExpiresAt = null
		user.emailVerificationLastSentAt = null
		await user.save()

		return res.status(200).json({
			message: 'Email verified successfully. You can now access your account fully.',
		})
	} catch (error) {
		console.error('Email verification failed:', error)
		return res.status(500).json({ message: 'Could not verify email' })
	}
}

export const resendVerificationEmail = async (req, res) => {
	try {
		if (!req.user || !req.user._id) {
			return res.status(401).json({ 
				message: 'Authentication required. Please log in to resend verification email.',
				code: 'auth_required'
			})
		}

		const email = req.body?.email?.toLowerCase()
		if (!email) {
			return res.status(400).json({ message: 'Email is required' })
		}

		const user = await User.findById(req.user._id).select(
			'email language emailVerified emailVerificationLastSentAt emailVerificationTokenHash emailVerificationTokenExpiresAt'
		)
		if (!user) {
			return res.status(401).json({ message: 'Unauthorized - User not found' })
		}

		if (email !== user.email.toLowerCase()) {
			return res.status(403).json({ 
				message: 'You can only verify your own email address.',
				code: 'email_mismatch'
			})
		}

		if (user.emailVerified) {
			return res.status(400).json({ 
				message: 'This email address is already verified.',
				code: 'already_verified'
			})
		}

		const now = new Date()
		const cooldownCutoff = new Date(now.getTime() - 60 * 1000)
		if (user.emailVerificationLastSentAt && user.emailVerificationLastSentAt > cooldownCutoff) {
			const secondsRemaining = Math.ceil(
				(60000 - (now.getTime() - user.emailVerificationLastSentAt.getTime())) / 1000,
			)
			return res.status(429).json({
				message: `Please wait ${secondsRemaining} seconds before requesting another verification email.`,
				code: 'cooldown_active',
				retryAfter: secondsRemaining,
			})
		}

		const rawToken = crypto.randomBytes(32).toString('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		const expiresAt = new Date(Date.now() + env.emailVerificationMinutes * 60 * 1000)
		const verificationUrl = `${env.frontendUrl}/verify-email?token=${rawToken}`

		try {
			await sendAccountVerificationEmail({ email: user.email, verificationUrl, language: user.language })
		} catch (mailError) {
			console.error('Verification email resend failed:', mailError.message)
			return res.status(503).json({
				message: 'Could not send verification email. Please try again later.',
				code: 'email_send_failed',
			})
		}

		await User.updateOne(
			{ _id: user._id, emailVerified: false },
			{
				$set: {
					emailVerificationTokenHash: tokenHash,
					emailVerificationTokenExpiresAt: expiresAt,
					emailVerificationLastSentAt: now,
				},
			},
		)

		return res.status(200).json({
			message: 'A fresh verification link has been sent to your email address.',
			retryAfter: 60,
		})
	} catch (error) {
		console.error('Verification email resend failed:', error)
		return res.status(500).json({
			message: 'Could not resend verification email. Please try again later.',
			code: 'server_error',
		})
	}
}

// Log out works with any cookie, even an expired one; it only needs the device's name.
const sidFromCookie = (token) => {
	try {
		return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], ignoreExpiration: true })?.sid || null
	} catch {
		return null
	}
}

export const logout = async (req, res) => {
	try {
		const sid = sidFromCookie(req.cookies?.jwt)
		if (sid) await endSession(sid)
		clearAuthCookie(res)
		res.status(200).json({
			message: 'Logged out successfully',
		})
	} catch (error) {
		console.log('Error in logout controller', error.message)
		res.status(500).json({
			message: 'Internal server error',
		})
	}
}

export const getAuthUser = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select(`${publicUserFields} password passkeys linkedProviders`)
		if (!user) return res.status(404).json({ message: 'User not found' })
		const userData = user.toObject()
		delete userData.passkeys
		delete userData.password
		return res.status(200).json({
			...userData,
			hasPassword: Boolean(user.password),
			passkeyEnabled: user.passkeys.length > 0,
			linkedProviders: user.linkedProviders?.map(({ provider, linkedAt }) => ({ provider, linkedAt })) || [],
			passkeys: user.passkeys.map((passkey) => ({
				id: passkey.credentialID,
				name: passkey.name,
				provider: passkey.provider,
				createdAt: passkey.createdAt,
				lastUsedAt: passkey.lastUsedAt,
			})),
		})
	} catch (error) {
		console.log('Error in getAuthUser controller', error.message)
		res.status(500).json({
			message: 'Internal server error',
		})
	}
}

export const updateSettings = async (req, res) => {
	try {
		// Preferences are merged key by key; the frequency and the old on/off switch stay in step.
		const { emailPreferences, ...rest } = req.body
		const update = { ...rest }
		for (const [key, value] of Object.entries(emailPreferences || {})) update[`emailPreferences.${key}`] = value
		if (rest.emailFrequency) update.emailNotifications = rest.emailFrequency !== 'never'
		else if (rest.emailNotifications === false) update.emailFrequency = 'never'
		else if (rest.emailNotifications === true) update.emailFrequency = 'instant'
		const user = await User.findByIdAndUpdate(
			req.user._id,
			{ $set: update },
			{ returnDocument: 'after', runValidators: true },
		).select(publicUserFields)

		if (!user) return res.status(404).json({ message: 'User not found' })
		return res.status(200).json(user)
	} catch (error) {
		console.error('Settings update failed:', error)
		return res.status(500).json({ message: 'Could not update settings' })
	}
}

export const changePassword = async (req, res) => {
	try {
		const { currentPassword, newPassword } = req.body
		if (!currentPassword || !newPassword || newPassword.length < 8) {
			return res.status(400).json({
				message:
					'Current password and a new password of at least 8 characters are required',
			})
		}

		const user = await User.findById(req.user._id)
		if (!user) return res.status(404).json({ message: 'User not found' })
		if (!user.password)
			return res.status(400).json({
				message: 'Set a local password from profile before changing it',
			})
		if (!(await bcrypt.compare(currentPassword, user.password)))
			return res.status(401).json({ message: 'Current password is incorrect' })
		if (await bcrypt.compare(newPassword, user.password)) {
			return res.status(400).json({
				message: 'New password must be different from your current password',
			})
		}

		const salt = await bcrypt.genSalt(10)
		user.password = await bcrypt.hash(newPassword, salt)
		user.sessionVersion = Number(user.sessionVersion || 0) + 1
		await user.save()
		// Other devices are signed out; this one stays signed in with a fresh cookie.
		await endOtherSessions(user._id, req.sessionId, res)
		await renewSession(res, user, req.sessionId)
		return res.status(200).json({ message: 'Password changed successfully' })
	} catch (error) {
		console.error('Password change failed:', error)
		return res.status(500).json({ message: 'Could not change password' })
	}
}

// Ends every other session: bumping the version invalidates all issued tokens, this
// device gets a fresh one, and open tabs elsewhere are told to check their session.
export const signOutOtherSessions = async (req, res) => {
	try {
		const user = await User.findByIdAndUpdate(req.user._id, { $inc: { sessionVersion: 1 } }, { returnDocument: 'after' }).select('sessionVersion')
		if (!user) return res.status(404).json({ message: 'User not found' })
		const count = await endOtherSessions(user._id, req.sessionId, res)
		await renewSession(res, user, req.sessionId)
		// Only after this device has its new cookie, so it never checks with the old one.
		res.on('finish', () => emitUserEvent(user._id.toString(), 'session:changed', {}))
		return res.status(200).json({ signedOut: count })
	} catch (error) {
		console.error('Signing out other sessions failed:', error)
		return res.status(500).json({ message: 'Could not sign out other sessions' })
	}
}

/** Every device signed in to this account, this one first. */
export const getSessions = async (req, res) => {
	try {
		const sessions = await listSessions(req.user._id, req.sessionId)
		sessions.sort((a, b) => Number(b.current) - Number(a.current))
		return res.status(200).json(sessions)
	} catch (error) {
		console.error('Listing sessions failed:', error)
		return res.status(500).json({ message: 'Could not load your devices' })
	}
}

/** Signs out one other device. This device signs out with the usual log out. */
export const revokeSession = async (req, res) => {
	try {
		if (req.params.id === 'current') return res.status(400).json({ message: 'Use log out to sign out this device.' })
		if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Device not found' })
		const session = await Session.findOne({ _id: req.params.id, user: req.user._id }).select('sid')
		if (!session) return res.status(404).json({ message: 'Device not found' })
		if (session.sid === req.sessionId) return res.status(400).json({ message: 'Use log out to sign out this device.' })
		await endSession(session.sid)
		return res.status(204).send()
	} catch (error) {
		console.error('Signing out a device failed:', error)
		return res.status(500).json({ message: 'Could not sign out that device' })
	}
}

export const reauthenticate = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('password')
		if (!user || !user.password) return res.status(401).json({ message: 'Re-authentication required.' })
		await assertCurrentPassword(user, req.body.currentPassword)
		await User.updateOne({ _id: user._id }, { $set: { lastReauthenticatedAt: new Date() } })
		return res.status(204).send()
	} catch (error) {
		return res.status(error.statusCode || 401).json({ message: 'Re-authentication failed.' })
	}
}

// IANA names only ("Europe/Kyiv"); the runtime knows which ones exist.
const isValidTimezone = (timezone) => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: timezone })
		return true
	} catch {
		return false
	}
}

export const setupProfile = async (req, res) => {
	try {
		const { name, jobTitle, timezone, avatar, removeAvatar } = req.body
		const userId = req.user._id

		const user = await User.findById(userId)
		if (!user) return res.status(404).json({ message: 'User not found' })

		if (timezone && !isValidTimezone(timezone)) return res.status(400).json({ message: 'Choose a valid timezone.' })
		if (name) user.name = name.trim()
		if (jobTitle !== undefined) user.jobTitle = jobTitle.trim()
		if (timezone) user.timezone = timezone
		if (removeAvatar && !avatar && user.avatar) {
			user.avatar = ''
			// The stored file goes too; a failed cleanup must not block the profile.
			Promise.resolve().then(() => cloudinary.uploader.destroy(`avatars/${user._id}-avatar`, { resource_type: 'image' })).catch((error) => {
				console.error('Avatar cleanup failed:', error?.message || error)
			})
		}

		// Accept only browser-compressed raster avatars within the JSON body budget.
		if (avatar) {
			const avatarMatch = avatar.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
			if (!avatarMatch) return res.status(400).json({ message: 'Avatar must be a JPG, PNG, or WebP image.' })
			const avatarBytes = Buffer.from(avatarMatch[2], 'base64').byteLength
			if (avatarBytes > 70 * 1024) return res.status(413).json({ message: 'Avatar must be 70 KB or smaller after compression.' })

			const uploadRes = await cloudinary.uploader.upload(avatar, {
				folder: 'avatars',
				public_id: `${user._id}-avatar`,
				overwrite: true,
				resource_type: 'image',
				transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
			})
			user.avatar = uploadRes.secure_url
		}

		user.profileSetup = true
		await user.save()

		res.status(200).json({
			message: 'Profile updated successfully',
			user: {
				_id: user._id,
				name: user.name,
				jobTitle: user.jobTitle,
				timezone: user.timezone,
				email: user.email,
				avatar: user.avatar,
			},
		})
	} catch (error) {
		console.error('Profile setup error:', error)
		const isCloudinaryError = Boolean(error?.http_code)
		res.status(isCloudinaryError ? 502 : 500).json({
			message: isCloudinaryError
				? 'Avatar storage is temporarily unavailable. Please try again.'
				: 'Failed to update profile',
		})
	}
}
