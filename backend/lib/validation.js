import { z } from 'zod'

const email = z.string().trim().email().transform((value) => value.toLowerCase())
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

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID')
const boardName = z.string().trim().min(1, 'Board name is required').max(100, 'Board name is too long')
const boardVisibility = z.enum(['private', 'workspace', 'public'])
const columnTitle = z.string().trim().min(1, 'Column title is required').max(60, 'Column title must be 60 characters or fewer')
const position = z.number().int().min(0)
const taskPriority = z.enum(['none', 'low', 'medium', 'high', 'urgent'])
const taskFields = {
	title: z.string().trim().min(1, 'Task title is required').max(200, 'Task title must be 200 characters or fewer'),
	description: z.string().max(20000, 'Description is too long'),
	dueDate: z.union([z.iso.date(), z.iso.datetime({ offset: true }), z.literal(''), z.null()])
		.transform((value) => value || null),
	assignees: z.array(objectId).max(50),
	labels: z.array(z.string().trim().min(1).max(40)).max(20),
	checklist: z.array(z.object({
		_id: objectId.optional(),
		text: z.string().trim().min(1).max(300),
		completed: z.boolean().default(false),
	})).max(100),
	position,
	priority: taskPriority,
}

const boardBackground = z.union([
	z.object({ type: z.enum(['gradient', 'color']), key: z.string().max(32) }),
	z.object({
		type: z.literal('photo'),
		id: z.string().max(64),
		url: z.string().max(1000).optional(),
		thumb: z.string().max(1000).optional(),
		color: z.string().max(16).optional(),
		author: z.string().max(120).optional(),
		authorUrl: z.string().max(600).optional(),
		downloadLocation: z.string().max(600).optional(),
		source: z.string().max(40).optional(),
		license: z.string().max(60).optional(),
	}),
]).nullable()

export const createBoardSchema = z.object({
	name: boardName,
	visibility: boardVisibility.default('private'),
	background: boardBackground.optional(),
})

export const updateBoardSchema = z.object({
	name: boardName.optional(),
	description: z.string().max(1000, 'The description is too long').optional(),
	visibility: boardVisibility.optional(),
	background: boardBackground.optional(),
})

export const copyBoardSchema = z.object({
	name: boardName,
	keepCards: z.boolean().default(true),
})

export const createInviteSchema = z.object({
	email: z.union([email, z.literal('')]).default(''),
	role: z.enum(['admin', 'member']).default('member'),
})

export const memberRoleSchema = z.object({
	role: z.enum(['owner', 'admin', 'member']),
})

export const createColumnSchema = z.object({
	title: columnTitle,
	position: position.default(0),
})

export const updateColumnSchema = z.object({
	title: columnTitle.optional(),
	pinned: z.boolean().optional(),
	color: z.enum(['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'gray']).nullable().optional(),
})

export const copyColumnSchema = z.object({ title: columnTitle })
export const moveColumnTasksSchema = z.object({ targetColumnId: objectId })
export const watchColumnSchema = z.object({ watching: z.boolean() })

export const columnPositionSchema = z.object({ position })

export const columnSortSchema = z.object({
	sortBy: z.enum(['date-newest', 'date-oldest', 'name-alpha', 'due-date', 'priority', 'custom']).nullable(),
})

export const reorderTasksSchema = z.object({
	columns: z.array(z.object({
		columnId: objectId,
		taskIds: z.array(objectId).max(2000),
	})).min(1, 'Task order is required').max(100),
})

export const createTaskSchema = z.object({
	title: taskFields.title,
	description: taskFields.description.default(''),
	dueDate: taskFields.dueDate.optional(),
	assignees: taskFields.assignees.default([]),
	labels: taskFields.labels.default([]),
	checklist: taskFields.checklist.default([]),
	position: position.default(0),
	priority: taskPriority.default('none'),
})

export const updateTaskSchema = z.object({
	...Object.fromEntries(Object.entries(taskFields).map(([key, schema]) => [key, schema.optional()])),
	column: objectId.optional(),
})

export const taskCommentSchema = z.object({
	message: z.string().trim().min(1, 'Comment is required').max(2000, 'Comment is too long'),
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
