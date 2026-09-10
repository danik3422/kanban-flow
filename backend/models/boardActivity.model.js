import mongoose from 'mongoose'

const boardActivitySchema = new mongoose.Schema(
	{
		board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		action: { type: String, required: true, maxlength: 80 },
		entityType: { type: String, required: true, maxlength: 30 },
		entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
		entityName: { type: String, default: '', maxlength: 240 },
		details: { type: String, default: '', maxlength: 500 },
	},
	{ timestamps: true },
)

boardActivitySchema.index({ board: 1, createdAt: -1 })

const BoardActivity = mongoose.model('BoardActivity', boardActivitySchema)
export default BoardActivity