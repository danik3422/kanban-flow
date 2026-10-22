import { z } from 'zod'

import { objectId, position } from './fields.js'

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
	startDate: z.union([z.iso.date(), z.iso.datetime({ offset: true }), z.literal(''), z.null()])
		.transform((value) => value || null),
	completed: z.boolean(),
	estimateMinutes: z.number().int().min(0).max(100000),
	repeat: z.object({
		frequency: z.enum(['daily', 'weekdays', 'weekly', 'monthly', 'yearly']),
		interval: z.number().int().min(1).max(99).default(1),
		days: z.array(z.number().int().min(1).max(7)).max(7).optional(),
		until: z.union([z.iso.date(), z.null()]).optional(),
	}).nullable(),
	cover: z.union([
		z.object({ type: z.literal('color'), key: z.enum(['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'gray']), size: z.enum(['strip', 'full']).default('strip') }),
		z.object({
			type: z.literal('photo'),
			id: z.string().max(64),
			url: z.string().max(1000).optional(),
			thumb: z.string().max(1000).optional(),
			color: z.string().max(16).optional(),
			author: z.string().max(120).optional(),
			authorUrl: z.string().max(600).optional(),
			source: z.string().max(40).optional(),
			license: z.string().max(60).optional(),
			size: z.enum(['strip', 'full']).default('strip'),
		}),
		z.null(),
	]),
}

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

const LABEL_COLORS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'gray']
export const boardLabelSchema = z.object({
	name: z.string().trim().min(1, 'Give the label a name').max(40),
	color: z.enum(LABEL_COLORS),
})
export const boardLabelUpdateSchema = boardLabelSchema.partial()

export const timeEntrySchema = z.object({
	minutes: z.number().int().min(1, 'Add at least a minute').max(24 * 60, 'At most 24 hours at a time'),
	date: z.iso.date().optional(),
	note: z.string().trim().max(200).default(''),
})
export const timeEntryUpdateSchema = z.object({
	minutes: z.number().int().min(1).max(24 * 60).optional(),
	note: z.string().trim().max(200).optional(),
})

export const attachmentSchema = z.object({
	url: z.string().trim().url('Enter a link starting with http:// or https://').max(1000).refine((value) => /^https?:\/\//i.test(value), 'Enter a link starting with http:// or https://'),
	name: z.string().trim().max(120).default(''),
})
export const imageAttachmentSchema = z.object({
	image: z.string().max(6_000_000).regex(/^data:image\/(png|jpe?g|webp|gif);base64,/, 'Choose a PNG, JPEG, WebP or GIF image'),
	name: z.string().trim().max(120).default(''),
})

export const copyTaskSchema = z.object({
	title: taskFields.title,
	column: objectId.optional(),
	keep: z.object({
		checklist: z.boolean().default(true),
		labels: z.boolean().default(true),
		members: z.boolean().default(true),
		attachments: z.boolean().default(true),
		dates: z.boolean().default(true),
	}).default({}),
})

export const taskCommentSchema = z.object({
	message: z.string().trim().min(1, 'Comment is required').max(2000, 'Comment is too long'),
	mentions: z.array(objectId).max(20).optional(),
})
