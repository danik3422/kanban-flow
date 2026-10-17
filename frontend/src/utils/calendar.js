import { intlLocale } from '../i18n/translate.js'
import { getLocalDateKey } from './dueDate.js'

/** 1 = Monday … 7 = Sunday, from the locale when the browser knows it. */
export const weekStartFor = (language) => {
	try {
		const info = new Intl.Locale(intlLocale(language)).weekInfo || new Intl.Locale(intlLocale(language)).getWeekInfo?.()
		if (info?.firstDay) return info.firstDay
	} catch {
		// Fall back below.
	}
	return language === 'en' ? 7 : 1
}

const keyOf = (date) => getLocalDateKey(date)

/**
 * The weeks shown for a month: whole weeks from the first to the last day,
 * starting on the locale's first weekday. Always 6 rows so the grid never jumps.
 */
export const monthGrid = (cursor, weekStart) => {
	const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
	const firstWeekday = first.getDay() || 7 // 1..7, Monday = 1
	const offset = (firstWeekday - weekStart + 7) % 7
	const start = new Date(first)
	start.setDate(first.getDate() - offset)
	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(start)
		date.setDate(start.getDate() + index)
		return { date, key: keyOf(date), inMonth: date.getMonth() === cursor.getMonth(), weekday: date.getDay() }
	})
}

/** Short weekday names in display order. */
export const weekdayNames = (language, weekStart, format = 'short') => {
	const monday = new Date(2024, 0, 1) // a Monday
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(monday)
		date.setDate(monday.getDate() + ((weekStart - 1 + index) % 7))
		return new Intl.DateTimeFormat(intlLocale(language), { weekday: format }).format(date)
	})
}

export const shiftMonth = (cursor, months) => new Date(cursor.getFullYear(), cursor.getMonth() + months, 1)

export const dateFromKey = (key) => {
	const [year, month, day] = key.split('-').map(Number)
	return new Date(year, month - 1, day)
}

export const addDays = (key, days) => {
	const date = dateFromKey(key)
	date.setDate(date.getDate() + days)
	return keyOf(date)
}

// "Октябрь 2026" — month names start with a capital letter in titles in every language.
// The month on its own is in the nominative case ("октябрь"); joined with the year
// by Intl it would gain a suffix ("2026 г.") or the genitive in some languages.
export const monthTitle = (cursor, language) => {
	const month = new Intl.DateTimeFormat(intlLocale(language), { month: 'long' }).format(cursor)
	return `${month.charAt(0).toLocaleUpperCase(intlLocale(language))}${month.slice(1)} ${cursor.getFullYear()}`
}

export const dayTitle = (key, language) => {
	const text = new Intl.DateTimeFormat(intlLocale(language), { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromKey(key))
	return text.charAt(0).toLocaleUpperCase(intlLocale(language)) + text.slice(1)
}
