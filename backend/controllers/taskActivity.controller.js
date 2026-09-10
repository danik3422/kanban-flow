import mongoose from 'mongoose'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import { recordBoardActivity } from '../lib/boardActivity.js'

const getAccessibleTask = async (taskId, userId) => {
	if (!mongoose.Types.ObjectId.isValid(taskId)) return null
	const task = await Task.findById(taskId).populate('column', 'board')
	if (!task) return null
	const board = await Board.findById(task.column.board).select('createdBy')
	if (!board) return null
	const isOwner = board.createdBy.toString() === userId.toString()
	const isMember = await BoardMember.exists({ board: board._id, user: userId })
	if (!isOwner && !isMember) return null
	return { task, board }
}

export const getTaskActivities = async (req, res) => {
	try {
		const access = await getAccessibleTask(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const activities = await TaskActivity.find({ task: access.task._id })
			.populate('user', 'name email avatar')
			.sort({ createdAt: -1 })
			.limit(100)
			.lean()
		return res.status(200).json(activities)
	} catch (error) {
		console.error('Task activity fetch failed:', error)
		return res.status(500).json({ message: 'Could not load task activity' })
	}
}

export const addTaskComment = async (req, res) => {
	try {
		const access = await getAccessibleTask(req.params.id, req.user._id)
		const message = req.body.message?.trim()
		if (!access) return res.status(404).json({ message: 'Task not found' })
		if (!message) return res.status(400).json({ message: 'Comment is required' })
		if (message.length > 2000) return res.status(400).json({ message: 'Comment is too long' })
		const activity = await TaskActivity.create({
			task: access.task._id,
			board: access.board._id,
			user: req.user._id,
			type: 'comment',
			message,
		})
		await recordBoardActivity({
			boardId: access.board._id,
			userId: req.user._id,
			action: 'commented',
			entityType: 'task',
			entityId: access.task._id,
			entityName: access.task.title,
			details: `commented on ${access.task.title}`,
		})
		return res.status(201).json(await activity.populate('user', 'name email avatar'))
	} catch (error) {
		console.error('Task comment creation failed:', error)
		return res.status(500).json({ message: 'Could not add task comment' })
	}
}

export const startTaskTimer = async (req, res) => {
	try {
		const access = await getAccessibleTask(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		if (access.task.timerStartedAt) return res.status(400).json({ message: 'Timer is already running' })
		access.task.timerStartedAt = new Date()
		await access.task.save()
		await recordBoardActivity({
			boardId: access.board._id,
			userId: req.user._id,
			action: 'started timer',
			entityType: 'task',
			entityId: access.task._id,
			entityName: access.task.title,
			details: `started a timer on ${access.task.title}`,
		})
		return res.status(200).json({ timerStartedAt: access.task.timerStartedAt, trackedSeconds: access.task.trackedSeconds })
	} catch (error) {
		console.error('Task timer start failed:', error)
		return res.status(500).json({ message: 'Could not start task timer' })
	}
}

export const stopTaskTimer = async (req, res) => {
	try {
		const access = await getAccessibleTask(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		if (!access.task.timerStartedAt) return res.status(400).json({ message: 'Timer is not running' })
		const durationSeconds = Math.max(1, Math.round((Date.now() - access.task.timerStartedAt.getTime()) / 1000))
		access.task.trackedSeconds += durationSeconds
		access.task.timerStartedAt = null
		await access.task.save()
		const activity = await TaskActivity.create({
			task: access.task._id,
			board: access.board._id,
			user: req.user._id,
			type: 'time_logged',
			durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
			message: 'logged time on this card',
		})
		await recordBoardActivity({
			boardId: access.board._id,
			userId: req.user._id,
			action: 'logged time',
			entityType: 'task',
			entityId: access.task._id,
			entityName: access.task.title,
			details: `logged ${Math.max(1, Math.round(durationSeconds / 60))} minutes on ${access.task.title}`,
		})
		return res.status(200).json({ trackedSeconds: access.task.trackedSeconds, activity })
	} catch (error) {
		console.error('Task timer stop failed:', error)
		return res.status(500).json({ message: 'Could not stop task timer' })
	}
}
