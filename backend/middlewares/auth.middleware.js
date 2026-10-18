import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import { env } from '../config/env.js'
import { resolveSession } from '../lib/sessions.js'
import { publicUserFields } from '../lib/userProjection.js'

export const authMiddleware = async (req, res, next) => {
	try {
		const token = req.cookies.jwt

		if (!token) {
			return res
				.status(401)
				.json({ message: 'Unauthorized - No token provided' })
		}

		const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })

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
		// This device may have been signed out from another one.
		const session = await resolveSession(req, res, user, decoded)
		if (!session) {
			return res.status(401).json({ message: 'Unauthorized - Session expired' })
		}

		const publicUser = user.toObject()
		delete publicUser.sessionVersion
		req.user = publicUser
		req.sessionId = session.sid

		next()
	} catch (error) {
		console.error('Authentication error:', error)
		res.status(401).json({ message: 'Unauthorized' })
	}
}

export const verifiedAuthMiddleware = (req, res, next) => {
	authMiddleware(req, res, () => {
		if (!req.user.emailVerified) {
			return res.status(403).json({
				message: 'Email verification is required for this action.',
				code: 'email_verification_required',
			})
		}
		next()
	})
}

// For public pages that read better when they know the visitor: sets req.user when the
// session is valid and quietly continues without it otherwise.
export const optionalAuthMiddleware = async (req, res, next) => {
	try {
		const token = req.cookies.jwt
		if (!token) return next()
		const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
		const user = await User.findById(decoded?.userId).select(`${publicUserFields} sessionVersion`)
		if (user && Number(decoded.sessionVersion || 0) === Number(user.sessionVersion || 0) && await resolveSession(req, null, user, decoded)) {
			const publicUser = user.toObject()
			delete publicUser.sessionVersion
			req.user = publicUser
		}
	} catch {
		// An expired or foreign cookie just means a signed-out visitor here.
	}
	return next()
}
