import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

import { env } from '../../config/env.js'
import { sendAccountExistsEmail, sendAccountVerificationEmail } from '../../emails/mailer.js'
import { deleteImage, saveImage } from '../../services/fileStorage.service.js'
import User from '../../models/user.model.js'
import { publicUserFields } from '../../models/userFields.js'
import { getDuplicateAuthErrorMessage } from '../../services/authChecks.service.js'
import { clearAuthCookie } from '../../services/authCookie.service.js'
import { endSession, startSession } from '../../services/sessions.service.js'

// Sign-up, sign-in, sign-out, and the signed-in person's profile and settings.

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

		// Closed sign-up still lets the very first person in, so a new server gets its admin.
		if (!env.signupOpen && (await User.estimatedDocumentCount()) > 0) {
			return res.status(403).json({ message: 'Sign-up is closed on this server. Ask its admin for an account.' })
		}

		const normalizedEmail = email.trim().toLowerCase()
		const existingUser = await User.findOne({ email: normalizedEmail })
		// Without email (a self-hosted server with no mail) there is no way to tell the
		// owner privately, and nothing to confirm: say plainly that the address is taken.
		if (existingUser && !env.emailVerificationRequired) {
			return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' })
		}
		if (existingUser) {
			// Answer exactly like a new sign-up and tell the owner by email instead,
			// so the form cannot be used to find out who has an account.
			await bcrypt.hash(password, 10)
			sendAccountExistsEmail({ email: existingUser.email, signInUrl: `${env.frontendUrl}/login`, language: existingUser.language })
				.catch((mailError) => console.error('Account-exists email failed:', mailError.message))
			return res.status(201).json({
				message: 'Account created. Please verify your email before continuing.',
				requiresVerification: true,
				email: normalizedEmail,
			})
		}

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
			emailVerified: provider !== 'local' || !env.emailVerificationRequired,
			emailVerificationTokenHash:
				provider === 'local' ? verificationTokenHash : '',
			emailVerificationTokenExpiresAt:
				provider === 'local' ? emailVerificationExpiresAt : null,
			emailVerificationLastSentAt: provider === 'local' ? new Date() : null,
			profileSetup: false,
			...(language ? { language } : {}),
		})

		await newUser.save()

		if (provider === 'local' && env.emailVerificationRequired) {
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
			emailVerified: newUser.emailVerified,
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
		// Accounts without a password get the same answer and timing as a wrong one,
		// so sign-in never reveals which addresses are registered or how.
		const isPasswordCorrect = await bcrypt.compare(password, user.password || DUMMY_PASSWORD_HASH) && Boolean(user.password)
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
		const previousAvatar = user.avatar
		if (removeAvatar && !avatar && user.avatar) {
			user.avatar = ''
			// The stored file goes too; a failed cleanup must not block the profile.
			deleteImage(previousAvatar)
		}

		// Accept only browser-compressed raster avatars within the JSON body budget.
		if (avatar) {
			const avatarMatch = avatar.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
			if (!avatarMatch) return res.status(400).json({ message: 'Avatar must be a JPG, PNG, or WebP image.' })
			const avatarBytes = Buffer.from(avatarMatch[2], 'base64').byteLength
			if (avatarBytes > 70 * 1024) return res.status(413).json({ message: 'Avatar must be 70 KB or smaller after compression.' })

			user.avatar = await saveImage({
				dataUrl: avatar,
				folder: 'avatars',
				name: `${user._id}-avatar`,
				cloudinaryOptions: { transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] },
			})
			// A file on this server gets a new name each time: drop the one it replaces.
			if (previousAvatar && previousAvatar !== user.avatar && previousAvatar.startsWith('/uploads/')) deleteImage(previousAvatar)
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
