// The guide's logic, apart from its looks: the little markup its texts use, search over
// the sections, the reader's progress, and the automation playground's tiny rule engine
// (the same "each rule once per chain" idea as backend/services/automation.service.js).

/** Splits a text into parts: plain text, `code`, [[key]] and **bold**. */
export const parseRich = (text) => {
	const parts = []
	const pattern = /`([^`]+)`|\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*/g
	let last = 0
	for (const match of String(text).matchAll(pattern)) {
		if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) })
		if (match[1] !== undefined) parts.push({ type: 'code', value: match[1] })
		else if (match[2] !== undefined) parts.push({ type: 'key', value: match[2] })
		else parts.push({ type: 'bold', value: match[3] })
		last = match.index + match[0].length
	}
	if (last < String(text).length) parts.push({ type: 'text', value: String(text).slice(last) })
	return parts
}

/** A section's words, without markup, for search. */
export const sectionText = (section) => [
	section.title,
	section.lead,
	section.demoText,
	...(section.steps || []).flatMap((step) => [step.title, step.text]),
	...(section.items || []).flatMap((item) => [item.title, item.text]),
	...(section.views || []).flatMap((view) => [view.title, view.text]),
	...(section.apps || []).flatMap((app) => [app.title, ...app.steps]),
	...(section.tips || []),
].filter(Boolean).join(' ').replace(/`|\[\[|\]\]|\*\*/g, '')

const normalize = (value) => value.toLocaleLowerCase().replace(/ё/g, 'е')

/** Ids of the sections that have every word of the query; all of them for an empty query. */
export const searchSections = (sections, query) => {
	const words = normalize(query).split(/\s+/).filter(Boolean)
	if (!words.length) return sections.map((section) => section.id)
	return sections
		.filter((section) => {
			const text = normalize(sectionText(section))
			return words.every((word) => text.includes(word))
		})
		.map((section) => section.id)
}

const PROGRESS_KEY = 'kh:guide-read'

/** Sections the reader marked as read on this device. */
export const readProgress = () => {
	try {
		const ids = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]')
		return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
	} catch {
		return []
	}
}

export const saveProgress = (ids) => {
	try {
		if (ids.length) localStorage.setItem(PROGRESS_KEY, JSON.stringify(ids))
		else localStorage.removeItem(PROGRESS_KEY)
	} catch {
		// Only a convenience: the guide still works without it.
	}
}

// The automation playground: three lists, three cards and a few rules to switch on.
export const PLAY_LISTS = ['todo', 'doing', 'done']
export const PLAY_CARDS = [
	{ id: 'a', column: 'todo', completed: false, labels: [], assigned: false, due: false },
	{ id: 'b', column: 'todo', completed: false, labels: [], assigned: false, due: false },
	{ id: 'c', column: 'doing', completed: false, labels: [], assigned: false, due: false },
]
export const playRules = (label) => [
	{ id: 'finish', trigger: { type: 'card_added', column: 'done' }, actions: [{ type: 'complete' }, { type: 'add_label', label }] },
	{ id: 'file', trigger: { type: 'card_completed', column: null }, actions: [{ type: 'move', column: 'done', position: 'top' }] },
	{ id: 'start', trigger: { type: 'card_moved', column: 'doing' }, actions: [{ type: 'assign_actor' }, { type: 'set_due', days: 2 }] },
	{ id: 'back', trigger: { type: 'card_added', column: 'todo' }, actions: [{ type: 'reopen' }, { type: 'clear_due' }] },
]

const matches = (trigger, event) => {
	const list = !trigger.column || trigger.column === event.column
	if (trigger.type === 'card_added') return (event.type === 'created' || event.type === 'moved') && list
	if (trigger.type === 'card_moved') return event.type === 'moved' && list
	if (trigger.type === 'card_completed') return event.type === 'completed' && list
	return false
}

/**
 * What the switched-on rules do after something happened to a card. Returns the new
 * cards and the ids of the rules that changed something, in order. Each rule runs at
 * most once per chain, so two rules sending a card back and forth stop.
 */
export const runPlayRules = (cards, rules, cardId, firstEvent) => {
	let current = cards.map((card) => ({ ...card, labels: [...card.labels] }))
	const fired = []
	const used = new Set()
	let pending = [firstEvent]
	for (let step = 0; step < 5 && pending.length; step++) {
		const next = []
		for (const event of pending) {
			for (const rule of rules) {
				if (used.has(rule.id) || !matches(rule.trigger, event)) continue
				used.add(rule.id)
				const card = current.find((item) => item.id === cardId)
				let changed = false
				for (const action of rule.actions) {
					if (action.type === 'move' && card.column !== action.column) {
						card.column = action.column
						changed = true
						next.push({ type: 'moved', column: action.column })
					} else if (action.type === 'complete' && !card.completed) {
						card.completed = true
						changed = true
						next.push({ type: 'completed', column: card.column })
					} else if (action.type === 'reopen' && card.completed) {
						card.completed = false
						changed = true
					} else if (action.type === 'add_label' && !card.labels.includes(action.label)) {
						card.labels.push(action.label)
						changed = true
					} else if (action.type === 'assign_actor' && !card.assigned) {
						card.assigned = true
						changed = true
					} else if (action.type === 'set_due' && !card.due) {
						card.due = true
						changed = true
					} else if (action.type === 'clear_due' && card.due) {
						card.due = false
						changed = true
					}
				}
				if (changed) fired.push(rule.id)
				current = current.map((item) => (item.id === cardId ? card : item))
			}
		}
		pending = next
	}
	return { cards: current, fired }
}
