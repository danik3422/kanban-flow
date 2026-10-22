import { getDueDateKey } from '../../../lib/dueDate.js'

// The table view's rows: every card with its list, in board order, and how to sort them.

const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 }

/** Cards as rows `{ task, column, columnIndex }`, filtered by the board filter, a search and "hide done". */
export const tableRows = (columns, { query = '', hideDone = false, passes = () => true } = {}) => {
	const needle = query.trim().toLowerCase()
	return columns.flatMap((column, columnIndex) => (column.tasks || [])
		.filter((task) => passes(task, column))
		.filter((task) => !hideDone || !task.completed)
		.filter((task) => !needle || task.title.toLowerCase().includes(needle) || (task.labels || []).some((label) => label.toLowerCase().includes(needle)))
		.map((task) => ({ task, column, columnIndex })))
}

const personName = (person) => (person?.name || person?.email || '').toLowerCase()

// Empty values go last in either direction of a text or date sort.
const LAST = '￿'
const sortValue = (row, key) => {
	const { task } = row
	switch (key) {
		case 'title': return task.title.toLowerCase()
		case 'list': return row.columnIndex
		case 'labels': return (task.labels?.[0] || LAST).toLowerCase()
		case 'members': return task.assignees?.length ? personName(task.assignees[0]) : LAST
		case 'start': return getDueDateKey(task.startDate) || LAST
		case 'due': return getDueDateKey(task.dueDate) || LAST
		case 'priority': return -(PRIORITY_WEIGHT[task.priority] || 0)
		case 'checklist': {
			const items = task.checklist || []
			return items.length ? items.filter((item) => item.completed).length / items.length : -1
		}
		case 'time': return task.trackedSeconds || 0
		default: return 0
	}
}

/** Order of two rows by a column (direction 1 ascending, -1 descending); ties keep the board order. */
export const compareRows = (left, right, key, language, direction = 1) => {
	const a = sortValue(left, key)
	const b = sortValue(right, key)
	const order = typeof a === 'string' ? a.localeCompare(b, language) : a - b
	return order * direction || left.columnIndex - right.columnIndex || (left.task.position ?? 0) - (right.task.position ?? 0)
}
