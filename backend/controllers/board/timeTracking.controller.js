import mongoose from 'mongoose'

import Board from '../../models/board.model.js'
import Task from '../../models/task.model.js'
import TaskActivity from '../../models/taskActivity.model.js'
import TimeEntry from '../../models/timeEntry.model.js'
import { getBoardRole, getCardAccess } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'
import { emitTask } from '../../services/taskEvents.service.js'

// Time tracking on cards: timers, time added by hand, and edits to entries.

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
		const access = await getCardAccess(req.params.id, req.user._id)
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
		const access = await getCardAccess(req.params.id, req.user._id)
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
		const access = await getCardAccess(req.params.id, req.user._id)
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
		const access = await getCardAccess(req.params.id, req.user._id)
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
	const access = await getCardAccess(entry.task, userId)
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
		if (!task || !board || !(await getBoardRole(board, req.user._id))) return res.status(200).json(null)
		return res.status(200).json({ entryId: entry._id, startedAt: entry.startedAt, task: { _id: task._id, title: task.title }, board: { _id: board._id, name: board.name } })
	} catch (error) {
		console.error('Running timer lookup failed:', error)
		return res.status(500).json({ message: 'Could not load the timer' })
	}
}
