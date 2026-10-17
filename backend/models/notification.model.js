import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		type: {
			type: String,
			enum: ['task_assigned', 'task_commented', 'task_moved', 'task_updated'],
			required: true,
		},
		title: { type: String, required: true },
		message: { type: String, required: true },
		// The facts behind the text, so the app can show it in the reader's language.
		data: {
			type: new mongoose.Schema({
				taskTitle: { type: String, maxlength: 200 },
				boardName: { type: String, maxlength: 100 },
				actorName: { type: String, maxlength: 120 },
				fromColumn: { type: String, maxlength: 60 },
				toColumn: { type: String, maxlength: 60 },
			}, { _id: false }),
			default: undefined,
		},
		board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
		task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
		readAt: { type: Date, default: null },
		emailSentAt: { type: Date, default: null },
	},
	{ timestamps: true },
)

notificationSchema.index({ user: 1, createdAt: -1 })

// Task and board deletions clean up notifications by these keys.
notificationSchema.index({ task: 1 })
notificationSchema.index({ board: 1 })

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification