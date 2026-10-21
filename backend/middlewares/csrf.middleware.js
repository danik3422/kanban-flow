import { env } from '../config/env.js'

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const getOriginFromReferer = (referer) => {
	try {
		return new URL(referer).origin
	} catch {
		return null
	}
}

// The page was served by this very server (self-hosting serves the web app itself),
// whatever address it was opened at: localhost, a LAN IP or a domain.
export const isSameOrigin = (origin, host) => {
	try {
		return Boolean(origin && host) && new URL(origin).host === host
	} catch {
		return false
	}
}

export const isAllowedOrigin = (origin, host) => env.corsOrigin.includes(origin) || isSameOrigin(origin, host)

export const csrfProtection = (req, res, next) => {
	if (!unsafeMethods.has(req.method)) return next()

	const requestOrigin = req.get('origin') || getOriginFromReferer(req.get('referer'))
	if (requestOrigin && !isAllowedOrigin(requestOrigin, req.get('host'))) {
		return res.status(403).json({ message: 'Cross-site request blocked' })
	}
	// Without Origin or Referer, ask for the header our client always sends. Another site
	// cannot add it without a CORS preflight, which only our own origins pass.
	if (!requestOrigin && req.get('x-requested-with') !== 'XMLHttpRequest') {
		return res.status(403).json({ message: 'Cross-site request blocked' })
	}

	next()
}
