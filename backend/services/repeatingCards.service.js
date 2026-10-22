import { emitBoardEvent } from '../lib/realtime.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import TimeEntry from '../models/timeEntry.model.js'
import { finishedColumnIdsOf } from './finishedColumns.service.js'
import { nextDueKey, todayKeyIn } from './recurrence.service.js'
import { populatedTask, recordTaskActivity } from './taskEvents.service.js'

// The life of a repeating card: completing it brings the next one of the series,
// un-completing it right away takes that one back.

const dayKey = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null)
const DAY = 24 * 60 * 60 * 1000

/**
 * Creates the next card of the series: same content with the checklist unticked, due on
 * the next date, in the same list (or the board's first list when this one sits in the
 * last, "done" list). The rule moves to the new card. Returns it, or null when the series ended.
 */
export const startNextInSeries = async (task, boardId, user) => {
	const dueKey = dayKey(task.dueDate)
	const nextKey = nextDueKey(task.repeat, dueKey, todayKeyIn(user.timezone))
	if (!nextKey) {
		await Task.updateOne({ _id: task._id }, { $set: { repeat: null } })
		task.repeat = null
		return null
	}
	const columns = await Column.find({ board: boardId }).sort({ position: 1 }).select('_id board position title').lean()
	const currentId = (task.column?._id || task.column).toString()
	const column = finishedColumnIdsOf(columns).has(currentId) ? columns[0] : columns.find((item) => item._id.toString() === currentId) || columns[0]
	const shift = dueKey ? Date.parse(`${nextKey}T00:00:00Z`) - Date.parse(`${dueKey}T00:00:00Z`) : 0
	const next = await Task.create({
		column: column._id,
		position: await Task.countDocuments({ column: column._id }),
		title: task.title,
		description: task.description,
		labels: task.labels,
		checklist: (task.checklist || []).map(({ text }) => ({ text, completed: false })),
		assignees: task.assignees,
		watchers: task.watchers,
		priority: task.priority,
		estimateMinutes: task.estimateMinutes,
		// A cover from the card's own attachments stays with that card.
		cover: task.cover && !/^attachment-/.test(task.cover.id || '') ? task.cover : null,
		dueDate: new Date(`${nextKey}T00:00:00Z`),
		startDate: task.startDate && dueKey ? new Date(new Date(task.startDate).getTime() + Math.round(shift / DAY) * DAY) : null,
		repeat: task.repeat,
	})
	await Task.updateOne({ _id: task._id }, { $set: { repeat: null, repeatedTo: next._id } })
	task.repeat = null
	task.repeatedTo = next._id
	await recordTaskActivity({ taskId: next._id, boardId, userId: user._id, type: 'created', message: `repeated from “${task.title}”`, toColumn: column.title })
	const created = await populatedTask(next._id)
	emitBoardEvent(boardId.toString(), 'task:created', created)
	return created
}

/**
 * Un-completing a card takes back the card its completion created, as long as nobody has
 * worked on that one yet (no comments, no time, not completed); the rule comes back too.
 */
export const takeBackNextInSeries = async (task, boardId) => {
	const next = await Task.findById(task.repeatedTo)
	const untouched = next && !next.completed && !next.trackedSeconds
		&& !(await TaskActivity.exists({ task: next._id, type: 'comment' }))
		&& !(await TimeEntry.exists({ task: next._id }))
	task.repeatedTo = null
	if (!untouched) {
		await Task.updateOne({ _id: task._id }, { $set: { repeatedTo: null } })
		return
	}
	task.repeat = next.repeat
	await Task.updateOne({ _id: task._id }, { $set: { repeatedTo: null, repeat: next.repeat } })
	await Task.deleteOne({ _id: next._id })
	await Task.updateMany({ column: next.column, position: { $gt: next.position }, archivedAt: null }, { $inc: { position: -1 } })
	await Promise.all([
		TaskActivity.deleteMany({ task: next._id }),
		Notification.deleteMany({ task: next._id }),
	])
	emitBoardEvent(boardId.toString(), 'task:deleted', { taskId: next._id.toString() })
}
