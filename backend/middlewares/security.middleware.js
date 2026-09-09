import rateLimit from 'express-rate-limit'

const rateLimitResponse = {
	message: 'Too many requests. Please try again later.',
}

export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 300,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
})

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	skipSuccessfulRequests: false,
})

export const passwordResetLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: rateLimitResponse,
	skipSuccessfulRequests: true,
})
