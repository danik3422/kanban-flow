import mongoose from 'mongoose'
import cloudinary from '../lib/cloudinary.js'
import { recordBoardActivity } from '../lib/boardActivity.js'
import { emitBoardEvent } from '../lib/realtime.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import TimeEntry from '../models/timeEntry.model.js'

// Card extras: board labels, time tracking, comment edits, attachments, copying and
// watching. Every route checks the person is on the board.

const MAX_LABELS_PER_BOARD = 60
const MAX_ATTACHMENTS = 50
const uploadsEnabled = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)

const memberRole = async (board, userId) => {
	if (board.createdBy.toString() === userId.toString()) return 'owner'
	const membership = await BoardMember.findOne({ board: board._id, user: userId }).select('role').lean()
	return membership?.role || null
}

/** The card, its board and the person's role there; null when they may not see it. */
const cardAccess = async (taskId, userId) => {
	if (!mongoose.Types.ObjectId.isValid(taskId)) return null
	const task = await Task.findById(taskId)
	if (!task) return null
	const column = await Column.findById(task.column).select('board title')
	if (!column) return null
	const board = await Board.findById(column.board)
	if (!board) return null
	const role = await memberRole(board, userId)
	if (!role) return null
	return { task, column, board, role, isManager: role === 'owner' || role === 'admin' }
}

const boardAccess = async (boardId, userId) => {
	if (!mongoose.Types.ObjectId.isValid(boardId)) return null
	const board = await Board.findById(boardId)
	if (!board) return null
	const role = await memberRole(board, userId)
	return role ? { board, role } : null
}

// A card as the board shows it: with its comment count and who is tracking time.
const populatedTask = async (taskId) => {
	const task = await Task.findById(taskId).populate('assignees', 'name email avatar').lean()
	if (!task) return null
	const [commentCount, running] = await Promise.all([
		TaskActivity.countDocuments({ task: task._id, type: 'comment' }),
		TimeEntry.find({ task: task._id, endedAt: null }).select('user startedAt').lean(),
	])
	return { ...task, commentCount, runningTimers: running.map(({ user, startedAt }) => ({ user, startedAt })) }
}

export const emitCommentCount = async (boardId, taskId) => {
	const commentCount = await TaskActivity.countDocuments({ task: taskId, type: 'comment' })
	emitBoardEvent(boardId.toString(), 'task:comments-changed', { taskId: taskId.toString(), commentCount })
}

const emitTask = async (boardId, taskId) => {
	const task = await populatedTask(taskId)
	if (task) emitBoardEvent(boardId.toString(), 'task:updated', task)
	return task
}

export const getFeatures = (req, res) => res.status(200).json({ uploads: uploadsEnabled() })

// ── Board labels ─────────────────────────────────────────────────────────────

export const createBoardLabel = async (req, res) => {
	try {
		const access = await boardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		const { board } = access
		const name = req.body.name.trim()
		if (board.labels.some((label) => label.name.toLowerCase() === name.toLowerCase())) {
			return res.status(400).json({ message: 'A label with this name already exists' })
		}
		if (board.labels.length >= MAX_LABELS_PER_BOARD) return res.status(400).json({ message: 'A board can have up to 60 labels' })
		board.labels.push({ name, color: req.body.color })
		await board.save()
		emitBoardEvent(board._id.toString(), 'board:updated', { _id: board._id, labels: board.labels })
		return res.status(201).json(board.labels)
	} catch (error) {
		console.error('Label creation failed:', error)
		return res.status(500).json({ message: 'Could not create the label' })
	}
}

