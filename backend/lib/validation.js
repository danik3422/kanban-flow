import { z } from 'zod'

const email = z.string().trim().email().transform((value) => value.toLowerCase())
const password = z.string().min(8).max(128)

export const signupSchema = z.object({
	email,
	password,
	provider: z.enum(['local', 'google', 'microsoft', 'apple']).default('local'),
})

export const loginSchema = z.object({
	email,
	password: z.string().min(1).max(128),
})

export const googleAuthSchema = z.object({
	idToken: z.string().min(1).max(10000),
})

export const passwordResetRequestSchema = z.object({ email })

export const passwordResetConfirmSchema = z.object({
	token: z.string().length(64),
	password,
})

export const settingsSchema = z.object({
	emailNotifications: z.boolean().optional(),
	taskNotifications: z.boolean().optional(),
	weeklyDigest: z.boolean().optional(),
	language: z.enum(['en', 'uk', 'ru']).optional(),
})
