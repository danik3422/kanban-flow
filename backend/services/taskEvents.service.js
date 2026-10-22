import { emitBoardEvent } from '../lib/realtime.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import TimeEntry from '../models/timeEntry.model.js'
import { notifyTaskRecipients } from './notificationDelivery.service.js'

// What happens around a card change: its history, notifications and live updates.

// Human-readable field names mapped to comparable snapshots of a task's content.
export const describeTaskContent = (task) => ({
	title: task.title,
	description: task.description || '',
	'due date': task.dueDate ? new Date(task.dueDate).toISOString() : '',
	assignees: (task.assignees || []).map(String).sort().join(','),
	labels: (task.labels || []).join('\u0000'),
	checklist: JSON.stringify((task.checklist || []).map((item) => [item.text, Boolean(item.completed)])),
	priority: task.priority || 'none',
	'start date': task.startDate ? new Date(task.startDate).toISOString() : '',
	estimate: String(task.estimateMinutes || 0),
	cover: task.cover ? JSON.stringify([task.cover.type, task.cover.key || task.cover.id || task.cover.url, task.cover.size]) : '',
	repeat: task.repeat?.frequency ? JSON.stringify([task.repeat.frequency, task.repeat.interval, task.repeat.days, task.repeat.until]) : '',
})

export const recordTaskActivity = async ({ taskId, boardId, userId, type, message = '', fromColumn = '', toColumn = '', durationMinutes = 0, fields }) =>
	TaskActivity.create({
		task: taskId,
		board: boardId,
		user: userId,
		...(fields?.length && { fields }),
		type,
		message,
		fromColumn,
		toColumn,
		durationMinutes,
	})

export const notifyTaskAssignees = async ({ userIds, task, board, actorId, type = 'task_assigned', title, message, details }) => {
	await notifyTaskRecipients({ userIds, task, board, actorId, type, title, message, details })
}

// Watchers of a list hear about cards that land in it (not about their own moves).
export const notifyListWatchers = async ({ column, task, board, actorId, fromColumn = '' }) => {
	const watcherIds = (column.watchers || []).map((watcherId) => watcherId.toString())
	if (!watcherIds.length) return
	await notifyTaskRecipients({
		userIds: watcherIds,
		task,
		board,
		actorId,
		type: 'list_card_added',
		title: 'New card in a list you watch',
		message: `“${task.title}” was added to ${column.title}.`,
		details: { toColumn: column.title, ...(fromColumn && { fromColumn }) },
	})
}

// A card as the board shows it: with its comment count and who is tracking time.
export const populatedTask = async (taskId) => {
	const task = await Task.findById(taskId).populate('assignees', 'name email avatar').lean()
	if (!task) return null
	const [commentCount, running] = await Promise.all([
		TaskActivity.countDocuments({ task: task._id, type: 'comment' }),
		TimeEntry.find({ task: task._id, endedAt: null }).select('user startedAt').lean(),
	])
	return { ...task, commentCount, runningTimers: running.map(({ user, startedAt }) => ({ user, startedAt })) }
}

export const emitTask = async (boardId, taskId) => {
	const task = await populatedTask(taskId)
	if (task) emitBoardEvent(boardId.toString(), 'task:updated', task)
	return task
}

export const emitCommentCount = async (boardId, taskId) => {
	const commentCount = await TaskActivity.countDocuments({ task: taskId, type: 'comment' })
	emitBoardEvent(boardId.toString(), 'task:comments-changed', { taskId: taskId.toString(), commentCount })
}
