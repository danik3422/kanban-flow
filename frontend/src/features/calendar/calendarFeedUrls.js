import { apiBaseUrl } from '../../lib/runtimeConfig'

// Addresses of the calendar link (backend services/calendarFeed.service.js). The file
// lives on the API server, so the address is built from where the app talks to it.

/** The https address of the calendar file: `scope` "mine" or "all", or a `board` id. */
export const feedUrl = (token, { scope = 'mine', board = null, done = true } = {}) => {
	const url = new URL(`${apiBaseUrl}/calendar/${token}.ics`, window.location.origin)
	if (board) url.searchParams.set('board', board)
	else if (scope === 'all') url.searchParams.set('scope', 'all')
	if (!done) url.searchParams.set('done', '0')
	return url.toString()
}

/** The same address for calendar apps that subscribe on a click (Apple Calendar). */
export const webcalUrl = (url) => url.replace(/^https?:/, 'webcal:')

export const googleCalendarUrl = (url) => `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(url))}`

export const outlookCalendarUrl = (url, name) => `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`

/** Google and Outlook fetch the file from their own servers, which cannot reach this computer. */
export const isLocalAddress = (url) => {
	const { hostname } = new URL(url)
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local') || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname)
}
