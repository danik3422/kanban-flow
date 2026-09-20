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
