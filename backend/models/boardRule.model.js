import mongoose from 'mongoose'

// Automation rules of a board (services/automation.service.js): "when this happens to
// a card, do that to it", or "on this schedule, do that on the board".

const scheduleSchema = new mongoose.Schema({
	frequency: { type: String, enum: ['daily', 'weekdays', 'weekly', 'monthly'], required: true },
	// 1 = Monday … 7 = Sunday, for weekly rules.
	days: { type: [Number], default: undefined },
	// For monthly rules; a day the month lacks means its last day.
	dayOfMonth: { type: Number, min: 1, max: 31 },
	time: { type: String, default: '09:00' },
	// The rule author's time zone when it was saved: "09:00" is their morning.
	timezone: { type: String, default: 'UTC' },
}, { _id: false })

const actionSchema = new mongoose.Schema({
	type: { type: String, required: true },
	column: { type: mongoose.Schema.Types.ObjectId, ref: 'Column' },
	// The list cards come from (move_list).
	from: { type: mongoose.Schema.Types.ObjectId, ref: 'Column' },
	position: { type: String, enum: ['top', 'bottom'] },
	label: String,
	labels: { type: [String], default: undefined },
	users: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: undefined },
	priority: String,
	// Due date this many days from the day the rule runs (0 = that day).
	days: Number,
	title: String,
	text: String,
	// archive_list: only the finished cards of the list.
	onlyDone: Boolean,
}, { _id: false })

const boardRuleSchema = new mongoose.Schema({
	board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
	createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	name: { type: String, default: '', maxlength: 80 },
	enabled: { type: Boolean, default: true },
	trigger: {
		type: new mongoose.Schema({
			type: { type: String, enum: ['card_added', 'card_created', 'card_moved', 'card_completed', 'checklist_done', 'schedule'], required: true },
			// The list a card trigger watches; none means any list.
			column: { type: mongoose.Schema.Types.ObjectId, ref: 'Column', default: null },
			schedule: { type: scheduleSchema, default: undefined },
		}, { _id: false }),
		required: true,
	},
	actions: { type: [actionSchema], default: [] },
	// When a scheduled rule runs next.
	nextRunAt: { type: Date, default: null },
	runs: { type: Number, default: 0 },
	lastRunAt: { type: Date, default: null },
	// Why the last run skipped something (a list or person no longer on the board).
	lastError: { type: String, default: '' },
}, { timestamps: true })

boardRuleSchema.index({ 'trigger.type': 1, enabled: 1, nextRunAt: 1 })

const BoardRule = mongoose.model('BoardRule', boardRuleSchema)
export default BoardRule
