import { env } from '../config/env.js'

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const getOriginFromReferer = (referer) => {
	try {
		return new URL(referer).origin
	} catch {
		return null
	}
}

export const csrfProtection = (req, res, next) => {
	if (!unsafeMethods.has(req.method)) return next()

	const requestOrigin = req.get('origin') || getOriginFromReferer(req.get('referer'))
	if (requestOrigin && !env.corsOrigin.includes(requestOrigin)) {
		return res.status(403).json({ message: 'Cross-site request blocked' })
	}
	// Without Origin or Referer, ask for the header our client always sends. Another site
	// cannot add it without a CORS preflight, which only our own origins pass.
	if (!requestOrigin && req.get('x-requested-with') !== 'XMLHttpRequest') {
		return res.status(403).json({ message: 'Cross-site request blocked' })
	}

	next()
}
