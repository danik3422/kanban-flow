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
import { generateToken } from '../lib/utils.js'
import PasswordResetToken from '../models/passwordResetToken.model.js'
import User from '../models/user.model.js'

const getPasskeyRp = () => {
	const frontendUrl = new URL(env.frontendUrl)
	return {
		rpID: frontendUrl.hostname,
		expectedOrigin: frontendUrl.origin,
	}
}

export const createPasskeyRegistrationOptions = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('email name passkeys')
		if (!user) return res.status(404).json({ message: 'User not found' })
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
		const verification = await verifyRegistrationResponse({
			response: req.body,
			expectedChallenge: user.passkeyRegistrationChallenge,
			expectedOrigin,
			expectedRPID: rpID,
			requireUserVerification: true,
		})
		if (!verification.verified || !verification.registrationInfo) {
			return res.status(400).json({ message: 'Passkey could not be verified' })
		}
		const { credential } = verification.registrationInfo
		const credentialId = credential.id
		const alreadyRegistered = user.passkeys.some((passkey) => passkey.credentialID === credentialId)
		if (!alreadyRegistered) {
			user.passkeys.push({
				credentialID: credentialId,
				publicKey: Buffer.from(credential.publicKey),
				counter: credential.counter,
				transports: credential.transports || [],
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
		const initialCount = user.passkeys.length
		user.passkeys = user.passkeys.filter((passkey) => passkey.credentialID !== credentialId)
		if (user.passkeys.length === initialCount) {
			return res.status(404).json({ message: 'Passkey not found' })
		}
		await user.save()
		return res.json({ message: 'Passkey removed successfully' })
	} catch (error) {
		console.error('Passkey removal error:', error)
		return res.status(500).json({ message: 'Could not remove passkey' })
	}
}

export const createPasskeyAuthenticationOptions = async (req, res) => {
	try {
		const { rpID } = getPasskeyRp()
		const options = await generateAuthenticationOptions({
			rpID,
			userVerification: 'preferred',
		})
		const user = await User.findOne({ email: req.body?.email }).select('_id')
		if (user) {
			user.passkeyAuthenticationChallenge = options.challenge
			user.passkeyAuthenticationChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000)
			await user.save()
		}
		return res.json(options)
	} catch (error) {
		console.error('Passkey authentication options error:', error)
		return res.status(500).json({ message: 'Could not start passkey sign-in' })
	}
}

