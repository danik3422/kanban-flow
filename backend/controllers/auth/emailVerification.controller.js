import crypto from 'node:crypto'

import { env } from '../../config/env.js'
import { sendAccountVerificationEmail } from '../../emails/mailer.js'
import User from '../../models/user.model.js'

// Confirming the email address of a new account.

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
