// Automation rules in the app: what a rule says in words, a fresh rule to edit, ideas
// that fit the board, and the rule as the API takes it (backend services/automation.service.js).

export const CARD_TRIGGERS = ['card_added', 'card_created', 'card_moved', 'card_completed', 'checklist_done']
export const CARD_ACTIONS = ['move', 'complete', 'reopen', 'add_label', 'remove_label', 'clear_labels', 'assign', 'assign_actor', 'unassign_all', 'set_due', 'clear_due', 'set_priority', 'check_all', 'comment', 'archive']
export const BOARD_ACTIONS = ['create_card', 'move_list', 'archive_list']
export const FREQUENCIES = ['daily', 'weekdays', 'weekly', 'monthly']
export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none']
export const MAX_ACTIONS = 10
// Triggers that need a list; the others may watch any list.
const LIST_REQUIRED = new Set(['card_added', 'card_created', 'card_moved'])

export const isSchedule = (rule) => rule?.trigger?.type === 'schedule'
export const actionsFor = (triggerType) => (triggerType === 'schedule' ? BOARD_ACTIONS : CARD_ACTIONS)
export const listRequired = (triggerType) => LIST_REQUIRED.has(triggerType)

const idOf = (value) => (value && typeof value === 'object' ? String(value._id) : value ? String(value) : '')

/** A new action of a type, with sensible first choices from the board. */
export const blankAction = (type, { columns = [], labels = [] } = {}) => {
	const first = columns[0]?._id || ''
	const last = columns.at(-1)?._id || ''
	switch (type) {
		case 'move': return { type, column: last, position: 'bottom' }
		case 'add_label':
		case 'remove_label': return { type, label: labels[0]?.name || '' }
		case 'assign': return { type, users: [] }
		case 'set_due': return { type, days: 1 }
		case 'set_priority': return { type, priority: 'high' }
		case 'comment': return { type, text: '' }
		case 'create_card': return { type, column: first, position: 'bottom', title: '', text: '', labels: [], users: [], days: null }
		case 'move_list': return { type, from: last, column: first }
		case 'archive_list': return { type, column: last, onlyDone: false }
		default: return { type }
	}
}

// Every draft keeps a schedule, so switching a card rule to "on a schedule" has one to show.
const blankSchedule = () => ({ frequency: 'weekdays', days: [1], dayOfMonth: 1, time: '09:00' })

/** A new rule: a card rule on the last list, or a weekday-morning schedule. */
export const blankRule = (kind, board = {}) => {
	const columns = board.columns || []
	if (kind === 'schedule') {
		return { name: '', enabled: true, trigger: { type: 'schedule', column: null, schedule: blankSchedule() }, actions: [blankAction('create_card', board)] }
	}
	return { name: '', enabled: true, trigger: { type: 'card_added', column: columns.at(-1)?._id || null, schedule: blankSchedule() }, actions: [blankAction('complete', board)] }
}

/** A saved rule as the editor holds it (ids as strings, every field present). */
export const draftOf = (rule) => ({
	name: rule.name || '',
	enabled: rule.enabled !== false,
	trigger: {
		type: rule.trigger.type,
		column: idOf(rule.trigger.column) || null,
		schedule: { ...blankSchedule(), ...rule.trigger.schedule },
	},
	actions: rule.actions.map((action) => ({
		...blankAction(action.type),
		...action,
		...(action.column && { column: idOf(action.column) }),
		...(action.from && { from: idOf(action.from) }),
		...(action.users && { users: action.users.map(idOf) }),
	})),
})

