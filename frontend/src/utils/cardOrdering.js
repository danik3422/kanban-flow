// Moving cards between and within lists, as plain data.

/**
 * Where a dragged card lands in a list: before the first card whose middle is
 * below the dragged card's middle. `centers` are the other cards' vertical middles,
 * top to bottom (the dragged card itself is left out).
 */
export const cardDropIndex = (centers, draggedCenterY) => {
	const index = centers.findIndex((center) => draggedCenterY < center)
	return index === -1 ? centers.length : index
}

/** The lists after moving one card to `toColumnId` at `index` (among the other cards there). */
export const moveCardInColumns = (columns, taskId, toColumnId, index) => {
	const source = columns.find((column) => column.tasks.some((task) => task._id === taskId))
	const target = columns.find((column) => column._id === toColumnId)
	if (!source || !target) return columns
	const task = source.tasks.find((item) => item._id === taskId)
	return columns.map((column) => {
		if (column._id !== source._id && column._id !== target._id) return column
		const tasks = column.tasks.filter((item) => item._id !== taskId)
		if (column._id === target._id) {
			const at = Math.max(0, Math.min(index, tasks.length))
			tasks.splice(at, 0, { ...task, column: target._id })
		}
		return { ...column, tasks: tasks.map((item, position) => ({ ...item, position })) }
	})
}

/** Is this move a no-op (same list, same place)? */
export const isSamePlace = (columns, taskId, toColumnId, index) => {
	const source = columns.find((column) => column.tasks.some((task) => task._id === taskId))
	return Boolean(source && source._id === toColumnId && source.tasks.findIndex((task) => task._id === taskId) === index)
}
