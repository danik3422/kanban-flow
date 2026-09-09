import Notification from '../models/notification.model.js'

export const getNotifications = async (req, res) => {
	try {
		const notifications = await Notification.find({ user: req.user._id })
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
		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.id, user: req.user._id },
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