/** The editor's rule as the API takes it: only the fields each part needs. */
export const toPayload = (draft) => {
	const { trigger } = draft
	const schedule = trigger.schedule || {}
	return {
		name: draft.name.trim(),
		enabled: draft.enabled,
		trigger: trigger.type === 'schedule'
			? {
				type: 'schedule',
				schedule: {
					frequency: schedule.frequency,
					time: schedule.time,
					...(schedule.frequency === 'weekly' && { days: [...schedule.days].sort((a, b) => a - b) }),
					...(schedule.frequency === 'monthly' && { dayOfMonth: Number(schedule.dayOfMonth) }),
				},
			}
			: { type: trigger.type, column: trigger.column || null },
		actions: draft.actions.map((action) => {
			switch (action.type) {
				case 'move': return { type: action.type, column: action.column, position: action.position }
				case 'add_label':
				case 'remove_label': return { type: action.type, label: action.label }
				case 'assign': return { type: action.type, users: action.users }
				case 'set_due': return { type: action.type, days: Number(action.days) || 0 }
				case 'set_priority': return { type: action.type, priority: action.priority }
				case 'comment': return { type: action.type, text: action.text.trim() }
				case 'create_card': return {
					type: action.type,
					column: action.column,
					position: action.position,
					title: action.title.trim(),
					...(action.text?.trim() && { text: action.text.trim() }),
					labels: action.labels,
					users: action.users,
					days: action.days === null || action.days === '' ? null : Number(action.days),
				}
				case 'move_list': return { type: action.type, from: action.from, column: action.column }
				case 'archive_list': return { type: action.type, column: action.column, onlyDone: Boolean(action.onlyDone) }
				default: return { type: action.type }
			}
		}),
	}
}

/** What still has to be filled in, as `{ path: messageKey }`; empty when the rule can be saved. */
export const problemsOf = (draft) => {
	const problems = {}
	if (listRequired(draft.trigger.type) && !draft.trigger.column) problems.trigger = 'automation.needList'
	if (draft.trigger.type === 'schedule' && draft.trigger.schedule.frequency === 'weekly' && !draft.trigger.schedule.days?.length) problems.trigger = 'automation.needDays'
	draft.actions.forEach((action, index) => {
		const needsList = ['move', 'create_card', 'archive_list', 'move_list'].includes(action.type)
		if (needsList && !action.column) problems[index] = 'automation.needList'
		else if (action.type === 'move_list' && !action.from) problems[index] = 'automation.needList'
		else if ((action.type === 'add_label' || action.type === 'remove_label') && !action.label) problems[index] = 'automation.label'
		else if (action.type === 'assign' && !action.users?.length) problems[index] = 'automation.pickPeople'
		else if (action.type === 'comment' && !action.text?.trim()) problems[index] = 'automation.needText'
		else if (action.type === 'create_card' && !action.title?.trim()) problems[index] = 'automation.needTitle'
	})
	return problems
}

const quoted = (t, text) => t('automation.quote', { text })

/**
 * The rule as one sentence: "When a card is added to «Done» → mark it complete, remove
 * the due date". `board` gives the names of lists, labels and people.
 */
export const describeRule = (t, rule, { columns = [], members = [], weekdays = [] } = {}) => {
	const quote = (text) => quoted(t, text)
	const listName = (id) => {
		const column = columns.find((item) => String(item._id) === idOf(id))
		return column ? quote(column.title) : t('automation.say.missingList')
	}
	const personName = (id) => {
		const person = members.find((item) => String(item._id) === idOf(id))
		return person ? person.name || person.email : t('automation.say.missingPerson')
	}
	const { trigger } = rule
	let when
	if (trigger.type === 'schedule') {
		const schedule = trigger.schedule || {}
		const days = (schedule.days || []).slice().sort((a, b) => a - b).map((day) => weekdays[day - 1] || day).join(', ')
		when = t(`automation.say.${schedule.frequency}`, { time: schedule.time, days, day: schedule.dayOfMonth })
	} else {
		when = trigger.column
			? t(`automation.say.${trigger.type}`, { list: listName(trigger.column) })
			: t(`automation.say.${trigger.type}_any`)
	}
	const then = rule.actions.map((action) => {
		switch (action.type) {
			case 'move': return t(action.position === 'top' ? 'automation.say.move_top' : 'automation.say.move', { list: listName(action.column) })
			case 'add_label':
			case 'remove_label': return t(`automation.say.${action.type}`, { label: quote(action.label) })
			case 'assign': return t('automation.say.assign', { people: (action.users || []).map(personName).join(', ') })
			case 'set_due': return Number(action.days) ? t('automation.say.set_due', { count: Number(action.days) }) : t('automation.say.set_due_today')
			case 'set_priority': return t('automation.say.set_priority', { priority: t(`myTasks.priority.${action.priority}`) })
			case 'create_card': return t('automation.say.create_card', { title: action.title, list: listName(action.column) })
			case 'move_list': return t('automation.say.move_list', { from: listName(action.from), list: listName(action.column) })
			case 'archive_list': return t(action.onlyDone ? 'automation.say.archive_list_done' : 'automation.say.archive_list', { list: listName(action.column) })
			default: return t(`automation.say.${action.type}`)
		}
	})
	return { when, then }
}

