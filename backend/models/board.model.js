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
		// The board's labels: a name and a colour. Cards keep label names.
		labels: [{
			name: { type: String, required: true, maxlength: 40 },
			color: { type: String, default: 'gray' },
		}],
		// "About this board": what it is for, shown in the board menu.
		description: { type: String, default: '', maxlength: 1000 },
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
		publicTokenVersion: {
			type: Number,
			default: 0,
		},
		inviteTokenVersion: {
			type: Number,
			default: 0,
		},
		visibilityVersion: {
			type: Number,
			default: 0,
		},
		// A palette key or a photo (see services/boardBackgrounds.service.js); null means the plain theme.
		background: {
			type: new mongoose.Schema({
				type: { type: String, enum: ['gradient', 'color', 'photo'], required: true },
				key: String,
				id: String,
				url: String,
				thumb: String,
				color: String,
				author: String,
				authorUrl: String,
				// Where the photo is from (Unsplash, Wikimedia Commons) and its licence, for the credit.
				source: String,
				license: String,
			}, { _id: false }),
			default: null,
		},
	},
	{ timestamps: true }
)

boardModel.index({ createdBy: 1 })

const Board = mongoose.model('Board', boardModel)
export default Board
