import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import { env } from '../config/env.js'
import { publicUserFields } from '../lib/userProjection.js'

export const authMiddleware = async (req, res, next) => {
	try {
		const token = req.cookies.jwt

		if (!token) {
			return res
				.status(401)
				.json({ message: 'Unauthorized - No token provided' })
		}

		const decoded = jwt.verify(token, env.jwtSecret)

		if (!decoded) {
			return res.status(401).json({ message: 'Unauthorized - Invalid token' })
		}

		const user = await User.findById(decoded.userId).select(`${publicUserFields} sessionVersion`)

		if (!user) {
			return res.status(401).json({
				message: 'Unauthorized - User not found',
			})
		}
		if (Number(decoded.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
			return res.status(401).json({ message: 'Unauthorized - Session expired' })
		}

		const publicUser = user.toObject()
		delete publicUser.sessionVersion
		req.user = publicUser

		next()
	} catch (error) {
		console.error('Authentication error:', error)
		res.status(401).json({ message: 'Unauthorized' })
	}
}
