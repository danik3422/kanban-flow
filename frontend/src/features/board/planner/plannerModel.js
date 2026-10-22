import { intlLocale } from '../../../i18n/translate.js'
import { addDays, dateFromKey } from '../../../lib/calendarDates.js'
import { getDueDateKey } from '../../../lib/dueDate.js'

// The planner: a board's cards placed on the days they are due, a week at a time.

const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 }
export const NO_DATE = 'none'

/** The seven day keys of the week holding `key`, starting on `weekStart` (1 = Monday, 7 = Sunday). */
export const weekOf = (key, weekStart) => {
	const weekday = dateFromKey(key).getDay() || 7
	const start = addDays(key, -((weekday - weekStart + 7) % 7))
	return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

// Open cards first, then by priority, then by title.
const byImportance = (left, right) => Number(Boolean(left.task.completed)) - Number(Boolean(right.task.completed))
	|| (PRIORITY_WEIGHT[right.task.priority] || 0) - (PRIORITY_WEIGHT[left.task.priority] || 0)
	|| left.task.title.localeCompare(right.task.title)

/**
 * The board's cards for a week: `days` (key → cards due that day), `overdue` (open cards
 * due before today) and `undated` (open cards with no due date). Each card comes with its list.
 */
export const plannerGroups = (columns, days, todayKey, { showDone = false } = {}) => {
	const byDay = Object.fromEntries(days.map((key) => [key, []]))
	const overdue = []
	const undated = []
	for (const column of columns) {
		for (const task of column.tasks || []) {
			const item = { task, columnId: column._id, columnTitle: column.title }
			const key = getDueDateKey(task.dueDate)
			const done = Boolean(task.completed)
			if (!key) {
				if (!done) undated.push(item)
			} else if (key in byDay) {
				if (showDone || !done) byDay[key].push(item)
			} else if (key < todayKey && !done) {
				overdue.push(item)
			}
		}
	}
	for (const key of days) byDay[key].sort(byImportance)
	overdue.sort((left, right) => getDueDateKey(left.task.dueDate).localeCompare(getDueDateKey(right.task.dueDate)) || byImportance(left, right))
	undated.sort(byImportance)
	return { days: byDay, overdue, undated }
}

/** "20 – 26 Oct 2026" in the reader's language. */
export const weekTitle = (days, language) => {
	const format = new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short', year: 'numeric' })
	const start = dateFromKey(days[0])
	const end = dateFromKey(days[days.length - 1])
	return format.formatRange ? format.formatRange(start, end) : `${format.format(start)} – ${format.format(end)}`
}

/** The short weekday ("Thu") and day of month ("22") of a day key. */
export const dayLabel = (key, language) => {
	const date = dateFromKey(key)
	return {
		weekday: new Intl.DateTimeFormat(intlLocale(language), { weekday: 'short' }).format(date),
		day: date.getDate(),
	}
}
