// Calendar files (RFC 5545) for the calendar link: cards with dates become all-day
// events that Google, Apple and Outlook calendars show and refresh by themselves.

import { nextOccurrence } from './recurrence.service.js'

const DAY = 24 * 60 * 60 * 1000

/** Text as a calendar value: backslashes, commas, semicolons and line breaks escaped. */
export const escapeText = (value) => String(value ?? '')
	.replace(/\\/g, '\\\\')
	.replace(/\r\n|\r|\n/g, '\\n')
	.replace(/([,;])/g, '\\$1')

/**
 * One content line folded the RFC way: no line longer than 75 bytes, the rest on
 * lines that start with a space. Never splits a character in two.
 */
export const foldLine = (line) => {
	const parts = []
	let current = ''
	let bytes = 0
	for (const char of line) {
		const size = Buffer.byteLength(char)
		const limit = parts.length ? 74 : 75
		if (bytes + size > limit) {
			parts.push(current)
			current = ''
			bytes = 0
		}
		current += char
		bytes += size
	}
	parts.push(current)
	return parts.join('\r\n ')
}

const dayKey = (date) => new Date(date).toISOString().slice(0, 10)
const dateValue = (key) => key.replace(/-/g, '')
const nextDay = (key) => dayKey(new Date(`${key}T00:00:00Z`).getTime() + DAY)
/** A moment as UTC date-time: 20261022T093000Z. */
export const stampOf = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
// How far ahead those extra dates are listed; the file is fetched again every hour.
const RDATE_YEARS = { monthly: 5, yearly: 30 }

/**
 * The card's repeat rule (services/recurrence.service.js) as an RRULE, plus the dates
 * the rule alone cannot say. The app moves a monthly "day 30" to the 28th in February;
 * calendars skip such months, so those days are listed as extra dates (RDATE) for the
 * years ahead, worked out by the app's own rule. Day 31 is simply "the last day".
 */
export const recurrenceOf = (repeat, startKey) => {
	if (!repeat?.frequency) return null
	const every = Math.max(1, repeat.interval || 1)
	const parts = []
	const day = repeat.dayOfMonth || Number(startKey.slice(8, 10))
	const monthDay = `BYMONTHDAY=${day === 31 ? -1 : day}`
	switch (repeat.frequency) {
		case 'daily':
			parts.push('FREQ=DAILY', `INTERVAL=${every}`)
			break
		case 'weekdays':
			parts.push('FREQ=WEEKLY', 'BYDAY=MO,TU,WE,TH,FR')
			break
		case 'weekly': {
			const days = repeat.days?.length ? repeat.days : [new Date(`${startKey}T00:00:00Z`).getUTCDay() || 7]
			parts.push('FREQ=WEEKLY', `INTERVAL=${every}`, `BYDAY=${[...days].sort().map((value) => WEEKDAYS[value - 1]).join(',')}`, 'WKST=MO')
			break
		}
		case 'monthly':
			parts.push('FREQ=MONTHLY', `INTERVAL=${every}`, monthDay)
			break
		case 'yearly':
			parts.push('FREQ=YEARLY', `INTERVAL=${every}`, `BYMONTH=${Number(startKey.slice(5, 7))}`, monthDay)
			break
		default:
			return null
	}
	if (repeat.until) parts.push(`UNTIL=${dateValue(repeat.until)}`)
	// Days 29 and 30 fall back to a month's last day where the month is shorter.
	const extraDates = []
	if ((repeat.frequency === 'monthly' || repeat.frequency === 'yearly') && (day === 29 || day === 30)) {
		const horizon = `${Number(startKey.slice(0, 4)) + RDATE_YEARS[repeat.frequency]}${startKey.slice(4)}`
		let key = startKey
		for (let guard = 0; guard < 400; guard++) {
			key = nextOccurrence({ ...repeat, dayOfMonth: day }, key)
			if (!key || key > horizon || (repeat.until && key > repeat.until)) break
			if (Number(key.slice(8, 10)) !== day) extraDates.push(key)
		}
	}
	return { rule: parts.join(';'), extraDates }
}

/** Just the RRULE value. */
export const rruleOf = (repeat, startKey) => recurrenceOf(repeat, startKey)?.rule ?? null

const PRIORITY = { urgent: 1, high: 3, medium: 5, low: 7 }

/**
 * A card as an event: on its due day, or from its start to its due day. Finished cards
 * keep their place with a check mark and stop repeating. null when the card has no date.
 */
export const eventOf = ({ task, url, description = '', done = false, now = new Date(), domain = 'kanbanhub' }) => {
	const due = task.dueDate ? dayKey(task.dueDate) : null
	const start = task.startDate ? dayKey(task.startDate) : null
	if (!due && !start) return null
	const first = start && (!due || start <= due) ? start : due
	const last = due && due >= first ? due : first
	const lines = [
		'BEGIN:VEVENT',
		`UID:${task._id}@${domain}`,
		`DTSTAMP:${stampOf(now)}`,
		`DTSTART;VALUE=DATE:${dateValue(first)}`,
		`DTEND;VALUE=DATE:${dateValue(nextDay(last))}`,
		`SUMMARY:${escapeText(`${done ? '✓ ' : ''}${task.title}`)}`,
	]
	if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
	if (url) lines.push(`URL:${url}`)
	if (task.labels?.length) lines.push(`CATEGORIES:${task.labels.map(escapeText).join(',')}`)
	if (PRIORITY[task.priority]) lines.push(`PRIORITY:${PRIORITY[task.priority]}`)
	if (task.updatedAt) lines.push(`LAST-MODIFIED:${stampOf(task.updatedAt)}`)
	lines.push('TRANSP:TRANSPARENT')
	const recurrence = done ? null : recurrenceOf(task.repeat, first)
	if (recurrence) lines.push(`RRULE:${recurrence.rule}`)
	if (recurrence?.extraDates.length) lines.push(`RDATE;VALUE=DATE:${recurrence.extraDates.map(dateValue).join(',')}`)
	lines.push('END:VEVENT')
	return lines
}

/** The whole calendar file. Calendar apps are asked to check for changes every hour. */
export const buildCalendar = ({ name, description = '', events }) => [
	'BEGIN:VCALENDAR',
	'VERSION:2.0',
	'PRODID:-//KanbanHub//Calendar link//EN',
	'CALSCALE:GREGORIAN',
	'METHOD:PUBLISH',
	`X-WR-CALNAME:${escapeText(name)}`,
	...(description ? [`X-WR-CALDESC:${escapeText(description)}`] : []),
	'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
	'X-PUBLISHED-TTL:PT1H',
	...events.flat(),
	'END:VCALENDAR',
].map(foldLine).join('\r\n') + '\r\n'
