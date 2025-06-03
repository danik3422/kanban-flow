import bcrypt from 'bcrypt'
import { generateToken } from '../lib/utils.js'
import User from '../models/user.model.js'
export const signup = async (req, res) => {
	try {
		const { name, email, password } = req.body

		if (!name || !email || !password) {
			return res.status(400).json({ message: 'All fields are required.' })
		}

		if (password.length < 6) {
			return res
				.status(400)
				.json({ message: 'Password must be at least 6 characters long.' })
		}

		const user = await User.findOne({ email })

		if (user) {
			return res.status(400).json({ message: 'User already exists.' })
		}

		const salt = await bcrypt.genSalt(10)
		const hashedPassword = await bcrypt.hash(password, salt)

		const newUser = new User({
			name,
			email,
			password: hashedPassword,
		})

		if (newUser) {
			generateToken(newUser._id, res)
			await newUser.save()
			res.status(201).json({ message: 'User created successfully' })
		} else {
			res.status(400).json({ message: 'User creation failed.' })
		}
	} catch (error) {
		console.log('Error in signup controller', error.message)
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