/** A card's history line for a rule that changed it. */
export const describeRun = (t, item) => {
	const quote = (text) => quoted(t, text)
	const actions = [...new Set(item.fields || [])].map((field) => (field === 'move'
		? item.toColumn ? t('automation.history.move', { list: quote(item.toColumn) }) : t('automation.history.moveSame')
		: t(`automation.history.${field === 'assign_actor' ? 'assign' : field}`))).join(', ')
	return item.message ? t('automation.history.named', { name: item.message, actions }) : t('automation.history.unnamed', { actions })
}

/**
 * Ready-made rules that fit the board's lists: the last list as "done", the first as
 * "to do". Each opens in the editor, never saved without a look.
 */
export const ideasFor = (t, columns = []) => {
	if (!columns.length) return []
	const first = columns[0]
	const last = columns.at(-1)
	const ideas = []
	if (columns.length > 1) {
		ideas.push({ key: 'finish', title: t('automation.idea.finish', { list: last.title }), rule: { name: t('automation.idea.finish', { list: last.title }), enabled: true, trigger: { type: 'card_added', column: last._id }, actions: [{ type: 'complete' }] } })
		ideas.push({ key: 'file', title: t('automation.idea.file', { list: last.title }), rule: { name: t('automation.idea.file', { list: last.title }), enabled: true, trigger: { type: 'card_completed', column: null }, actions: [{ type: 'move', column: last._id, position: 'top' }] } })
	}
	ideas.push({ key: 'claim', title: t('automation.idea.claim'), rule: { name: t('automation.idea.claim'), enabled: true, trigger: { type: 'card_created', column: first._id }, actions: [{ type: 'assign_actor' }] } })
	ideas.push({ key: 'checklist', title: t('automation.idea.checklist'), rule: { name: t('automation.idea.checklist'), enabled: true, trigger: { type: 'checklist_done', column: null }, actions: [{ type: 'complete' }] } })
	if (columns.length > 1) {
		ideas.push({ key: 'cleanup', title: t('automation.idea.cleanup', { list: last.title }), rule: { name: t('automation.idea.cleanup', { list: last.title }), enabled: true, trigger: { type: 'schedule', column: null, schedule: { frequency: 'weekly', days: [1], dayOfMonth: 1, time: '09:00' } }, actions: [{ type: 'archive_list', column: last._id, onlyDone: false }] } })
	}
	ideas.push({ key: 'standup', title: t('automation.idea.standup'), rule: { name: t('automation.idea.standup'), enabled: true, trigger: { type: 'schedule', column: null, schedule: { frequency: 'weekdays', days: [1], dayOfMonth: 1, time: '09:30' } }, actions: [{ type: 'create_card', column: first._id, position: 'top', title: t('automation.idea.standupTitle'), text: '', labels: [], users: [], days: 0 }] } })
	return ideas
}

/** Ideas the board does not have yet: no saved rule with the same trigger does all the idea does. */
export const freshIdeas = (ideas, rules) => {
	const shapeOf = (rule) => {
		const payload = toPayload(draftOf(rule))
		return { trigger: JSON.stringify(payload.trigger), actions: payload.actions.map((action) => JSON.stringify(action)) }
	}
	const saved = rules.map(shapeOf)
	return ideas.filter((idea) => {
		const shape = shapeOf(idea.rule)
		return !saved.some((rule) => rule.trigger === shape.trigger && shape.actions.every((action) => rule.actions.includes(action)))
	})
}
