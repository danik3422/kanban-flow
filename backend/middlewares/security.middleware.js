import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const rateLimitResponse = {
	message: 'Too many requests. Please try again later. Please wait a few minutes and try again.',
}

const getRateLimitKey = (req) => ipKeyGenerator(req.ip)

const verificationRateLimitHandler = (req, res) => {
	const resetTime = req.rateLimit?.resetTime?.getTime?.() || Date.now()
	const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
	res.set('Retry-After', String(retryAfter))
	return res.status(429).json({
		message: 'Too many verification email requests. Please wait before trying again.',
		retryAfter,
	})
}

export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 1000,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	keyGenerator: getRateLimitKey,
})

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	skipSuccessfulRequests: false,
	keyGenerator: getRateLimitKey,
})

export const passwordResetLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 60,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	skipSuccessfulRequests: true,
	keyGenerator: getRateLimitKey,
})

export const passwordChangeLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 8,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: {
		message: 'Too many password change attempts. Please try again later.',
	},
	skipSuccessfulRequests: false,
	keyGenerator: getRateLimitKey,
})

export const verificationEmailIpLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	keyGenerator: getRateLimitKey,
	handler: verificationRateLimitHandler,
})

export const verificationEmailLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	keyGenerator: (req) => req.body.email,
	handler: verificationRateLimitHandler,
})

const emailKey = (req) => `email:${String(req.body?.email || '').toLowerCase()}`

// The reset request always answers 200 so it cannot reveal accounts; count every
// request, otherwise the limit never applies and a mailbox can be flooded.
export const passwordResetRequestLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	keyGenerator: getRateLimitKey,
})

export const passwordResetEmailLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 3,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	keyGenerator: emailKey,
})

// Per-account brute-force guard that holds even when guesses come from many IPs.
export const loginEmailLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { message: 'Too many failed sign-in attempts for this account. Please wait 15 minutes or reset your password.' },
	skipSuccessfulRequests: true,
	keyGenerator: emailKey,
})

// Invites send email from our domain, so cap how many one person can send.
export const inviteLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { message: 'Too many invitations. Please wait a few minutes and try again.' },
	keyGenerator: (req) => `user:${req.user?._id}`,
})
