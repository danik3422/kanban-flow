import { COLUMN_COLORS } from './columnColors.js'
import { addDaysToKey, getDueDateKey, getLocalDateKey } from './dueDate.js'

// What a card shows: label colours, durations and how people type them.

export const CARD_COLORS = COLUMN_COLORS
export const CARD_COLOR_KEYS = Object.keys(COLUMN_COLORS)

const hash = (text) => [...String(text)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)

/** A label's colour: the board's choice, or a steady colour picked from its name. */
export const labelColorKey = (name, boardLabels = []) => {
	const found = boardLabels.find((label) => label.name.toLowerCase() === String(name).toLowerCase())
	return found?.color || CARD_COLOR_KEYS[hash(String(name).toLowerCase()) % CARD_COLOR_KEYS.length]
}

/** Every label a card can use: the board's, plus any older names cards still carry. */
export const allLabels = (boardLabels = [], columns = []) => {
	const known = new Map(boardLabels.map((label) => [label.name.toLowerCase(), { ...label, saved: true }]))
	for (const column of columns) for (const task of column.tasks || []) for (const name of task.labels || []) {
		if (!known.has(name.toLowerCase())) known.set(name.toLowerCase(), { name, color: labelColorKey(name), saved: false })
	}
	return [...known.values()]
}

/** "1 h 30 min" style, with the unit words from the interface language. */
export const formatDuration = (seconds, units = { h: 'h', m: 'm' }) => {
	const total = Math.max(0, Math.round((seconds || 0) / 60))
	const hours = Math.floor(total / 60)
	const minutes = total % 60
	if (!hours) return `${minutes} ${units.m}`
	return minutes ? `${hours} ${units.h} ${minutes} ${units.m}` : `${hours} ${units.h}`
}

/** A running clock: "1:05:09" or "05:09". */
export const formatClock = (seconds) => {
	const total = Math.max(0, Math.floor(seconds || 0))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const pad = (value) => String(value).padStart(2, '0')
	return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/**
 * Minutes from what people type: "90", "1:30", "1.5h", "1h 30m", "1ч 30м", "2 год",
 * "45 мин". Returns null when it cannot be read.
 */
export const parseDuration = (input) => {
	const text = String(input || '').trim().toLowerCase().replace(',', '.')
	if (!text) return null
	if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text))
	const clock = text.match(/^(\d+):(\d{1,2})$/)
	if (clock) return Number(clock[1]) * 60 + Number(clock[2])
	const parts = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs|hr|h|часов|часа|час|ч|години|година|годин|год|г|minutes?|mins|min|m|минуты|минута|минут|мин|м|хвилини|хвилина|хвилин|хв)/g)]
	if (!parts.length || parts.map((part) => part[0]).join('').replace(/\s/g, '') !== text.replace(/\s/g, '')) return null
	let minutes = 0
	for (const [, value, unit] of parts) minutes += /^(h|ч|г)/.test(unit) ? Number(value) * 60 : Number(value)
	return Math.round(minutes)
}

/** The due badge: red when late, amber today or tomorrow, green once the card is done. */
export const dueTone = (task, done) => {
	const dueKey = getDueDateKey(task.dueDate)
	if (!dueKey) return null
	if (done) return 'done'
	const today = getLocalDateKey()
	if (dueKey < today) return 'overdue'
	if (dueKey === today) return 'today'
	if (dueKey === addDaysToKey(today, 1)) return 'soon'
	return 'later'
}
