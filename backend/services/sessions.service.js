import crypto from 'node:crypto'
import Session from '../models/session.model.js'
import { disconnectSession, emitUserEvent } from '../lib/realtime.js'
import { generateToken, SESSION_MAX_AGE_MS } from './authCookie.service.js'

const LAST_SEEN_STEP_MS = 5 * 60 * 1000

const sessionDetails = (req) => ({
	userAgent: String(req.get?.('user-agent') || '').slice(0, 400),
	ip: String(req.ip || '').replace(/^::ffff:/, '').slice(0, 64),
})

/** Signs this device in: a new session record and a cookie that names it. */
export const startSession = async (req, res, user, method = 'password') => {
	const sid = crypto.randomBytes(18).toString('base64url')
	await Session.create({ user: user._id, sid, method, ...sessionDetails(req), expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS) })
	generateToken(user._id, res, user.sessionVersion, sid)
	// Open "Signed-in devices" lists show the new device straight away.
	emitUserEvent(user._id.toString(), 'sessions:updated', {})
	return sid
}

/** Same device, new cookie (after a password change or signing others out). */
export const renewSession = (res, user, sid) => {
	generateToken(user._id, res, user.sessionVersion, sid)
	return Session.updateOne({ sid }, { $set: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS), lastSeenAt: new Date() } })
}

/** The session a cookie names, or null when it was signed out (or never had one). */
export const resolveSession = async (req, user, decoded) => {
	if (!decoded.sid) return null
	const session = await Session.findOne({ sid: decoded.sid, user: user._id }).select('sid lastSeenAt')
	if (!session) return null
	if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_STEP_MS) {
		await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date(), ...sessionDetails(req) } })
	}
	return { sid: session.sid }
}

export const endSession = async (sid) => {
	if (!sid) return
	const session = await Session.findOneAndDelete({ sid }).select('user')
	disconnectSession(sid)
	if (session) emitUserEvent(session.user.toString(), 'sessions:updated', {})
}

/**
 * Signs out every device of a user, except the one named (if any). Pass the response
 * when this device gets a new cookie: the others hear about it only once that is sent,
 * so this device never checks in with its old cookie.
 */
export const endOtherSessions = async (userId, keepSid = null, res = null) => {
	const others = await Session.find({ user: userId, ...(keepSid ? { sid: { $ne: keepSid } } : {}) }).select('sid')
	await Session.deleteMany({ _id: { $in: others.map((session) => session._id) } })
	const notify = () => {
		for (const session of others) disconnectSession(session.sid)
		if (others.length) emitUserEvent(userId.toString(), 'sessions:updated', {})
	}
	if (res) res.on('finish', notify)
	else notify()
	return others.length
}

// "Chrome", "macOS", "desktop" from a user agent: enough to tell devices apart.
export const describeUserAgent = (userAgent = '') => {
	const ua = userAgent
	const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
		: /OPR\/|Opera/.test(ua) ? 'Opera'
			: /YaBrowser\//.test(ua) ? 'Yandex Browser'
				: /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
					: /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
						: /Chrome\/|CriOS\//.test(ua) ? 'Chrome'
							: /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari'
								: ''
	const os = /iPad/.test(ua) ? 'iPadOS'
		: /iPhone|iPod/.test(ua) ? 'iOS'
			: /Android/.test(ua) ? 'Android'
				: /CrOS/.test(ua) ? 'ChromeOS'
					: /Mac OS X|Macintosh/.test(ua) ? 'macOS'
						: /Windows/.test(ua) ? 'Windows'
							: /Linux/.test(ua) ? 'Linux'
								: ''
	const type = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet'
		: /Mobile|iPhone|Android/.test(ua) ? 'phone'
			: browser || os ? 'desktop' : 'unknown'
	return { browser, os, type }
}

export const listSessions = async (userId, currentSid) => {
	const sessions = await Session.find({ user: userId }).sort({ lastSeenAt: -1 }).lean()
	return sessions.map((session) => ({
		id: session.sid === currentSid ? 'current' : session._id.toString(),
		current: session.sid === currentSid,
		...describeUserAgent(session.userAgent),
		// Loopback means the same machine as the server: nothing worth showing.
		ip: ['::1', '127.0.0.1', ''].includes(session.ip) ? '' : session.ip,
		method: session.method,
		createdAt: session.createdAt,
		lastSeenAt: session.lastSeenAt,
	}))
}
