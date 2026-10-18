import mongoose from 'mongoose'

// One stretch of work on a card by one person: a running timer (no endedAt yet),
// or time added by hand. The card's trackedSeconds sums the finished ones.
const timeEntrySchema = new mongoose.Schema(
	{
		task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
		board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		startedAt: { type: Date, required: true },
		endedAt: { type: Date, default: null },
		seconds: { type: Number, default: 0, min: 0 },
		note: { type: String, default: '', maxlength: 200 },
		manual: { type: Boolean, default: false },
	},
	{ timestamps: true },
)

// One running timer per person at a time.
timeEntrySchema.index({ user: 1, endedAt: 1 })

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema)
export default TimeEntry
