import { z } from 'zod'

import { BOARD_ACTIONS, CARD_ACTIONS, CARD_TRIGGERS } from '../services/automation.service.js'
import { objectId } from './fields.js'

// Automation rules: a trigger and up to ten actions that fit it.

const label = z.string().trim().min(1).max(40)
const position = z.enum(['top', 'bottom']).default('bottom')

const action = z.discriminatedUnion('type', [
	z.object({ type: z.literal('move'), column: objectId, position }),
	z.object({ type: z.literal('complete') }),
	z.object({ type: z.literal('reopen') }),
	z.object({ type: z.literal('add_label'), label }),
	z.object({ type: z.literal('remove_label'), label }),
	z.object({ type: z.literal('clear_labels') }),
	z.object({ type: z.literal('assign'), users: z.array(objectId).min(1).max(20) }),
	z.object({ type: z.literal('assign_actor') }),
	z.object({ type: z.literal('unassign_all') }),
	z.object({ type: z.literal('set_due'), days: z.number().int().min(0).max(365) }),
	z.object({ type: z.literal('clear_due') }),
	z.object({ type: z.literal('set_priority'), priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']) }),
	z.object({ type: z.literal('check_all') }),
	z.object({ type: z.literal('comment'), text: z.string().trim().min(1).max(1000) }),
	z.object({ type: z.literal('archive') }),
	z.object({
		type: z.literal('create_card'),
		column: objectId,
		position,
		title: z.string().trim().min(1).max(200),
		text: z.string().max(5000).optional(),
		labels: z.array(label).max(20).optional(),
		users: z.array(objectId).max(20).optional(),
		days: z.number().int().min(0).max(365).nullable().optional(),
	}),
	z.object({ type: z.literal('move_list'), from: objectId, column: objectId }),
	z.object({ type: z.literal('archive_list'), column: objectId, onlyDone: z.boolean().default(false) }),
])

const trigger = z.discriminatedUnion('type', [
	...CARD_TRIGGERS.map((type) => z.object({ type: z.literal(type), column: objectId.nullable().default(null) })),
	z.object({
		type: z.literal('schedule'),
		schedule: z.object({
			frequency: z.enum(['daily', 'weekdays', 'weekly', 'monthly']),
			days: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
			dayOfMonth: z.number().int().min(1).max(31).optional(),
			time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time'),
		}),
	}),
])

export const ruleSchema = z.object({
	name: z.string().trim().max(80).default(''),
	enabled: z.boolean().default(true),
	trigger,
	actions: z.array(action).min(1, 'Add at least one action').max(10, 'A rule can have up to 10 actions'),
}).superRefine((rule, context) => {
	const allowed = rule.trigger.type === 'schedule' ? BOARD_ACTIONS : CARD_ACTIONS
	rule.actions.forEach((item, index) => {
		if (!allowed.includes(item.type)) context.addIssue({ code: 'custom', path: ['actions', index, 'type'], message: 'This action does not fit the trigger' })
	})
	const { schedule } = rule.trigger
	if (schedule?.frequency === 'weekly' && !schedule.days?.length) context.addIssue({ code: 'custom', path: ['trigger', 'schedule', 'days'], message: 'Pick the days of the week' })
	if (schedule?.frequency === 'monthly' && !schedule.dayOfMonth) context.addIssue({ code: 'custom', path: ['trigger', 'schedule', 'dayOfMonth'], message: 'Pick the day of the month' })
})

/** Turning a rule on or off on its own. */
export const ruleToggleSchema = z.object({ enabled: z.boolean() })