/** Renaming a label renames it on every card of the board. */
export const updateBoardLabel = async (req, res) => {
	try {
		const access = await boardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		const { board } = access
		const label = board.labels.id(req.params.labelId)
		if (!label) return res.status(404).json({ message: 'Label not found' })
		const previousName = label.name
		if (req.body.name !== undefined) {
			const name = req.body.name.trim()
			if (board.labels.some((item) => item._id.toString() !== label._id.toString() && item.name.toLowerCase() === name.toLowerCase())) {
				return res.status(400).json({ message: 'A label with this name already exists' })
			}
			label.name = name
		}
		if (req.body.color !== undefined) label.color = req.body.color
		await board.save()
		if (label.name !== previousName) {
			const columnIds = await Column.find({ board: board._id }).distinct('_id')
			await Task.updateMany({ column: { $in: columnIds }, labels: previousName }, { $set: { 'labels.$': label.name } })
			emitBoardEvent(board._id.toString(), 'board:content-changed', {})
		}
		emitBoardEvent(board._id.toString(), 'board:updated', { _id: board._id, labels: board.labels })
		return res.status(200).json(board.labels)
	} catch (error) {
		console.error('Label update failed:', error)
		return res.status(500).json({ message: 'Could not change the label' })
	}
}

export const deleteBoardLabel = async (req, res) => {
	try {
		const access = await boardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		const { board } = access
		const label = board.labels.id(req.params.labelId)
		if (!label) return res.status(404).json({ message: 'Label not found' })
		const name = label.name
		label.deleteOne()
		await board.save()
		const columnIds = await Column.find({ board: board._id }).distinct('_id')
		await Task.updateMany({ column: { $in: columnIds } }, { $pull: { labels: name } })
		emitBoardEvent(board._id.toString(), 'board:updated', { _id: board._id, labels: board.labels })
		emitBoardEvent(board._id.toString(), 'board:content-changed', {})
		return res.status(200).json(board.labels)
	} catch (error) {
		console.error('Label deletion failed:', error)
		return res.status(500).json({ message: 'Could not delete the label' })
	}
}

// ── Time tracking ────────────────────────────────────────────────────────────

/** Recount a card's tracked time from its finished entries. */
const syncTrackedSeconds = async (taskId) => {
	const [total] = await TimeEntry.aggregate([
		{ $match: { task: new mongoose.Types.ObjectId(String(taskId)), endedAt: { $ne: null } } },
		{ $group: { _id: null, seconds: { $sum: '$seconds' } } },
	])
	await Task.updateOne({ _id: taskId }, { $set: { trackedSeconds: total?.seconds || 0 } })
	return total?.seconds || 0
}

const finishEntry = async (entry, now = new Date()) => {
	const seconds = Math.max(1, Math.round((now - entry.startedAt) / 1000))
	const finished = await TimeEntry.findOneAndUpdate({ _id: entry._id, endedAt: null }, { $set: { endedAt: now, seconds } }, { returnDocument: 'after' })
	if (finished) await syncTrackedSeconds(finished.task)
	return finished
}

const timeSummary = async (taskId) => {
	const entries = await TimeEntry.find({ task: taskId }).sort({ startedAt: -1 }).limit(200).populate('user', 'name email avatar').lean()
	const byPerson = new Map()
	for (const entry of entries) {
		const key = entry.user?._id?.toString() || 'unknown'
		const current = byPerson.get(key) || { user: entry.user, seconds: 0, running: false }
		if (entry.endedAt) current.seconds += entry.seconds
		else current.running = true
		byPerson.set(key, current)
	}
	return { entries, people: [...byPerson.values()].sort((a, b) => b.seconds - a.seconds) }
}

export const getTaskTime = async (req, res) => {
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		return res.status(200).json({ ...(await timeSummary(access.task._id)), trackedSeconds: access.task.trackedSeconds, estimateMinutes: access.task.estimateMinutes })
	} catch (error) {
		console.error('Task time fetch failed:', error)
		return res.status(500).json({ message: 'Could not load tracked time' })
	}
}

/** Start my timer on this card; a timer I left running elsewhere stops first. */
export const startTimer = async (req, res) => {
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const running = await TimeEntry.find({ user: req.user._id, endedAt: null })
		if (running.some((entry) => entry.task.toString() === access.task._id.toString())) {
			return res.status(400).json({ message: 'Timer is already running' })
		}
		let stopped = null
		for (const entry of running) {
			const finished = await finishEntry(entry)
			if (finished) {
				stopped = { taskId: finished.task, seconds: finished.seconds }
				await emitTask(finished.board, finished.task)
			}
		}
		const entry = await TimeEntry.create({ task: access.task._id, board: access.board._id, user: req.user._id, startedAt: new Date() })
		await emitTask(access.board._id, access.task._id)
		return res.status(201).json({ entry, stopped })
	} catch (error) {
		console.error('Timer start failed:', error)
		return res.status(500).json({ message: 'Could not start the timer' })
	}
}

