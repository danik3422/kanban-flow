import { addDaysToKey, getDueDateKey, getLocalDateKey } from '../../../lib/dueDate.js'

// Trello-style card filter: words, people, due dates, priority and labels. Within a
// group any choice matches (members A or B); across groups all must match.

export const EMPTY_FILTER = { text: '', members: [], due: [], priority: [], labels: [] }

export const DUE_OPTIONS = ['overdue', 'today', 'week', 'none']
export const NO_MEMBER = 'none'

export const activeFilterCount = (filter) =>
	(filter.text.trim() ? 1 : 0) + filter.members.length + filter.due.length + filter.priority.length + filter.labels.length

export const isFilterActive = (filter) => activeFilterCount(filter) > 0

const idOf = (value) => String(value?._id || value || '')

const dueMatches = (task, due, { done, now }) => {
	const dueKey = getDueDateKey(task.dueDate)
	const today = getLocalDateKey(now)
	return due.some((option) => {
		if (option === 'none') return !dueKey
		if (!dueKey || done) return false
		if (option === 'overdue') return dueKey < today
		if (option === 'today') return dueKey === today
		if (option === 'week') return dueKey >= today && dueKey <= addDaysToKey(today, 6)
		return false
	})
}

/** Does this card pass the filter? `done` marks cards in the last list (never overdue). */
export const matchesCardFilter = (task, filter, { done = false, now = new Date() } = {}) => {
	const text = filter.text.trim().toLocaleLowerCase()
	if (text) {
		const haystack = [task.title, task.description, ...(task.labels || [])].filter(Boolean).join(' ').toLocaleLowerCase()
		if (!text.split(/\s+/).every((word) => haystack.includes(word))) return false
	}
	if (filter.members.length) {
		const assignees = (task.assignees || []).map(idOf)
		const wanted = filter.members.some((member) => (member === NO_MEMBER ? assignees.length === 0 : assignees.includes(member)))
		if (!wanted) return false
	}
	if (filter.due.length && !dueMatches(task, filter.due, { done, now })) return false
	if (filter.priority.length && !filter.priority.includes(task.priority || 'none')) return false
	if (filter.labels.length && !(task.labels || []).some((label) => filter.labels.includes(label))) return false
	return true
}

/** Every label used on the board, most used first. */
export const boardLabels = (columns) => {
	const counts = new Map()
	for (const column of columns) for (const task of column.tasks || []) for (const label of task.labels || []) counts.set(label, (counts.get(label) || 0) + 1)
	return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label]) => label)
}

export const toggleIn = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
