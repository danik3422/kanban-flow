import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'

export const generateToken = (userId, res, sessionVersion = 0) => {
	const token = jwt.sign({ userId, sessionVersion: Number(sessionVersion || 0) }, env.jwtSecret, {
		expiresIn: '7d',
	})

	res.cookie('jwt', token, {
		httpOnly: true,
		maxAge: 7 * 24 * 60 * 60 * 1000,
		sameSite: 'strict',
		secure: env.isProduction,
	})

	return token
}
