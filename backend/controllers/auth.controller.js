import bcrypt from 'bcrypt'
import { getAuth } from 'firebase-admin/auth'
import crypto from 'node:crypto'
import { env } from '../config/env.js'
import cloudinary from '../lib/cloudinary.js'
import admin from '../lib/firebaseAdmin.js'
import {
	sendAccountVerificationEmail,
	sendPasswordAddedEmail,
	sendPasswordResetEmail,
} from '../lib/mailer.js'
import { hashPassword } from '../lib/password.js'
import { publicUserFields } from '../lib/userProjection.js'
import { generateToken } from '../lib/utils.js'
import PasswordResetToken from '../models/passwordResetToken.model.js'
import User from '../models/user.model.js'

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
		provider,
		providerUid,
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

		const user = await User.findOne({ email: email.toLowerCase() })
		if (!user)
			return res
				.status(404)
				.json({ message: 'User not found. Please sign up first.' })
		if (user.provider !== 'local' && user.provider !== provider) {
			return res
				.status(400)
				.json({ message: `This account is registered with ${user.provider}.` })
		}

		if (user.provider === 'local') {
			return res
				.status(409)
				.json({
					message: `This email belongs to a local account. Connect ${provider} in Settings first.`,
				})
		}
		if (user.provider !== provider) {
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

		// re-auth BEFORE any information-revealing checks
		await assertCurrentPassword(user, currentPassword)

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

		user.provider = provider
		user.providerUid = decodedToken.uid
		user.emailVerified = true
		user.emailVerificationTokenHash = ''
		user.emailVerificationTokenExpiresAt = null
		await user.save()

		return res
			.status(200)
			.json({
				_id: user._id,
				email: user.email,
				name: user.name,
				avatar: user.avatar,
				profileSetup: user.profileSetup,
				provider: user.provider,
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
		res.status(200).json(req.user)
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
			return res.status(400).json({ message: 'Current password is incorrect' })
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

export const setupProfile = async (req, res) => {
	try {
		const { name, jobTitle, timezone, avatar } = req.body
		const userId = req.user._id

		const user = await User.findById(userId)
		if (!user) return res.status(404).json({ message: 'User not found' })

		if (name) user.name = name.trim()
		if (jobTitle !== undefined) user.jobTitle = jobTitle.trim()
		if (timezone) user.timezone = timezone

		// Upload base64 or data URL to Cloudinary
		if (avatar && avatar.startsWith('data:image')) {
			const uploadRes = await cloudinary.uploader.upload(avatar, {
				folder: 'avatars',
				public_id: `${user._id}-avatar`,
				overwrite: true,
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
		res.status(500).json({ message: 'Failed to update profile' })
	}
}
