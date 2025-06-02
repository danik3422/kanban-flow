import mongoose from 'mongoose'

const columnSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		board: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Board',
			required: true,
		},
		position: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
)

const Column = mongoose.model('Column', columnSchema)
export default Column
