import mongoose from 'mongoose'

const taskActivitySchema = new mongoose.Schema(
	{
		task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
		board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		type: {
			type: String,
			enum: ['created', 'updated', 'moved', 'comment', 'time_logged', 'deleted', 'completed', 'reopened', 'attachment_added', 'copied', 'archived', 'restored'],
			required: true,
		},
		message: { type: String, default: '' },
		fromColumn: { type: String, default: '' },
		toColumn: { type: String, default: '' },
		durationMinutes: { type: Number, default: 0 },
		// Which fields an update touched, so the app can say it in the reader's language.
		fields: { type: [String], default: undefined },
		editedAt: { type: Date, default: null },
		// People a comment calls on with @name; they get their own notification.
		mentions: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: undefined },
	},
	{ timestamps: true },
)

taskActivitySchema.index({ task: 1, createdAt: -1 })

const TaskActivity = mongoose.model('TaskActivity', taskActivitySchema)
export default TaskActivity
