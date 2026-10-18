const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }
const dueTime = (task) => (task.dueDate ? new Date(task.dueDate).getTime() : Number.POSITIVE_INFINITY)

export const SORT_OPTIONS = ['custom', 'date-newest', 'date-oldest', 'name-alpha', 'due-date', 'priority']

export const sortTasks = (tasks, sortType) => {
	const sortedTasks = [...tasks]
	if (sortType === 'date-newest') {
		sortedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
	} else if (sortType === 'date-oldest') {
		sortedTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
	} else if (sortType === 'name-alpha') {
		sortedTasks.sort((a, b) => a.title.localeCompare(b.title))
	} else if (sortType === 'due-date') {
		// Soonest first; cards without a date go last.
		sortedTasks.sort((a, b) => dueTime(a) - dueTime(b) || (a.position || 0) - (b.position || 0))
	} else if (sortType === 'priority') {
		sortedTasks.sort((a, b) => (PRIORITY_RANK[a.priority || 'none'] ?? 4) - (PRIORITY_RANK[b.priority || 'none'] ?? 4) || (a.position || 0) - (b.position || 0))
	} else {
		sortedTasks.sort((a, b) => (a.position || 0) - (b.position || 0))
	}
	return sortedTasks
}