export const stopTimer = async (req, res) => {
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const entry = await TimeEntry.findOne({ task: access.task._id, user: req.user._id, endedAt: null })
		if (!entry) return res.status(400).json({ message: 'Timer is not running' })
		const finished = await finishEntry(entry)
		// A second "stop" that lost the race has nothing left to log.
		if (!finished) return res.status(400).json({ message: 'Timer is not running' })
		const minutes = Math.max(1, Math.round(finished.seconds / 60))
		await TaskActivity.create({ task: access.task._id, board: access.board._id, user: req.user._id, type: 'time_logged', durationMinutes: minutes, message: 'logged time on this card' })
		await recordBoardActivity({
			boardId: access.board._id,
			userId: req.user._id,
			action: 'logged time',
			entityType: 'task',
			entityId: access.task._id,
			entityName: access.task.title,
			details: `logged ${minutes} minutes on ${access.task.title}`,
		})
		const task = await emitTask(access.board._id, access.task._id)
		return res.status(200).json({ entry: finished, trackedSeconds: task?.trackedSeconds || 0 })
	} catch (error) {
		console.error('Timer stop failed:', error)
		return res.status(500).json({ message: 'Could not stop the timer' })
	}
}

/** Time added by hand: "1h 30m on Tuesday". */
export const addTimeEntry = async (req, res) => {
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const seconds = req.body.minutes * 60
		const endedAt = req.body.date ? new Date(`${req.body.date}T12:00:00.000Z`) : new Date()
		if (endedAt > new Date(Date.now() + 86400000)) return res.status(400).json({ message: 'Time cannot be logged in the future' })
		const entry = await TimeEntry.create({
			task: access.task._id,
			board: access.board._id,
			user: req.user._id,
			startedAt: new Date(endedAt.getTime() - seconds * 1000),
			endedAt,
			seconds,
			note: req.body.note,
			manual: true,
		})
		await syncTrackedSeconds(access.task._id)
		await TaskActivity.create({ task: access.task._id, board: access.board._id, user: req.user._id, type: 'time_logged', durationMinutes: req.body.minutes, message: 'logged time on this card' })
		const task = await emitTask(access.board._id, access.task._id)
		return res.status(201).json({ entry: await entry.populate('user', 'name email avatar'), trackedSeconds: task?.trackedSeconds || 0 })
	} catch (error) {
		console.error('Manual time failed:', error)
		return res.status(500).json({ message: 'Could not add the time' })
	}
}

const entryAccess = async (entryId, userId) => {
	if (!mongoose.Types.ObjectId.isValid(entryId)) return null
	const entry = await TimeEntry.findById(entryId)
	if (!entry) return null
	const access = await cardAccess(entry.task, userId)
	if (!access) return null
	// People edit their own time; board admins can tidy anyone's.
	const canEdit = entry.user.toString() === userId.toString() || access.isManager
	return { entry, access, canEdit }
}

export const updateTimeEntry = async (req, res) => {
	try {
		const found = await entryAccess(req.params.entryId, req.user._id)
		if (!found) return res.status(404).json({ message: 'Time entry not found' })
		if (!found.canEdit) return res.status(403).json({ message: 'You can change only your own time' })
		const { entry, access } = found
		if (!entry.endedAt) return res.status(400).json({ message: 'Stop the timer before changing it' })
		if (req.body.minutes !== undefined) {
			entry.seconds = req.body.minutes * 60
			entry.startedAt = new Date(entry.endedAt.getTime() - entry.seconds * 1000)
		}
		if (req.body.note !== undefined) entry.note = req.body.note
		await entry.save()
		await syncTrackedSeconds(entry.task)
		const task = await emitTask(access.board._id, access.task._id)
		return res.status(200).json({ entry: await entry.populate('user', 'name email avatar'), trackedSeconds: task?.trackedSeconds || 0 })
	} catch (error) {
		console.error('Time entry update failed:', error)
		return res.status(500).json({ message: 'Could not change the time' })
	}
}

