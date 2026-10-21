// Tasks have no "done" flag; by kanban convention the last column of a board holds
// finished work (only on boards with two or more columns).
export const finishedColumnIdsOf = (columns) => {
	const columnsByBoard = new Map()
	for (const column of columns) {
		const key = column.board.toString()
		columnsByBoard.set(key, [...(columnsByBoard.get(key) || []), column])
	}
	const finished = new Set()
	for (const boardColumns of columnsByBoard.values()) {
		if (boardColumns.length < 2) continue
		const last = boardColumns.reduce((latest, column) => ((column.position ?? 0) >= (latest.position ?? 0) ? column : latest))
		finished.add(last._id.toString())
	}
	return finished
}
