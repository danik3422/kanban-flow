export const sortTasks = (tasks, sortType) => {
	const sortedTasks = [...tasks]
	if (sortType === 'date-newest') {
		sortedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
	} else if (sortType === 'date-oldest') {
		sortedTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
	} else if (sortType === 'name-alpha') {
		sortedTasks.sort((a, b) => a.title.localeCompare(b.title))
	} else {
		sortedTasks.sort((a, b) => (a.position || 0) - (b.position || 0))
	}
	return sortedTasks
}