export const deleteTimeEntry = async (req, res) => {
	try {
		const found = await entryAccess(req.params.entryId, req.user._id)
		if (!found) return res.status(404).json({ message: 'Time entry not found' })
		if (!found.canEdit) return res.status(403).json({ message: 'You can change only your own time' })
		await found.entry.deleteOne()
		await syncTrackedSeconds(found.entry.task)
		const task = await emitTask(found.access.board._id, found.access.task._id)
		return res.status(200).json({ trackedSeconds: task?.trackedSeconds || 0 })
	} catch (error) {
		console.error('Time entry deletion failed:', error)
		return res.status(500).json({ message: 'Could not delete the time' })
	}
}

/** My running timer anywhere, for the indicator in the app bar. */
export const getRunningTimer = async (req, res) => {
	try {
		const entry = await TimeEntry.findOne({ user: req.user._id, endedAt: null }).lean()
		if (!entry) return res.status(200).json(null)
		const [task, board] = await Promise.all([Task.findById(entry.task).select('title').lean(), Board.findById(entry.board).select('name createdBy').lean()])
		if (!task || !board || !(await memberRole(board, req.user._id))) return res.status(200).json(null)
		return res.status(200).json({ entryId: entry._id, startedAt: entry.startedAt, task: { _id: task._id, title: task.title }, board: { _id: board._id, name: board.name } })
	} catch (error) {
		console.error('Running timer lookup failed:', error)
		return res.status(500).json({ message: 'Could not load the timer' })
	}
}

// ── Comments ─────────────────────────────────────────────────────────────────

const commentAccess = async (req) => {
	const access = await cardAccess(req.params.id, req.user._id)
	if (!access || !mongoose.Types.ObjectId.isValid(req.params.commentId)) return null
	const comment = await TaskActivity.findOne({ _id: req.params.commentId, task: access.task._id, type: 'comment' })
	return comment ? { access, comment } : null
}

export const updateComment = async (req, res) => {
	try {
		const found = await commentAccess(req)
		if (!found) return res.status(404).json({ message: 'Comment not found' })
		if (found.comment.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'You can edit only your own comments' })
		found.comment.message = req.body.message.trim()
		found.comment.editedAt = new Date()
		await found.comment.save()
		await emitCommentCount(found.access.board._id, found.access.task._id)
		return res.status(200).json(await found.comment.populate('user', 'name email avatar'))
	} catch (error) {
		console.error('Comment update failed:', error)
		return res.status(500).json({ message: 'Could not edit the comment' })
	}
}

export const deleteComment = async (req, res) => {
	try {
		const found = await commentAccess(req)
		if (!found) return res.status(404).json({ message: 'Comment not found' })
		const own = found.comment.user.toString() === req.user._id.toString()
		if (!own && !found.access.isManager) return res.status(403).json({ message: 'You can delete only your own comments' })
		await found.comment.deleteOne()
		await emitCommentCount(found.access.board._id, found.access.task._id)
		return res.status(204).send()
	} catch (error) {
		console.error('Comment deletion failed:', error)
		return res.status(500).json({ message: 'Could not delete the comment' })
	}
}

// ── Attachments ──────────────────────────────────────────────────────────────

const addAttachmentRecord = async (access, userId, attachment) => {
	if (access.task.attachments.length >= MAX_ATTACHMENTS) {
		const error = new Error('A card can have up to 50 attachments')
		error.statusCode = 400
		throw error
	}
	access.task.attachments.push({ ...attachment, addedBy: userId })
	await access.task.save()
	await TaskActivity.create({ task: access.task._id, board: access.board._id, user: userId, type: 'attachment_added', message: attachment.name || attachment.url })
	return emitTask(access.board._id, access.task._id)
}

