const KNOWN_TYPES = new Set(['task_assigned', 'task_unassigned', 'task_commented', 'task_mentioned', 'task_moved', 'task_updated', 'task_due_soon', 'task_due_changed', 'list_card_added'])

// Due dates are calendar days stored at midnight UTC.
const dueLabel = (translate, value, locale) => translate('app.notifications.due', { date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value)) })

/**
 * Notification text in the interface language: what happened (title), the task
 * (message) and where (context: the board, or the columns of a move). The author is
 * shown separately, so no sentence depends on their grammatical gender. Older
 * notifications only have the server's English text.
 */
export const describeNotification = (translate, notification, locale) => {
	const data = notification.data
	if (!data || !KNOWN_TYPES.has(notification.type)) {
		return { title: notification.title, message: notification.message, context: '', actor: '' }
	}
	const context = notification.type === 'task_moved' && data.fromColumn && data.toColumn
		? translate('app.notifications.moved', { from: data.fromColumn, to: data.toColumn })
		: notification.type === 'list_card_added' && data.toColumn
			? [data.boardName, translate('app.notifications.inList', { list: data.toColumn })].filter(Boolean).join(' · ')
			: data.dueDate && (notification.type === 'task_due_soon' || notification.type === 'task_due_changed')
				? [data.boardName, dueLabel(translate, data.dueDate, locale)].filter(Boolean).join(' · ')
				: data.boardName || ''
	return {
		title: translate(`app.notifications.types.${notification.type}.title`),
		message: data.taskTitle ? `«${data.taskTitle}»` : '',
		context,
		actor: data.actorName || '',
	}
}
