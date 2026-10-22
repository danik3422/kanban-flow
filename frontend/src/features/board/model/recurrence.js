import { intlLocale } from '../../../i18n/translate.js'

// Repeating cards, as the server works them out (backend/services/recurrence.service.js):
// the next due date of a series, the dates still to come, and the rule in words.

export const FREQUENCIES = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly']
const DAY = 24 * 60 * 60 * 1000

const parse = (key) => new Date(`${key}T00:00:00Z`)
const keyOf = (date) => date.toISOString().slice(0, 10)
const weekdayOf = (date) => date.getUTCDay() || 7
const addDays = (date, days) => new Date(date.getTime() + days * DAY)
const mondayOf = (date) => addDays(date, 1 - weekdayOf(date))
const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
const addMonths = (date, months, dayOfMonth) => {
	const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
	return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(dayOfMonth, daysInMonth(first.getUTCFullYear(), first.getUTCMonth()))))
}

/** 1 = Monday … 7 = Sunday for a day key. */
export const weekdayOfKey = (key) => weekdayOf(parse(key))

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

/** The dates of the series after `dueKey` that fall between `fromKey` and `toKey` (at most `limit`). */
export const upcomingDates = (repeat, dueKey, fromKey, toKey, limit = 31) => {
	const dates = []
	let key = dueKey
	for (let guard = 0; guard < 400 && dates.length < limit; guard++) {
		key = nextOccurrence(repeat, key)
		if (!key || key > toKey || (repeat.until && key > repeat.until)) break
		if (key >= fromKey) dates.push(key)
	}
	return dates
}

const weekdayName = (day, language, format = 'long') => new Intl.DateTimeFormat(intlLocale(language), { weekday: format, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, day))) // 1 Jan 2024 is a Monday

/** The rule in words: "Every week on Monday and Friday", "Every 2 months on day 31". */
export const describeRepeat = (t, repeat, language) => {
	if (!repeat?.frequency) return ''
	const every = repeat.interval || 1
	const list = (items) => new Intl.ListFormat(intlLocale(language), { type: 'conjunction' }).format(items)
	// "Every day" and "Every 3 days" are separate texts: plural rules alone would turn 21 into "every day".
	const key = (name) => `repeat.text.${name}${every > 1 ? 'N' : ''}`
	let text
	if (repeat.frequency === 'weekdays') text = t('repeat.text.weekdays')
	else if (repeat.frequency === 'weekly') text = t(key('weekly'), { count: every, days: list((repeat.days || []).map((day) => weekdayName(day, language))) })
	else if (repeat.frequency === 'monthly') text = t(key('monthly'), { count: every, day: repeat.dayOfMonth || '' })
	else text = t(key(repeat.frequency), { count: every })
	return repeat.until ? `${text}, ${t('repeat.until', { date: new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parse(repeat.until)) })}` : text
}

/** Short weekday names Monday → Sunday for pickers. */
export const weekdayChoices = (language) => [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, label: weekdayName(day, language, 'short') }))