export const addLinkAttachment = async (req, res) => {
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const task = await addAttachmentRecord(access, req.user._id, { kind: 'link', url: req.body.url, name: req.body.name || '' })
		return res.status(201).json(task)
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
		console.error('Attachment failed:', error)
		return res.status(500).json({ message: 'Could not attach the link' })
	}
}

export const addImageAttachment = async (req, res) => {
	try {
		if (!uploadsEnabled()) return res.status(503).json({ message: 'File uploads are not set up on this server' })
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const upload = await cloudinary.uploader.upload(req.body.image, { folder: `cards/${access.task._id}`, resource_type: 'image' })
		const task = await addAttachmentRecord(access, req.user._id, { kind: 'image', url: upload.secure_url, name: req.body.name || '' })
		return res.status(201).json(task)
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
		console.error('Image upload failed:', error)
		return res.status(500).json({ message: 'Could not upload the image' })
	}
}

export const deleteAttachment = async (req, res) => {
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const attachment = access.task.attachments.id(req.params.attachmentId)
		if (!attachment) return res.status(404).json({ message: 'Attachment not found' })
		const own = attachment.addedBy?.toString() === req.user._id.toString()
		if (!own && !access.isManager) return res.status(403).json({ message: 'You can remove only what you attached' })
		attachment.deleteOne()
		await access.task.save()
		const task = await emitTask(access.board._id, access.task._id)
		return res.status(200).json(task)
	} catch (error) {
		console.error('Attachment removal failed:', error)
		return res.status(500).json({ message: 'Could not remove the attachment' })
	}
}

// ── Copy and watch ───────────────────────────────────────────────────────────

/** Copy a card into any list of the same board, right after the original by default. */
export const copyTask = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const { task, board } = access
		const targetColumn = req.body.column ? await Column.findById(req.body.column).select('board title') : access.column
		if (!targetColumn || targetColumn.board.toString() !== board._id.toString()) return res.status(400).json({ message: 'Invalid target column' })
		const sameColumn = targetColumn._id.toString() === task.column.toString()
		const keep = req.body.keep || {}
		let copy
		await session.withTransaction(async () => {
			const position = sameColumn ? task.position + 1 : await Task.countDocuments({ column: targetColumn._id }).session(session)
			await Task.updateMany({ column: targetColumn._id, position: { $gte: position } }, { $inc: { position: 1 } }, { session })
			;[copy] = await Task.create([{
				title: req.body.title.trim(),
				description: task.description,
				column: targetColumn._id,
				position,
				priority: task.priority,
				labels: keep.labels === false ? [] : task.labels,
				checklist: keep.checklist === false ? [] : task.checklist.map(({ text, completed }) => ({ text, completed })),
				assignees: keep.members === false ? [] : task.assignees,
				attachments: keep.attachments === false ? [] : task.attachments.map(({ kind, url, name, addedBy }) => ({ kind, url, name, addedBy })),
				dueDate: keep.dates === false ? null : task.dueDate,
				startDate: keep.dates === false ? null : task.startDate,
				estimateMinutes: task.estimateMinutes,
				cover: task.cover,
			}], { session })
			await TaskActivity.create([{ task: copy._id, board: board._id, user: req.user._id, type: 'copied', message: task.title }], { session })
		})
		emitBoardEvent(board._id.toString(), 'board:content-changed', {})
		return res.status(201).json(await populatedTask(copy._id))
	} catch (error) {
		console.error('Card copy failed:', error)
		return res.status(500).json({ message: 'Could not copy the card' })
	} finally {
		await session.endSession()
	}
}

export const toggleWatchTask = async (req, res) => {
	try {
		const access = await cardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const watching = access.task.watchers.some((id) => id.toString() === req.user._id.toString())
		await Task.updateOne({ _id: access.task._id }, watching ? { $pull: { watchers: req.user._id } } : { $addToSet: { watchers: req.user._id } })
		const task = await emitTask(access.board._id, access.task._id)
		return res.status(200).json({ watching: !watching, task })
	} catch (error) {
		console.error('Watch toggle failed:', error)
		return res.status(500).json({ message: 'Could not change watching' })
	}
}
