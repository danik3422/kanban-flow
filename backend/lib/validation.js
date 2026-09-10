import { z } from 'zod'

const email = z.string().trim().email().transform((value) => value.toLowerCase())
const password = z.string().min(8).max(128)

export const signupSchema = z.object({
	email,
	password,
	provider: z.literal('local').default('local'),
})

export const loginSchema = z.object({
	email,
	password: z.string().min(1).max(128),
})

export const socialAuthSchema = z.object({
	idToken: z.string().min(1).max(10000),
	provider: z.enum(['google', 'microsoft', 'apple']),
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

export const setupProfileSchema = z.object({
	name: z.string().trim().min(1).max(120),
	jobTitle: z.string().trim().max(120).optional(),
	timezone: z.string().trim().min(1).max(64).optional(),
	avatar: z.string().max(150000).nullable().optional(),
}).strict()

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: password,
})
