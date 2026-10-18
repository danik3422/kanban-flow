import mongoose from 'mongoose'

export const COLUMN_COLORS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'gray']

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
		sortBy: {
			type: String,
			enum: ['date-newest', 'date-oldest', 'name-alpha', 'due-date', 'priority', 'custom', null],
			default: null,
		},
		pinned: {
			type: Boolean,
			default: false,
		},
		// A tint for the whole list; null is the board's plain list colour.
		color: {
			type: String,
			enum: [...COLUMN_COLORS, null],
			default: null,
		},
		// People who get a notification when a card lands in this list.
		watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
	},
	{ timestamps: true }
)

columnSchema.index({ board: 1, position: 1 })

const Column = mongoose.model('Column', columnSchema)
export default Column
