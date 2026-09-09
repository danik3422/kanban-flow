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