export const authenticateWithPasskey = async (req, res) => {
	try {
		const credentialId = req.body?.id
		const user = await User.findOne({ 'passkeys.credentialID': credentialId })
		if (!user || !user.passkeyAuthenticationChallenge || !user.passkeyAuthenticationChallengeExpiresAt || user.passkeyAuthenticationChallengeExpiresAt < new Date()) {
			return res.status(400).json({ message: 'Passkey sign-in session expired' })
		}
		const storedCredential = user.passkeys.find((passkey) => passkey.credentialID === credentialId)
		const { rpID, expectedOrigin } = getPasskeyRp()
		const verification = await verifyAuthenticationResponse({
			response: req.body,
			expectedChallenge: user.passkeyAuthenticationChallenge,
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
		user.passkeyAuthenticationChallenge = ''
		user.passkeyAuthenticationChallengeExpiresAt = null
		await user.save()
		generateToken(user._id, res, user.sessionVersion)
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

		const user = await User.findOne({
			$or: [
				{ email: email.toLowerCase() },
				{ provider, providerUid: decodedToken.uid },
				{ 'linkedProviders.provider': provider, 'linkedProviders.providerUid': decodedToken.uid },
			],
		})
		if (!user)
			return res
				.status(404)
				.json({ message: 'User not found. Please sign up first.' })
		const linkedProvider = user.linkedProviders?.some(
			(link) => link.provider === provider && link.providerUid === decodedToken.uid,
		)
		if (user.provider !== 'local' && user.provider !== provider && !linkedProvider) {
			return res
				.status(400)
				.json({ message: `This account is registered with ${user.provider}.` })
		}

		if (user.provider === 'local' && !linkedProvider) {
			return res
				.status(409)
				.json({
					message: `This email belongs to a local account. Connect ${provider} in Settings first.`,
				})
		}
		if (user.provider !== provider && !linkedProvider) {
			return res
				.status(409)
				.json({
					message: `This email is already registered with ${user.provider}.`,
				})
		}
		generateToken(user._id, res, user.sessionVersion)

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
		generateToken(user._id, res, user.sessionVersion)
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
		} else if (!user.lastReauthenticatedAt || Date.now() - user.lastReauthenticatedAt.getTime() > 5 * 60 * 1000) {
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
		const { email, password, provider = 'local' } = req.body

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
			if (password.length < 6) {
				return res
					.status(400)
					.json({ message: 'Password must be at least 6 characters long.' })
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
			provider,
			emailVerified: provider !== 'local',
			emailVerificationTokenHash:
				provider === 'local' ? verificationTokenHash : '',
			emailVerificationTokenExpiresAt:
				provider === 'local' ? emailVerificationExpiresAt : null,
			emailVerificationLastSentAt: provider === 'local' ? new Date() : null,
			profileSetup: false,
		})

		await newUser.save()

		if (provider === 'local') {
			const verificationUrl = `${env.frontendUrl}/login/verify-email?token=${rawVerificationToken}`
			try {
				await sendAccountVerificationEmail({
					email: newUser.email,
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

		generateToken(newUser._id, res, newUser.sessionVersion)
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

export const login = async (req, res) => {
	const { email, password } = req.body

	try {
		const user = await User.findOne({ email })

		if (!user) {
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

		const isPasswordCorrect = await bcrypt.compare(password, user.password)
		if (!isPasswordCorrect) {
			return res.status(400).json({ message: 'Credentials are not valid' })
		}

		// Generate token even if email is not verified
		// This allows the user to verify their email
		generateToken(user._id, res, user.sessionVersion)

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
		if (!token) {
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
			await sendPasswordResetEmail({ email: user.email, resetUrl })
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

		const isSameAsCurrentPassword = await bcrypt.compare(
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
		user.provider = 'local'
		user.sessionVersion = Number(user.sessionVersion || 0) + 1
		await user.save()
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
			'email emailVerified emailVerificationLastSentAt emailVerificationTokenHash emailVerificationTokenExpiresAt'
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
		const verificationUrl = `${env.frontendUrl}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`

		try {
			await sendAccountVerificationEmail({ email: user.email, verificationUrl })
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

export const logout = (req, res) => {
	try {
		res.cookie('jwt', '', { maxAge: 0 })
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
		const user = await User.findById(req.user._id).select(`${publicUserFields} passkeys linkedProviders`)
		if (!user) return res.status(404).json({ message: 'User not found' })
		const userData = user.toObject()
		delete userData.passkeys
		return res.status(200).json({
			...userData,
			passkeyEnabled: user.passkeys.length > 0,
			linkedProviders: user.linkedProviders?.map(({ provider, linkedAt }) => ({ provider, linkedAt })) || [],
			passkeys: user.passkeys.map((passkey) => ({
				id: passkey.credentialID,
				createdAt: passkey.createdAt,
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
		const user = await User.findByIdAndUpdate(
			req.user._id,
			{ $set: req.body },
			{ new: true, runValidators: true },
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
		return res.status(200).json({ message: 'Password changed successfully' })
	} catch (error) {
		console.error('Password change failed:', error)
		return res.status(500).json({ message: 'Could not change password' })
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

export const setupProfile = async (req, res) => {
	try {
		const { name, jobTitle, timezone, avatar, removeAvatar } = req.body
		const userId = req.user._id

		const user = await User.findById(userId)
		if (!user) return res.status(404).json({ message: 'User not found' })

		if (name) user.name = name.trim()
		if (jobTitle !== undefined) user.jobTitle = jobTitle.trim()
		if (timezone) user.timezone = timezone
		if (removeAvatar && !avatar) user.avatar = ''

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
