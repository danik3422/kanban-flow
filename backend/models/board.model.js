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
		visibility: {
			type: String,
			enum: ['private', 'workspace', 'public'],
			default: 'private',
			index: true,
		},
		publicTokenHash: {
			type: String,
			default: '',
			select: false,
			index: true,
		},
	},
	{ timestamps: true }
)

const Board = mongoose.model('Board', boardModel)
export default Board
