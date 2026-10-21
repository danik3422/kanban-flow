import bcrypt from 'bcrypt'
import crypto from 'node:crypto'

import { env } from '../../config/env.js'
import { sendPasswordResetEmail } from '../../emails/mailer.js'
import PasswordResetToken from '../../models/passwordResetToken.model.js'
import User from '../../models/user.model.js'
import { endOtherSessions, renewSession } from '../../services/sessions.service.js'

// Changing a password, and resetting a forgotten one by email.

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

		// Sent after answering: waiting for the mail API would make known addresses
		// answer slower (or fail) and give away which ones have accounts.
		sendPasswordResetEmail({ email: user.email, resetUrl, language: user.language }).catch(async (mailError) => {
			console.error('Password reset email failed:', mailError.message)
			await PasswordResetToken.deleteOne({ tokenHash }).catch(() => {})
		})

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
