import bcrypt from 'bcrypt'
import admin from '../lib/firebaseAdmin.js'
import { generateToken } from '../lib/utils.js'
import User from '../models/user.model.js'

export const googleAuth = async (req, res) => {
	try {
		const { idToken } = req.body

		if (!idToken) return res.status(400).json({ message: 'Missing ID token' })

		const decodedToken = await admin.auth().verifyIdToken(idToken)
		const { email, name, picture, uid } = decodedToken

		if (!email) return res.status(400).json({ message: 'Invalid token' })

		// Check if user exists
		let user = await User.findOne({ email })

		if (!user) {
			// Create user if not found
			user = new User({
				email,
				name,
				avatar: picture,
				provider: 'google',
			})
			await user.save()
		}

		// Set cookie and respond
		generateToken(user._id, res)

		res.status(200).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
		})
	} catch (error) {
		console.error('Google Auth Error:', error)
		res.status(500).json({ message: 'Google login failed' })
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
				return res.status(400).json({
					message: 'Password must be at least 6 characters long.',
				})
			}
		}

		// Check if user already exists
		const existingUser = await User.findOne({ email })
		if (existingUser) {
			return res.status(400).json({ message: 'User already exists.' })
		}

		// Hash password if using local sign up
		let hashedPassword = null
		if (provider === 'local') {
			const salt = await bcrypt.genSalt(10)
			hashedPassword = await bcrypt.hash(password, salt)
		}

		// Create user with an unset name and default profileSetup=false
		const newUser = new User({
			email,
			password: hashedPassword,
			provider,
			name: '', // no name yet
			profileSetup: false, // setup flag false
		})

		await newUser.save()

		// Create JWT in cookie
		generateToken(newUser._id, res)

		// Respond with user data including profileSetup status
		res.status(201).json({
			_id: newUser._id,
			email: newUser.email,
			name: newUser.name,
			provider: newUser.provider,
			profileSetup: newUser.profileSetup,
		})
	} catch (error) {
		console.error('Error in signup controller:', error.message)
		res.status(500).json({ message: 'Server error during signup' })
	}
}

export const login = async (req, res) => {
	const { email, password } = req.body

	try {
		const user = await User.findOne({ email })
		if (!user) {
			return res.status(400).json({
				message: 'Credentials are not valid',
			})
		}

		const isPasswordCorrect = await bcrypt.compare(password, user.password)

		if (!isPasswordCorrect) {
			return res.status(400).json({
				message: 'Credentials are not valid',
			})
		}

		generateToken(user._id, res)

		res.status(200).json({
			_id: user._id,
			email: user.email,
			name: user.name,
			profileSetup: user.profileSetup,
		})
	} catch (error) {
		console.log('Error in login controller', error.message)
		res.status(500).json({
			message: 'Internal server error',
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
