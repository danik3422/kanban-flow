import { weekStartFor } from './calendarDates'

// Choices that belong to this device rather than the account.
const START_PAGE_KEY = 'kh:start-page'
const WEEK_START_KEY = 'kh:week-start'

export const START_PAGES = { boards: '/workspaces', myTasks: '/my-tasks', calendar: '/calendar' }
export const WEEK_STARTS = ['auto', '1', '7']

const read = (key, allowed, fallback) => {
	try {
		const value = localStorage.getItem(key)
		return allowed.includes(value) ? value : fallback
	} catch {
		return fallback
	}
}

const write = (key, value) => {
	try {
		localStorage.setItem(key, value)
	} catch {
		// Applies for this visit only when storage is unavailable.
	}
}

export const getStartPage = () => read(START_PAGE_KEY, Object.keys(START_PAGES), 'boards')
export const setStartPage = (value) => write(START_PAGE_KEY, value)
export const startPagePath = () => START_PAGES[getStartPage()]

export const getWeekStart = () => read(WEEK_START_KEY, WEEK_STARTS, 'auto')
export const setWeekStart = (value) => write(WEEK_START_KEY, value)
/** 1 for Monday or 7 for Sunday: the saved choice, else what the language expects. */
export const resolveWeekStart = (language) => {
	const saved = getWeekStart()
	return saved === 'auto' ? weekStartFor(language) : Number(saved)
}
