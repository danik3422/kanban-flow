// Repeating cards: when one is completed, the next one in the series is due on the
// date worked out here. Due dates are calendar days ("2026-10-22"), counted in UTC.
// frontend/src/features/board/model/recurrence.js mirrors this for the planner.

export const FREQUENCIES = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly']
const DAY = 24 * 60 * 60 * 1000

const parse = (key) => new Date(`${key}T00:00:00Z`)
const keyOf = (date) => date.toISOString().slice(0, 10)
const weekdayOf = (date) => date.getUTCDay() || 7 // 1 = Monday … 7 = Sunday
const addDays = (date, days) => new Date(date.getTime() + days * DAY)
const mondayOf = (date) => addDays(date, 1 - weekdayOf(date))
const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
// The same day of the month, or the month's last day when it is shorter (31 → 30, 29 Feb → 28).
const addMonths = (date, months, dayOfMonth) => {
	const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
	return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(dayOfMonth, daysInMonth(first.getUTCFullYear(), first.getUTCMonth()))))
}

/** The day key of the occurrence right after `fromKey`. */
export const nextOccurrence = (repeat, fromKey) => {
	const from = parse(fromKey)
	const every = repeat.interval || 1
	switch (repeat.frequency) {
		case 'daily':
			return keyOf(addDays(from, every))
		case 'weekdays': {
			let date = addDays(from, 1)
			while (weekdayOf(date) > 5) date = addDays(date, 1)
			return keyOf(date)
		}
		case 'weekly': {
			const days = repeat.days?.length ? repeat.days : [weekdayOf(from)]
			const firstWeek = mondayOf(from)
			for (let step = 1; step <= 7 * (every + 1); step++) {
				const date = addDays(from, step)
				const weeks = Math.round((mondayOf(date) - firstWeek) / (7 * DAY))
				if (weeks % every === 0 && days.includes(weekdayOf(date))) return keyOf(date)
			}
			return keyOf(addDays(from, 7 * every))
		}
		case 'monthly':
			return keyOf(addMonths(from, every, repeat.dayOfMonth || from.getUTCDate()))
		case 'yearly':
			return keyOf(addMonths(from, 12 * every, repeat.dayOfMonth || from.getUTCDate()))
		default:
			return null
	}
}

/**
 * When the next card of the series is due: the first occurrence after the current due
 * date (or after today when there was none) that is not already in the past.
 * null when the series has ended.
 */
export const nextDueKey = (repeat, dueKey, todayKey) => {
	let key = nextOccurrence(repeat, dueKey || todayKey)
	for (let guard = 0; key && key < todayKey && guard < 2000; guard++) key = nextOccurrence(repeat, key)
	if (!key || (repeat.until && key > repeat.until)) return null
	return key
}

/** A repeat rule as stored: checked, with defaults taken from the card's due date. */
export const normalizeRepeat = (input, dueKey, todayKey) => {
	if (!input || !FREQUENCIES.includes(input.frequency)) return null
	const anchor = parse(dueKey || todayKey)
	const interval = Math.min(Math.max(Number.parseInt(input.interval, 10) || 1, 1), 99)
	const days = [...new Set((input.days || []).map(Number).filter((day) => day >= 1 && day <= 7))].sort()
	return {
		frequency: input.frequency,
		interval: input.frequency === 'weekdays' ? 1 : interval,
		...(input.frequency === 'weekly' && { days: days.length ? days : [weekdayOf(anchor)] }),
		...((input.frequency === 'monthly' || input.frequency === 'yearly') && { dayOfMonth: anchor.getUTCDate() }),
		until: input.until || null,
	}
}

/** Today's day key where the person is (their saved timezone, or UTC). */
export const todayKeyIn = (timezone) => {
	try {
		return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
	} catch {
		return keyOf(new Date())
	}
}
