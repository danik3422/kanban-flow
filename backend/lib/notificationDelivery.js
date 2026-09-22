import Notification from '../models/notification.model.js'
import BoardMember from '../models/boardMember.model.js'
import User from '../models/user.model.js'
import { sendTaskNotificationEmail } from './mailer.js'
import { emitUserEvent } from './realtime.js'

const EMAILABLE_TYPES = new Set(['task_assigned', 'task_moved'])
const EMAIL_COOLDOWN_MS = 10 * 60 * 1000

export const notifyTaskRecipients = async ({
	userIds,
	task,
	board,
	actorId,
	type = 'task_assigned',
	title,
	message,
}) => {
	const uniqueUserIds = [...new Set(userIds.map((userId) => userId.toString()))]
	const activeMemberIds = await BoardMember.find({
		board: board._id,
		user: { $in: uniqueUserIds },
	}).distinct('user')
	const ownerId = board.createdBy?.toString()
	const activeRecipientIds = new Set([
		...activeMemberIds.map((userId) => userId.toString()),
		...(ownerId && uniqueUserIds.includes(ownerId) ? [ownerId] : []),
	])
	if (!activeRecipientIds.size) return

	const users = await User.find({
		_id: { $in: [...activeRecipientIds] },
		taskNotifications: { $ne: false },
	}).select('_id email emailNotifications').lean()

	await Promise.all(users.map(async (user) => {
		const notification = await Notification.create({
			user: user._id,
			type,
			title: title || 'You were assigned a task',
			message: message || `You were assigned “${task.title}” in ${board.name}.`,
			board: board._id,
			task: task._id,
		})
		emitUserEvent(user._id.toString(), 'notification:new', notification.toObject())

		const isSelf = actorId && user._id.toString() === actorId.toString()
		if (isSelf || user.emailNotifications === false || !EMAILABLE_TYPES.has(type)) return
		void (async () => {
			const stillHasAccess = ownerId === user._id.toString()
				|| await BoardMember.exists({ board: board._id, user: user._id })
			if (!stillHasAccess) return

			const cooldownBoundary = new Date(Date.now() - EMAIL_COOLDOWN_MS)
			const emailClaim = await User.findOneAndUpdate(
				{
					_id: user._id,
					emailNotifications: { $ne: false },
					$or: [
						{ taskNotificationEmailLastSentAt: null },
						{ taskNotificationEmailLastSentAt: { $lt: cooldownBoundary } },
					],
				},
				{ $set: { taskNotificationEmailLastSentAt: new Date() } },
				{ new: true, projection: '_id email' },
			).lean()
			if (!emailClaim) return

			try {
				await sendTaskNotificationEmail({
					email: emailClaim.email,
					type,
					taskTitle: task.title,
					boardName: board.name,
					message: notification.message,
					boardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/workspaces/${board._id}`,
				})
				await Notification.updateOne({ _id: notification._id }, { $set: { emailSentAt: new Date() } })
			} catch (error) {
				await User.updateOne({ _id: user._id }, { $set: { taskNotificationEmailLastSentAt: null } })
				console.error('Task notification email failed:', error.message)
			}
		})().catch((error) => console.error('Task notification email scheduling failed:', error.message))
	}))
}