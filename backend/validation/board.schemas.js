import { z } from 'zod'

import { email, objectId, position } from './fields.js'

const boardName = z.string().trim().min(1, 'Board name is required').max(100, 'Board name is too long')
const boardVisibility = z.enum(['private', 'workspace', 'public'])
const columnTitle = z.string().trim().min(1, 'Column title is required').max(60, 'Column title must be 60 characters or fewer')

// How a photo is shown; the server clamps every value again.
const backgroundAdjust = z.object({
	x: z.number().min(0).max(100).optional(),
	y: z.number().min(0).max(100).optional(),
	blur: z.number().min(0).max(24).optional(),
	dim: z.number().min(0).max(80).optional(),
	brightness: z.number().min(50).max(150).optional(),
	saturate: z.number().min(0).max(200).optional(),
}).strict()

const boardBackground = z.union([
	z.object({ type: z.enum(['gradient', 'color']), key: z.string().max(32) }),
	// An uploaded photo can only be kept or adjusted here; new ones go through the upload route.
	z.object({
		type: z.literal('upload'),
		url: z.string().max(1000),
		thumb: z.string().max(1000).optional(),
		color: z.string().max(16).optional(),
		adjust: backgroundAdjust.optional(),
	}),
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
		adjust: backgroundAdjust.optional(),
	}),
]).nullable()

export const backgroundUploadSchema = z.object({
	image: z.string().max(7 * 1024 * 1024),
	thumb: z.string().max(400 * 1024),
	color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
}).strict()

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
