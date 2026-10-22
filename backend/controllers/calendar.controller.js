import { calendarFor, currentCalendarToken, issueCalendarToken, revokeCalendarToken, userForCalendarToken } from '../services/calendarFeed.service.js'

// The calendar link: turned on, reset and off from the app, and read by calendar apps.

/** GET /api/calendar/link: `{ token }`, null while the link is off. */
export const getCalendarLink = async (req, res) => {
	try {
		return res.status(200).json({ token: await currentCalendarToken(req.user._id) })
	} catch (error) {
		console.error('Calendar link lookup failed:', error)
		return res.status(500).json({ message: 'Could not load the calendar link' })
	}
}

/** POST /api/calendar/link: turns the link on; `{ reset: true }` gives it a new address. */
export const createCalendarLink = async (req, res) => {
	try {
		return res.status(200).json({ token: await issueCalendarToken(req.user._id, { reset: req.body?.reset === true }) })
	} catch (error) {
		console.error('Calendar link creation failed:', error)
		return res.status(500).json({ message: 'Could not create the calendar link' })
	}
}

export const deleteCalendarLink = async (req, res) => {
	try {
		await revokeCalendarToken(req.user._id)
		return res.status(204).send()
	} catch (error) {
		console.error('Calendar link removal failed:', error)
		return res.status(500).json({ message: 'Could not turn the calendar link off' })
	}
}

/**
 * GET /api/calendar/:token.ics — what calendar apps subscribe to. `?scope=all` or
 * `?board=<id>` widen or narrow it; `?done=0` leaves finished cards out.
 */
export const serveCalendar = async (req, res) => {
	try {
		const user = await userForCalendarToken(req.params.token)
		if (!user) return res.status(404).type('text/plain').send('Calendar link not found')
		const scope = typeof req.query.board === 'string' && /^[a-f\d]{24}$/i.test(req.query.board)
			? req.query.board
			: req.query.scope === 'all' ? 'all' : 'mine'
		const calendar = await calendarFor(user, { scope, done: req.query.done !== '0' })
		if (!calendar) return res.status(404).type('text/plain').send('Board not found')
		res.set({
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="kanbanhub.ics"',
			'Cache-Control': 'private, max-age=300',
			'X-Robots-Tag': 'noindex',
		})
		return res.status(200).send(calendar)
	} catch (error) {
		console.error('Calendar feed failed:', error)
		return res.status(500).type('text/plain').send('Could not build the calendar')
	}
}
