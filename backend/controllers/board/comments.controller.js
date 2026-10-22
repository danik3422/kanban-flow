import mongoose from 'mongoose'

import BoardMember from '../../models/boardMember.model.js'
import TaskActivity from '../../models/taskActivity.model.js'
import { getAccessibleTask, getCardAccess } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'
import { notifyTaskRecipients } from '../../services/notificationDelivery.service.js'
import { emitCommentCount } from '../../services/taskEvents.service.js'

// A card's activity feed and its comments, which can call on people with @name.

const PEOPLE_FIELDS = 'name email avatar'
const withPeople = (query) => query.populate('user', PEOPLE_FIELDS).populate('mentions', PEOPLE_FIELDS)

/** The mentioned ids that belong to people on the board, without the author. */
const mentionedPeople = async (board, ids, authorId) => {
	const unique = [...new Set((ids || []).map(String))].filter((id) => id !== authorId.toString())
	if (!unique.length) return []
	const memberIds = await BoardMember.find({ board: board._id, user: { $in: unique } }).distinct('user')
	const allowed = new Set([board.createdBy.toString(), ...memberIds.map(String)])
	return unique.filter((id) => allowed.has(id))
}

const notifyMentioned = (userIds, { req, task, board, message }) => {
	const actorName = req.user.name || req.user.email || 'Someone'
	return notifyTaskRecipients({
		userIds,
		actorId: req.user._id,
		task,
		board,
		type: 'task_mentioned',
		title: 'You were mentioned',
		message: `${actorName} mentioned you on “${task.title}”`,
		details: { comment: message },
	})
}

export const getTaskActivities = async (req, res) => {
	try {
		const access = await getAccessibleTask(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const activities = await withPeople(TaskActivity.find({ task: access.task._id }))
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
		const mentions = await mentionedPeople(access.board, req.body.mentions, req.user._id)
		const activity = await TaskActivity.create({
			task: access.task._id,
			board: access.board._id,
			user: req.user._id,
			type: 'comment',
			message,
			...(mentions.length && { mentions }),
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

		const actorName = req.user.name || req.user.email || 'Someone'
		// People called on hear about it as a mention; assignees and watchers as a comment.
		await notifyMentioned(mentions, { req, task: access.task, board: access.board, message })
		const assigneeUserIds = [...new Set([...(access.task.assignees || []), ...(access.task.watchers || [])].map((id) => id.toString()).filter((id) => id !== req.user._id.toString() && !mentions.includes(id)))]
		await notifyTaskRecipients({
			userIds: assigneeUserIds,
			actorId: req.user._id,
			task: access.task,
			board: access.board,
			type: 'task_commented',
			title: 'New task update',
			message: `${actorName} commented on “${access.task.title}”`,
			details: { comment: message },
		})

		await emitCommentCount(access.board._id, access.task._id)
		return res.status(201).json(await activity.populate([{ path: 'user', select: PEOPLE_FIELDS }, { path: 'mentions', select: PEOPLE_FIELDS }]))
	} catch (error) {
		console.error('Task comment creation failed:', error)
		return res.status(500).json({ message: 'Could not add task comment' })
	}
}

const commentAccess = async (req) => {
	const access = await getCardAccess(req.params.id, req.user._id)
	if (!access || !mongoose.Types.ObjectId.isValid(req.params.commentId)) return null
	const comment = await TaskActivity.findOne({ _id: req.params.commentId, task: access.task._id, type: 'comment' })
	return comment ? { access, comment } : null
}

export const updateComment = async (req, res) => {
	try {
		const found = await commentAccess(req)
		if (!found) return res.status(404).json({ message: 'Comment not found' })
		if (found.comment.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'You can edit only your own comments' })
		const message = req.body.message.trim()
		const mentions = await mentionedPeople(found.access.board, req.body.mentions, req.user._id)
		// Only people newly called on by the edit hear about it.
		const before = new Set((found.comment.mentions || []).map(String))
		found.comment.message = message
		found.comment.mentions = mentions.length ? mentions : undefined
		found.comment.editedAt = new Date()
		await found.comment.save()
		await notifyMentioned(mentions.filter((id) => !before.has(id)), { req, task: found.access.task, board: found.access.board, message })
		await emitCommentCount(found.access.board._id, found.access.task._id)
		return res.status(200).json(await found.comment.populate([{ path: 'user', select: PEOPLE_FIELDS }, { path: 'mentions', select: PEOPLE_FIELDS }]))
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
