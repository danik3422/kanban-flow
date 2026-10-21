import { emitUserEvent } from '../../lib/realtime.js'
import Session from '../../models/session.model.js'
import User from '../../models/user.model.js'
import {
	assertCurrentPassword,
	assertFreshProviderToken,
	verifySocialProviderToken,
} from '../../services/authChecks.service.js'
import { endOtherSessions, endSession, listSessions, renewSession } from '../../services/sessions.service.js'

// Signed-in devices, and confirming identity again before sensitive changes.

/** Every device signed in to this account, this one first. */
export const getSessions = async (req, res) => {
	try {
		const sessions = await listSessions(req.user._id, req.sessionId)
		sessions.sort((a, b) => Number(b.current) - Number(a.current))
		return res.status(200).json(sessions)
	} catch (error) {
		console.error('Listing sessions failed:', error)
		return res.status(500).json({ message: 'Could not load your devices' })
	}
}

/** Signs out one other device. This device signs out with the usual log out. */
export const revokeSession = async (req, res) => {
	try {
		if (req.params.id === 'current') return res.status(400).json({ message: 'Use log out to sign out this device.' })
		if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Device not found' })
		const session = await Session.findOne({ _id: req.params.id, user: req.user._id }).select('sid')
		if (!session) return res.status(404).json({ message: 'Device not found' })
		if (session.sid === req.sessionId) return res.status(400).json({ message: 'Use log out to sign out this device.' })
		await endSession(session.sid)
		return res.status(204).send()
	} catch (error) {
		console.error('Signing out a device failed:', error)
		return res.status(500).json({ message: 'Could not sign out that device' })
	}
}

// Ends every other session: bumping the version invalidates all issued tokens, this
// device gets a fresh one, and open tabs elsewhere are told to check their session.
export const signOutOtherSessions = async (req, res) => {
	try {
		const user = await User.findByIdAndUpdate(req.user._id, { $inc: { sessionVersion: 1 } }, { returnDocument: 'after' }).select('sessionVersion')
		if (!user) return res.status(404).json({ message: 'User not found' })
		const count = await endOtherSessions(user._id, req.sessionId, res)
		await renewSession(res, user, req.sessionId)
		// Only after this device has its new cookie, so it never checks with the old one.
		res.on('finish', () => emitUserEvent(user._id.toString(), 'session:changed', {}))
		return res.status(200).json({ signedOut: count })
	} catch (error) {
		console.error('Signing out other sessions failed:', error)
		return res.status(500).json({ message: 'Could not sign out other sessions' })
	}
}

export const reauthenticate = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('password provider providerUid linkedProviders')
		if (!user) return res.status(401).json({ message: 'Re-authentication required.' })
		if (user.password) {
			await assertCurrentPassword(user, req.body.currentPassword)
		} else {
			// No password: a fresh sign-in with one of this account's own providers.
			const { idToken, provider } = req.body
			if (!idToken || !provider) return res.status(401).json({ message: 'Re-authentication required.' })
			const decodedToken = await verifySocialProviderToken(idToken, provider)
			assertFreshProviderToken(decodedToken)
			const uid = String(decodedToken.uid)
			const ownsIdentity =
				(user.provider === provider && String(user.providerUid) === uid) ||
				user.linkedProviders?.some((link) => link.provider === provider && String(link.providerUid) === uid)
			if (!ownsIdentity) return res.status(401).json({ message: 'Re-authentication failed.' })
		}
		await User.updateOne({ _id: user._id }, { $set: { lastReauthenticatedAt: new Date() } })
		return res.status(204).send()
	} catch (error) {
		return res.status(error.statusCode || 401).json({ message: 'Re-authentication failed.' })
	}
}
