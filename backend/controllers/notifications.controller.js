import Notification from '../models/notification.model.js'
import { getAccessibleBoardIds } from '../services/boardAccess.service.js'

// The signed-in person's notifications.

export const getNotifications = async (req, res) => {
	try {
		const accessibleBoardIds = await getAccessibleBoardIds(req.user._id)
		const notifications = await Notification.find({
			user: req.user._id,
			hidden: { $ne: true },
			$or: [
				{ board: { $in: accessibleBoardIds } },
				{ board: { $exists: false } },
			],
		})
			.sort({ createdAt: -1 })
			.limit(50)
			.lean()
		return res.status(200).json(notifications)
	} catch (error) {
		console.error('Notifications fetch failed:', error)
		return res.status(500).json({ message: 'Could not load notifications' })
	}
}

export const markNotificationRead = async (req, res) => {
	try {
		const accessibleBoardIds = await getAccessibleBoardIds(req.user._id)
		const notification = await Notification.findOneAndUpdate(
			{
				_id: req.params.id,
				user: req.user._id,
				$or: [
					{ board: { $in: accessibleBoardIds } },
					{ board: { $exists: false } },
				],
			},
			{ readAt: new Date() },
			{ new: true },
		).lean()
		if (!notification) {
			return res.status(404).json({ message: 'Notification not found' })
		}
		return res.status(200).json(notification)
	} catch (error) {
		console.error('Notification update failed:', error)
		return res.status(500).json({ message: 'Could not update notification' })
	}
}

export const markAllNotificationsRead = async (req, res) => {
	try {
		await Notification.updateMany(
			{ user: req.user._id, readAt: null },
			{ readAt: new Date() },
		)
		return res.status(200).json({ message: 'Notifications marked as read' })
	} catch (error) {
		console.error('Notifications update failed:', error)
		return res.status(500).json({ message: 'Could not update notifications' })
	}
}

export const deleteNotification = async (req, res) => {
	try {
		const accessibleBoardIds = await getAccessibleBoardIds(req.user._id)
		const notification = await Notification.findOneAndDelete({
			_id: req.params.id,
			user: req.user._id,
			$or: [
				{ board: { $in: accessibleBoardIds } },
				{ board: { $exists: false } },
			],
		})
		if (!notification) return res.status(404).json({ message: 'Notification not found' })
		return res.status(204).send()
	} catch (error) {
		console.error('Notification delete failed:', error)
		return res.status(500).json({ message: 'Could not delete notification' })
	}
}
