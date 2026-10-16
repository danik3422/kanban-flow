import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'

const authCookieOptions = () => ({
	httpOnly: true,
	sameSite: 'strict',
	// Browsers accept Secure cookies on http://localhost, so only local work goes without it.
	secure: !env.isLocalEnvironment,
})

export const generateToken = (userId, res, sessionVersion = 0) => {
	const token = jwt.sign({ userId, sessionVersion: Number(sessionVersion || 0) }, env.jwtSecret, {
		expiresIn: '7d',
	})

	res.cookie('jwt', token, {
		...authCookieOptions(),
		maxAge: 7 * 24 * 60 * 60 * 1000,
	})

	return token
}

// Browsers only drop a cookie when the clearing attributes match the ones it was set with.
export const clearAuthCookie = (res) => {
	res.clearCookie('jwt', authCookieOptions())
}
