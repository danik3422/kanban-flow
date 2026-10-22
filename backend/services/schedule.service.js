// When a scheduled automation runs: "every weekday at 09:00" in the author's time zone,
// worked out with the platform's time zone data (summer time included).

const DAY = 24 * 60 * 60 * 1000

const validZone = (timezone) => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: timezone })
		return timezone
	} catch {
		return 'UTC'
	}
}

/** How far the zone's wall clock is ahead of UTC at that moment, in ms. */
const offsetAt = (instant, timezone) => {
	const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(instant).map((part) => [part.type, part.value]))
	const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
	return wall - Math.floor(instant.getTime() / 1000) * 1000
}

/** The moment a wall-clock time happens on a day in a zone ("2026-10-26", "09:00"). */
export const zonedMoment = (dayKey, time, timezone) => {
	const zone = validZone(timezone)
	const [hours, minutes] = time.split(':').map(Number)
	const wall = Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10)), hours, minutes)
	let moment = wall - offsetAt(new Date(wall), zone)
	// Once more with the offset of the moment itself, for days the clocks change.
	moment = wall - offsetAt(new Date(moment), zone)
	return new Date(moment)
}

/** The calendar day it is in a zone at a moment. */
export const dayKeyIn = (instant, timezone) => new Intl.DateTimeFormat('en-CA', { timeZone: validZone(timezone), year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)

const weekdayOf = (dayKey) => new Date(`${dayKey}T00:00:00Z`).getUTCDay() || 7
const lastDayOfMonth = (dayKey) => new Date(Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)), 0)).getUTCDate()

/** True when the schedule runs on that day. */
export const runsOn = (schedule, dayKey) => {
	switch (schedule.frequency) {
		case 'daily':
			return true
		case 'weekdays':
			return weekdayOf(dayKey) <= 5
		case 'weekly':
			return (schedule.days?.length ? schedule.days : [1]).includes(weekdayOf(dayKey))
		case 'monthly': {
			const day = Number(dayKey.slice(8, 10))
			return day === Math.min(schedule.dayOfMonth || 1, lastDayOfMonth(dayKey))
		}
		default:
			return false
	}
}

/** The first run strictly after `after`; null for a schedule that never runs. */
export const nextRunAfter = (schedule, after = new Date()) => {
	const timezone = validZone(schedule.timezone || 'UTC')
	const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time || '') ? schedule.time : '09:00'
	let dayKey = dayKeyIn(new Date(after.getTime() - DAY), timezone)
	for (let step = 0; step < 400; step++) {
		if (runsOn(schedule, dayKey)) {
			const moment = zonedMoment(dayKey, time, timezone)
			if (moment > after) return moment
		}
		dayKey = new Date(Date.parse(`${dayKey}T00:00:00Z`) + DAY).toISOString().slice(0, 10)
	}
	return null
}
