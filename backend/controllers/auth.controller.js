import bcrypt from 'bcrypt'
import cloudinary from '../lib/cloudinary.js'
import admin from '../lib/firebaseAdmin.js'
import { generateToken } from '../lib/utils.js'
import User from '../models/user.model.js'

export const googleSignup = async (req, res) => {
	try {
		const { idToken } = req.body

		if (!idToken) {
			return res.status(400).json({ message: 'Missing ID token' })
		}

		const decodedToken = await admin.auth().verifyIdToken(idToken)
		const { email, name, picture } = decodedToken

		if (!email) {
			return res.status(400).json({ message: 'Invalid token: missing email' })
		}

		let user = await User.findOne({ email })
		if (user) {
			return res
				.status(400)
				.json({ message: 'User already exists. Please sign in.' })
		}

		user = new User({
			email,
			name: name || '',
			avatar: picture || '',
			provider: 'google',
			password: null,
			profileSetup: false,
		})
		await user.save()

		generateToken(user._id, res)

		return res.status(201).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			profileSetup: user.profileSetup,
		})
	} catch (error) {
		console.error('Google Signup Error:', error)
		return res.status(500).json({ message: 'Google signup failed' })
	}
}

export const googleSignin = async (req, res) => {
	try {
		const { idToken } = req.body

		if (!idToken) {
			return res.status(400).json({ message: 'Missing ID token' })
		}

		const decodedToken = await admin.auth().verifyIdToken(idToken)
		const { email } = decodedToken

		if (!email) {
			return res.status(400).json({ message: 'Invalid token: missing email' })
		}

		const user = await User.findOne({ email })

		if (!user) {
			return res
				.status(404)
				.json({ message: 'User not found. Please sign up first.' })
		}

		// ❌ Prevent login if the user was created with 'local' provider
		if (user.provider === 'local') {
			return res.status(403).json({
				message:
					'This account was created with email & password. Please log in with your password.',
			})
		}

		// ✅ If user exists and is from Google (or other correct provider), continue
		generateToken(user._id, res)

		return res.status(200).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			profileSetup: user.profileSetup,
		})
	} catch (error) {
		console.error('Google Signin Error:', error)
		return res.status(500).json({ message: 'Google login failed' })
	}
}

export const signup = async (req, res) => {
	try {
		const { email, password, provider = 'local' } = req.body

		// Validate required fields
		if (!email || !provider) {
			return res
				.status(400)
				.json({ message: 'Email and provider are required.' })
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

		// Check if user already exists
		const existingUser = await User.findOne({ email })
		if (existingUser) {
			return res.status(400).json({ message: 'User already exists.' })
		}

		// Hash password if local
		let hashedPassword = null
		if (provider === 'local') {
			const salt = await bcrypt.genSalt(10)
			hashedPassword = await bcrypt.hash(password, salt)
		}

		// Create user (name will be set later in profile setup)
		const newUser = new User({
			email,
			password: hashedPassword,
			provider,
			profileSetup: false,
		})

		await newUser.save()

		// Set JWT cookie
		generateToken(newUser._id, res)

		// Respond with user info
		res.status(201).json({
			_id: newUser._id,
			email: newUser.email,
			provider: newUser.provider,
			profileSetup: newUser.profileSetup,
		})
	} catch (error) {
		console.error('Error in signup controller:', error)
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

		// Check password
		const isPasswordCorrect = await bcrypt.compare(password, user.password)
		if (!isPasswordCorrect) {
			return res.status(400).json({ message: 'Credentials are not valid' })
		}

		// Generate token (cookie or JWT)
		generateToken(user._id, res)

		// Return user data
		res.status(200).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			profileSetup: user.profileSetup,
		})
	} catch (error) {
		console.error('Error in login controller:', error)
		res.status(500).json({ message: 'Internal server error' })
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

export const setupProfile = async (req, res) => {
	try {
		const { name, password, avatar } = req.body
		const userId = req.user._id

		const user = await User.findById(userId)
		if (!user) return res.status(404).json({ message: 'User not found' })

		if (name) user.name = name

		if (password && password.length >= 6) {
			const salt = await bcrypt.genSalt(10)
			user.password = await bcrypt.hash(password, salt)
		}

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
				email: user.email,
				avatar: user.avatar,
			},
		})
	} catch (error) {
		console.error('Profile setup error:', error)
		res.status(500).json({ message: 'Failed to update profile' })
	}
}
