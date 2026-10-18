import * as templates from './templates.js'

// Sample data for looking at every email while designing (development only).
const base = 'https://kanbanhub.example'
const day = 24 * 60 * 60 * 1000
const tomorrow = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime() + day
const sample = (type, data, minutesAgo = 5) => ({
	type,
	board: 'b1',
	createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
	data: { boardName: 'Mobile app launch', taskTitle: 'Onboarding screens', actorName: 'Olena Koval', ...data },
})

export const SAMPLE_ACTIVITY = {
	task_assigned: sample('task_assigned', { toColumn: 'In progress' }),
	task_unassigned: sample('task_unassigned', {}),
	task_commented: sample('task_commented', { comment: 'Looks great! Can we try the darker illustration on the second screen before Friday?' }),
	task_moved: sample('task_moved', { fromColumn: 'In progress', toColumn: 'Review' }),
	task_due_soon: sample('task_due_soon', { dueDate: new Date(tomorrow) }),
	task_due_changed: sample('task_due_changed', { dueDate: new Date(tomorrow + 3 * day) }),
	list_card_added: sample('list_card_added', { toColumn: 'Ideas', taskTitle: 'Dark mode for widgets' }),
}

export const renderPreview = (name, lang = 'en') => {
	const common = { lang, email: 'olena@example.com', minutes: 60 }
	if (name === 'verify') return templates.verifyEmail({ ...common, url: `${base}/verify-email?token=abc` })
	if (name === 'reset') return templates.resetPassword({ ...common, url: `${base}/login/resetpassword?token=abc` })
	if (name === 'password-added') return templates.passwordAdded({ ...common, url: `${base}/settings#security` })
	if (name === 'provider-linked') return templates.providerLinked({ ...common, provider: 'Google', url: `${base}/settings#security` })
	if (name === 'invite') return templates.boardInvite({ lang, inviter: 'Olena Koval', board: 'Mobile app launch', url: `${base}/invite/abc` })
	if (name === 'digest') {
		return templates.digestEmail({
			lang,
			timezone: 'Europe/Kyiv',
			since: new Date(Date.now() - 60 * 60 * 1000),
			url: base,
			manageUrl: `${base}/settings#notifications`,
			notifications: [
				SAMPLE_ACTIVITY.task_commented,
				SAMPLE_ACTIVITY.task_moved,
				SAMPLE_ACTIVITY.task_due_soon,
				{ ...SAMPLE_ACTIVITY.list_card_added, board: 'b2', data: { ...SAMPLE_ACTIVITY.list_card_added.data, boardName: 'Marketing site' } },
				{ ...SAMPLE_ACTIVITY.task_assigned, board: 'b2', data: { ...SAMPLE_ACTIVITY.task_assigned.data, boardName: 'Marketing site', taskTitle: 'Pricing page copy' } },
			],
		})
	}
	const activity = SAMPLE_ACTIVITY[name]
	if (activity) return templates.activityEmail({ lang, timezone: 'Europe/Kyiv', notification: activity, url: `${base}/workspaces/b1`, manageUrl: `${base}/settings#notifications` })
	return null
}

export const PREVIEW_NAMES = ['verify', 'reset', 'password-added', 'provider-linked', 'invite', ...Object.keys(SAMPLE_ACTIVITY), 'digest']
