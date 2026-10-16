// Due dates are calendar days: the API stores "2026-10-16" as UTC midnight.
// Read them back in UTC so the day never shifts with the viewer's timezone,
// and compare against the viewer's local "today".

export const getDueDateKey = (dueDate) => {
	if (!dueDate) return ''
	const date = new Date(dueDate)
	return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export const getLocalDateKey = (date = new Date()) => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

export const addDaysToKey = (dateKey, days) => {
	const date = new Date(`${dateKey}T00:00:00Z`)
	date.setUTCDate(date.getUTCDate() + days)
	return date.toISOString().slice(0, 10)
}

export const getDueDateState = (dueDate, now = new Date()) => {
	const dueKey = getDueDateKey(dueDate)
	if (!dueKey) return null
	const todayKey = getLocalDateKey(now)
	if (dueKey < todayKey) return 'overdue'
	return dueKey === todayKey ? 'today' : 'upcoming'
}

export const formatDueDate = (dueDate, options = { month: 'short', day: 'numeric' }) => {
	const dueKey = getDueDateKey(dueDate)
	if (!dueKey) return ''
	return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(
		new Date(`${dueKey}T00:00:00Z`),
	)
}
