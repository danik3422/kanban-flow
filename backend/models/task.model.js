import mongoose from 'mongoose'

import { archivable } from './archivable.js'

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
		// When assignees were reminded that the due date is close (cleared when it changes).
		dueReminderSentAt: { type: Date, default: null },
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
		priority: {
			type: String,
			enum: ['none', 'low', 'medium', 'high', 'urgent'],
			default: 'none',
		},
		// Total of finished time entries (see TimeEntry); kept here for the card face.
		trackedSeconds: { type: Number, default: 0 },
		// Older single shared timer, superseded by per-person time entries.
		timerStartedAt: { type: Date, default: null },
		estimateMinutes: { type: Number, default: 0, min: 0 },
		startDate: { type: Date, default: null },
		// Marked done on the card itself (the round checkbox), wherever it sits.
		completed: { type: Boolean, default: false },
		completedAt: { type: Date, default: null },
		cover: {
			type: new mongoose.Schema({
				type: { type: String, enum: ['color', 'photo'], required: true },
				id: String,
				key: String,
				license: String,
				url: String,
				thumb: String,
				color: String,
				author: String,
				authorUrl: String,
				source: String,
				// strip: a band above the title; full: the photo or colour fills the card.
				size: { type: String, enum: ['strip', 'full'], default: 'strip' },
			}, { _id: false }),
			default: null,
		},
		attachments: [{
			kind: { type: String, enum: ['link', 'image'], default: 'link' },
			url: { type: String, required: true },
			name: { type: String, default: '' },
			addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			createdAt: { type: Date, default: Date.now },
		}],
		// People who follow the card: they hear about comments and moves.
		watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
	},
	{ timestamps: true },
)

// Archived together with its list (restored with it), rather than on its own.
taskSchema.add({ archivedWithColumn: { type: Boolean, default: false } })
taskSchema.plugin(archivable)

taskSchema.index({ column: 1, position: 1 })
taskSchema.index({ assignees: 1 })

const Task = mongoose.model('Task', taskSchema)
export default Task
