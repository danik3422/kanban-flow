import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import Session from '../models/session.model.js'

// Sessions handed out by sessionCookie() that are not in the database yet.
// test/setup.js records each one just before the first request that uses it.
export const pendingSessions = new Map()

/** A signed-in cookie for a user, like the one a real sign-in sets. */
export const sessionCookie = (userId, sessionVersion = 0) => {
	const sid = crypto.randomBytes(12).toString('base64url')
	pendingSessions.set(sid, userId.toString())
	return [`jwt=${jwt.sign({ userId: userId.toString(), sessionVersion, sid }, env.jwtSecret)}`]
}

export const recordPendingSession = async (cookieHeader) => {
	const token = /(?:^|;\s*)jwt=([^;]+)/.exec(String(cookieHeader || ''))?.[1]
	const sid = token && jwt.decode(token)?.sid
	const user = sid && pendingSessions.get(sid)
	if (!user) return
	pendingSessions.delete(sid)
	await Session.create({ user, sid, method: 'password', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
}
