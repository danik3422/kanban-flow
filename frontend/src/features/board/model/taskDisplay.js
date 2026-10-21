import { intlLocale } from '../../../i18n/translate'
import { addDaysToKey, formatDueDate, getDueDateKey, getLocalDateKey } from '../../../lib/dueDate'

export const PRIORITY_TONE = { low: 'info', medium: 'warning', high: 'orange', urgent: 'danger' }

// "Today", "Tomorrow", "Yesterday" or a short date in the interface language.
export const dueLabel = (dueKey, t, language) => {
	const today = getLocalDateKey()
	if (dueKey === today) return t('myTasks.dueToday')
	if (dueKey === addDaysToKey(today, 1)) return t('myTasks.dueTomorrow')
	if (dueKey === addDaysToKey(today, -1)) return t('myTasks.dueYesterday')
	return formatDueDate(dueKey, { month: 'short', day: 'numeric' }, intlLocale(language))
}

// Overdue is red, today amber; finished work is never shown as late.
export const dueToneFor = (dueDate, done = false) => {
	const dueKey = getDueDateKey(dueDate)
	const todayKey = getLocalDateKey()
	return done || !dueKey ? 'neutral' : dueKey < todayKey ? 'danger' : dueKey === todayKey ? 'warning' : 'neutral'
}
