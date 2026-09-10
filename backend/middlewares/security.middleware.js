import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const rateLimitResponse = {
	message: 'Too many requests. Please try again later. Please wait a few minutes and try again.',
}

const getRateLimitKey = (req) => ipKeyGenerator(req.ip)

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
