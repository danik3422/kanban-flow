import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from '@simplewebauthn/server'

import { env } from '../../config/env.js'
import { sendPasskeyAddedEmail } from '../../emails/mailer.js'
import PasskeyChallenge from '../../models/passkeyChallenge.model.js'
import User from '../../models/user.model.js'
import { assertReauthenticated, hasRecentReauthentication } from '../../services/authChecks.service.js'
import { describeUserAgent, startSession } from '../../services/sessions.service.js'

// Passkeys: adding, renaming and removing them, and signing in with one.

const getPasskeyRp = () => {
	const frontendUrl = new URL(env.frontendUrl)
	return {
		rpID: frontendUrl.hostname,
		expectedOrigin: frontendUrl.origin,
	}
}

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
		// A passkey outlives password changes and signing out other devices, so a stolen
		// session alone must not be able to add one: password or a fresh provider sign-in first.
		if (!hasRecentReauthentication(user)) {
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
		let addedName = ''
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
			addedName = user.passkeys.at(-1).name
		}
		user.passkeyRegistrationChallenge = ''
		user.passkeyRegistrationChallengeExpiresAt = null
		await user.save()
		// The owner hears about every new passkey, so one added from a stolen session does not go unnoticed.
		if (addedName) {
			sendPasskeyAddedEmail({ email: user.email, passkeyName: addedName, settingsUrl: `${env.frontendUrl}/settings#security`, language: user.language })
				.catch((mailError) => console.error('Passkey email failed:', mailError.message))
		}
		return res.json({ message: 'Passkey added successfully' })
	} catch (error) {
		console.error('Passkey verification error:', error)
		return res.status(400).json({ message: 'Passkey could not be verified' })
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

export const removePasskey = async (req, res) => {
	try {
		const credentialId = String(req.params.credentialId || '')
		if (!/^[A-Za-z0-9_-]+$/.test(credentialId)) {
			return res.status(400).json({ message: 'Invalid passkey ID' })
		}
		const user = await User.findById(req.user._id)
		if (!user) return res.status(404).json({ message: 'User not found' })
		await assertReauthenticated(user, req.body?.currentPassword)
		const initialCount = user.passkeys.length
		user.passkeys = user.passkeys.filter((passkey) => passkey.credentialID !== credentialId)
		if (user.passkeys.length === initialCount) {
			return res.status(404).json({ message: 'Passkey not found' })
		}
		await user.save()
		return res.json({ message: 'Passkey removed successfully' })
	} catch (error) {
		if (error.code === 'reauth_required') return res.status(401).json({ message: error.message, code: error.code })
		if (error.statusCode) return res.status(error.statusCode).json({ message: 'Current password is incorrect' })
		console.error('Passkey removal error:', error)
		return res.status(500).json({ message: 'Could not remove passkey' })
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
