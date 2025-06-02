import Board from '../models/board.model.js'

export const boardMiddleware = async (req, res, next) => {
	try {
		const boardId = req.params.id
		const board = await Board.findById(boardId)

		if (!board) {
			return res.status(404).json({ message: 'Board not found.' })
		}
		req.board = board
		next()
	} catch (error) {
		console.error('Board middleware error:', error)
		res.status(500).json({ message: 'Internal Server Error' })
	}
}
