import { z } from 'zod'

import { email } from './fields.js'

export const passwordSchema = z.string().min(8).max(128)

export const signupSchema = z.object({
	email,
	password: passwordSchema,
	provider: z.literal('local').default('local'),
	// The language chosen on the sign-up screen, so the account starts in it.
	language: z.enum(['en', 'uk', 'ru']).optional(),
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
	currentPassword: z.string().min(1).max(128).optional(),
})

export const passwordResetRequestSchema = z.object({ email })

export const resendVerificationSchema = z.object({ email })

export const verifyEmailSchema = z.object({ token: z.string().length(64) })

export const passwordResetConfirmSchema = z.object({
	token: z.string().length(64),
	password: passwordSchema,
})

export const settingsSchema = z.object({
	emailNotifications: z.boolean().optional(),
	emailFrequency: z.enum(['never', 'periodic', 'instant']).optional(),
	desktopNotifications: z.boolean().optional(),
	emailPreferences: z.object({
		comments: z.boolean(),
		dueDates: z.boolean(),
		removed: z.boolean(),
		cardsCreated: z.boolean(),
		cardsMoved: z.boolean(),
	}).partial().strict().optional(),
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

export const reauthenticateSchema = z.union([
	z.object({ currentPassword: z.string().min(1).max(128) }).strict(),
	z.object({ idToken: z.string().min(1).max(8192), provider: z.enum(['google', 'microsoft', 'apple']) }).strict(),
])

export const disconnectSocialSchema = z.object({
	currentPassword: z.string().max(128).optional(),
}).strict()

export const setSocialPasswordSchema = z.object({
	idToken: z.string().min(1).max(10000),
	provider: z.enum(['google', 'microsoft', 'apple']),
	password: passwordSchema,
	currentPassword: z.string().max(128).optional(),
})
export const passkeyAuthOptionsSchema = z.object({
	email: z.union([email, z.literal('')]).optional(),
})

// The full WebAuthn assertion is passed through to the verifier untouched.
export const passkeyAuthenticateSchema = z.looseObject({
	id: z.string().min(1).max(1024),
	response: z.looseObject({
		clientDataJSON: z.string().min(1).max(10000),
	}),
})

const passkeyName = z.string().trim().max(60, 'Passkey name is too long')

// The WebAuthn attestation is passed to the verifier untouched; the name rides along.
export const verifyPasskeySchema = z.looseObject({
	id: z.string().min(1).max(1024),
	response: z.looseObject({}),
	passkeyName: passkeyName.optional(),
})

export const renamePasskeySchema = z.object({
	name: passkeyName.min(1, 'Give the passkey a name'),
})

export const removePasskeySchema = z.object({
	currentPassword: z.string().max(128).optional(),
})
