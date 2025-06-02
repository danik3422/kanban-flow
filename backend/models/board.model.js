import mongoose from 'mongoose'

const boardModel = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true }
)

const Board = mongoose.model('Board', boardModel)
export default Board
