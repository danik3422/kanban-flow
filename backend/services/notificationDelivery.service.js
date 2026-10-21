import { env } from '../config/env.js'
import BoardMember from '../models/boardMember.model.js'
import Notification from '../models/notification.model.js'
import User from '../models/user.model.js'
import { sendActivityEmail } from '../emails/mailer.js'
import { emitUserEvent } from '../lib/realtime.js'

// Which email preference covers each event; null means it always emails (being added
// to a card), as long as email is not set to "never".
const EMAIL_CATEGORY = {
	task_assigned: null,
	task_unassigned: 'removed',
	task_commented: 'comments',
	task_moved: 'cardsMoved',
	task_due_soon: 'dueDates',
	task_due_changed: 'dueDates',
	list_card_added: 'cardsCreated',
	task_updated: 'cardsMoved',
}

// "Instantly" still has a ceiling; anything past it waits for the next digest.
const INSTANT_LIMIT_PER_HOUR = 30

export const emailFrequencyOf = (user) => user.emailFrequency || (user.emailNotifications === false ? 'never' : 'instant')

export const wantsEmailFor = (user, type) => {
	if (emailFrequencyOf(user) === 'never') return false
	if (!(type in EMAIL_CATEGORY)) return false
	const category = EMAIL_CATEGORY[type]
	return category === null || user.emailPreferences?.[category] !== false
}

const hasBoardAccess = async (board, userId) => board.createdBy?.toString() === userId.toString()
	|| Boolean(await BoardMember.exists({ board: board._id, user: userId }))

const cardUrl = (board, task) => `${env.frontendUrl}/workspaces/${board._id}${task?._id ? `?task=${task._id}` : ''}`

const sendNow = async ({ user, notification, board, task }) => {
	const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
	const sentLastHour = await Notification.countDocuments({ user: user._id, emailStatus: 'sent', emailSentAt: { $gte: hourAgo } })
	if (sentLastHour >= INSTANT_LIMIT_PER_HOUR) {
		await Notification.updateOne({ _id: notification._id }, { $set: { emailStatus: 'pending' } })
		return
	}
	if (!(await hasBoardAccess(board, user._id))) {
		await Notification.updateOne({ _id: notification._id }, { $set: { emailStatus: 'skipped' } })
		return
	}
	try {
		await sendActivityEmail({ email: user.email, language: user.language, timezone: user.timezone, notification, url: cardUrl(board, task) })
		await Notification.updateOne({ _id: notification._id }, { $set: { emailStatus: 'sent', emailSentAt: new Date() } })
	} catch (error) {
		// Not lost: the digest picks it up later.
		await Notification.updateOne({ _id: notification._id }, { $set: { emailStatus: 'pending' } })
		console.error('Activity email failed:', error.message)
	}
}

/**
 * Tells people about a card: under the bell (unless they turned it off), and by email
 * following their frequency and preferences. Nobody hears about their own changes.
 */
export const notifyTaskRecipients = async ({
	userIds,
	task,
	board,
	actorId,
	type = 'task_assigned',
	title,
	message,
	details = {},
}) => {
	const uniqueUserIds = [...new Set(userIds.map((userId) => userId.toString()))]
		.filter((userId) => !actorId || userId !== actorId.toString())
	if (!uniqueUserIds.length) return
	const activeMemberIds = await BoardMember.find({ board: board._id, user: { $in: uniqueUserIds } }).distinct('user')
	const ownerId = board.createdBy?.toString()
	const activeRecipientIds = new Set([
		...activeMemberIds.map((userId) => userId.toString()),
		...(ownerId && uniqueUserIds.includes(ownerId) ? [ownerId] : []),
	])
	if (!activeRecipientIds.size) return

	const users = await User.find({ _id: { $in: [...activeRecipientIds] } })
		.select('_id email language timezone taskNotifications emailNotifications emailFrequency emailPreferences')
		.lean()
	const actor = actorId ? await User.findById(actorId).select('name email').lean() : null
	const data = {
		taskTitle: String(task.title || '').slice(0, 200),
		boardName: String(board.name || '').slice(0, 100),
		...(actor && { actorName: String(actor.name || actor.email || '').slice(0, 120) }),
		...(details.fromColumn && { fromColumn: String(details.fromColumn).slice(0, 60) }),
		...(details.toColumn && { toColumn: String(details.toColumn).slice(0, 60) }),
		...(details.dueDate && { dueDate: new Date(details.dueDate) }),
		...(details.comment && { comment: String(details.comment).slice(0, 300) }),
	}

	await Promise.all(users.map(async (user) => {
		const inApp = user.taskNotifications !== false
		const wantsEmail = wantsEmailFor(user, type)
		if (!inApp && !wantsEmail) return
		const frequency = emailFrequencyOf(user)
		const notification = await Notification.create({
			user: user._id,
			type,
			title: title || 'You were assigned a task',
			message: message || `You were assigned “${task.title}” in ${board.name}.`,
			data,
			board: board._id,
			task: task._id,
			hidden: !inApp,
			emailStatus: !wantsEmail ? 'skipped' : frequency === 'periodic' ? 'pending' : 'none',
		})
		if (inApp) emitUserEvent(user._id.toString(), 'notification:new', notification.toObject())
		if (wantsEmail && frequency === 'instant') {
			void sendNow({ user, notification: notification.toObject(), board, task })
				.catch((error) => console.error('Activity email scheduling failed:', error.message))
		}
	}))
}
