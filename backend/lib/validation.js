import { z } from 'zod'

const email = z.string().trim().email().transform((value) => value.toLowerCase())
export const passwordSchema = z.string().min(8).max(128)

export const signupSchema = z.object({
	email,
	password: passwordSchema,
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

export const connectSocialSchema = socialAuthSchema.extend({
	currentPassword: z.string().min(1).max(128),
})

export const passwordResetRequestSchema = z.object({ email })

export const resendVerificationSchema = z.object({ email })

export const passwordResetConfirmSchema = z.object({
	token: z.string().length(64),
	password: passwordSchema,
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
	avatar: z.string().max(200000).nullable().optional(),
	removeAvatar: z.boolean().optional(),
}).strict()

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: passwordSchema,
})

export const reauthenticateSchema = z.object({
	currentPassword: z.string().min(1).max(128),
}).strict()

export const disconnectSocialSchema = z.object({
	currentPassword: z.string().max(128).optional(),
}).strict()

export const setSocialPasswordSchema = z.object({
	idToken: z.string().min(1).max(10000),
	provider: z.enum(['google', 'microsoft', 'apple']),
	password: passwordSchema,
	currentPassword: z.string().max(128).optional(),
})
