export const getColumnInsertionIndex = (columns, sourceId, centers, pointerX) => {
	const remainingColumns = columns.filter((column) => column._id !== sourceId)
	const insertionIndex = remainingColumns.findIndex(
		(column) => pointerX < centers[column._id],
	)
	return insertionIndex === -1 ? remainingColumns.length : insertionIndex
}

export const reorderColumns = (columns, sourceId, insertionIndex) => {
	const sourceColumn = columns.find((column) => column._id === sourceId)
	if (!sourceColumn) return columns
	const remainingColumns = columns.filter((column) => column._id !== sourceId)
	const nextColumns = [...remainingColumns]
	nextColumns.splice(
		Math.max(0, Math.min(insertionIndex, nextColumns.length)),
		0,
		sourceColumn,
	)
	return nextColumns.map((column, index) => ({ ...column, position: index }))
}

/**
 * Where a dragged list lands: its index among the other lists, judged by the centre
 * of the dragged list against the other lists' centres measured when the drag began.
 * Pinned lists stay put, so the list goes in front of the first unpinned list whose
 * centre is to the right of its own. Picking a list up and putting it back keeps it
 * exactly where it was.
 */
export const getColumnDropIndex = (columns, draggedId, centers, draggedCenterX) => {
	const remaining = columns.filter((column) => column._id !== draggedId)
	const before = remaining.find((column) => !column.pinned && draggedCenterX < centers[column._id])
	return before ? remaining.indexOf(before) : remaining.length
}
