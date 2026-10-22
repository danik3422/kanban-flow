import Board from '../models/board.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'

// Ceilings that keep one account from filling the database or making a board too
// large to load. Generous for real use; copies hit them long before typing does.
export const MAX_CARDS_PER_BOARD = 5000
export const MAX_BOARDS_PER_USER = 200
// These match the reorder payload limits so every board stays reorderable.
export const MAX_COLUMNS_PER_BOARD = 100
export const MAX_TASKS_PER_COLUMN = 2000

export const boardCardLimitMessage = `A board can hold up to ${MAX_CARDS_PER_BOARD} cards`
export const boardLimitMessage = `You can own up to ${MAX_BOARDS_PER_USER} boards`

/** True when adding `extra` cards would take the board over its ceiling. Archived cards count: they still take space. */
export const exceedsBoardCardLimit = async (boardId, extra = 1) => {
	const columnIds = await Column.find({ board: boardId }).setOptions({ withArchived: true }).distinct('_id')
	const count = await Task.countDocuments({ column: { $in: columnIds } }).setOptions({ withArchived: true })
	return count + extra > MAX_CARDS_PER_BOARD
}

export const reachedBoardLimit = async (userId) =>
	(await Board.countDocuments({ createdBy: userId })) >= MAX_BOARDS_PER_USER
