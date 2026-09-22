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
		board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
		task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
		readAt: { type: Date, default: null },
		emailSentAt: { type: Date, default: null },
	},
	{ timestamps: true },
)

notificationSchema.index({ user: 1, createdAt: -1 })

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification