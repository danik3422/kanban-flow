import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'

const authCookieOptions = () => ({
	httpOnly: true,
	sameSite: 'strict',
	// Browsers accept Secure cookies on http://localhost, so only local work goes without it.
	secure: !env.isLocalEnvironment,
})

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Sign-ins go through services/sessions.service.js, which records the device and passes its sid here.
export const generateToken = (userId, res, sessionVersion = 0, sid = undefined) => {
	const token = jwt.sign({ userId, sessionVersion: Number(sessionVersion || 0), ...(sid && { sid }) }, env.jwtSecret, {
		expiresIn: '7d',
	})

	// One request can sign in twice (an old cookie upgraded, then renewed): only the last counts.
	const previous = res.getHeader('Set-Cookie')
	if (previous) res.setHeader('Set-Cookie', [].concat(previous).filter((value) => !String(value).startsWith('jwt=')))
	res.cookie('jwt', token, {
		...authCookieOptions(),
		maxAge: SESSION_MAX_AGE_MS,
	})

	return token
}

// Browsers only drop a cookie when the clearing attributes match the ones it was set with.
export const clearAuthCookie = (res) => {
	res.clearCookie('jwt', authCookieOptions())
}
