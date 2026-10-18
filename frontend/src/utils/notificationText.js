const KNOWN_TYPES = new Set(['task_assigned', 'task_commented', 'task_moved', 'task_updated', 'list_card_added'])

/**
 * Notification text in the interface language: what happened (title), the task
 * (message) and where (context: the board, or the columns of a move). The author is
 * shown separately, so no sentence depends on their grammatical gender. Older
 * notifications only have the server's English text.
 */
export const describeNotification = (translate, notification) => {
	const data = notification.data
	if (!data || !KNOWN_TYPES.has(notification.type)) {
		return { title: notification.title, message: notification.message, context: '', actor: '' }
	}
	const context = notification.type === 'task_moved' && data.fromColumn && data.toColumn
		? translate('app.notifications.moved', { from: data.fromColumn, to: data.toColumn })
		: notification.type === 'list_card_added' && data.toColumn
			? [data.boardName, translate('app.notifications.inList', { list: data.toColumn })].filter(Boolean).join(' · ')
			: data.boardName || ''
	return {
		title: translate(`app.notifications.types.${notification.type}.title`),
		message: data.taskTitle ? `«${data.taskTitle}»` : '',
		context,
		actor: data.actorName || '',
	}
}
