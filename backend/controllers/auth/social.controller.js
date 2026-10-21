import { env } from '../../config/env.js'
import { sendPasswordAddedEmail, sendProviderLinkedEmail } from '../../emails/mailer.js'
import admin from '../../lib/firebaseAdmin.js'
import User from '../../models/user.model.js'
import {
	assertCurrentPassword,
	assertFreshProviderToken,
	assertProviderIdentityAvailable,
	assertReauthenticated,
	getDuplicateAuthErrorMessage,
	hasRecentReauthentication,
	verifySocialProviderToken,
} from '../../services/authChecks.service.js'
import { hashPassword } from '../../services/password.service.js'
import { startSession } from '../../services/sessions.service.js'

// Google, Microsoft and Apple sign-in, and linking those providers to an account.

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
		if (!existingUser && !env.signupOpen && (await User.estimatedDocumentCount()) > 0) {
			return res.status(403).json({ message: 'Sign-up is closed on this server. Ask its admin for an account.' })
		}
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
		await assertReauthenticated(user, req.body.currentPassword)

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
		return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Could not disconnect provider', ...(error.code ? { code: error.code } : {}) })
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
