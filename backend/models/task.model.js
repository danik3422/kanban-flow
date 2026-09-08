import mongoose from 'mongoose'

const taskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
			default: '',
		},
		dueDate: {
			type: Date,
			default: null,
		},
		column: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Column',
			required: true,
		},
		position: {
			type: Number,
			default: 0,
		},
		assignees: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User',
			},
		],
		labels: {
			type: [String],
			default: [],
		},
		checklist: [
			{
				text: { type: String, required: true },
				completed: { type: Boolean, default: false },
			},
		],
	},
	{ timestamps: true }
)

const Task = mongoose.model('Task', taskSchema)
export default Task
