import { esc, label, note, paragraph, renderEmail, taskCard, TONES } from './layout.js'
import { localeOf, translator } from './strings.js'

const TYPE_TONES = {
	task_assigned: 'accent',
	task_unassigned: 'gray',
	task_commented: 'blue',
	task_moved: 'violet',
	task_due_soon: 'amber',
	task_due_changed: 'amber',
	list_card_added: 'accent',
	task_updated: 'gray',
}

const strong = (value) => `<strong>${esc(value)}</strong>`
const accountFooter = (t) => [esc(t('common.footerAccount')), esc(t('common.automated'))]
const activityFooter = (t, manageUrl) => [esc(t('common.footerActivity')), `<a href="${esc(manageUrl)}" style="color:#0f766e;font-weight:600;">${esc(t('common.manage'))}</a>`]

// Plain text twin of each email, for clients that do not show HTML.
const plain = (...parts) => parts.flat().filter(Boolean).join('\n\n')

const dayKey = (date, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

/** "today", "tomorrow" or a short date, in the reader's timezone. */
const whenDue = (value, { t, lang, timeZone, now = new Date() }) => {
	if (!value) return ''
	const due = new Date(value)
	// Due dates are calendar days stored at midnight UTC: read them as that day.
	const dueDay = due.toISOString().slice(0, 10)
	const today = dayKey(now, timeZone)
	const tomorrow = dayKey(new Date(now.getTime() + 86400000), timeZone)
	if (dueDay === today) return t('common.today')
	if (dueDay === tomorrow) return t('common.tomorrow')
	return new Intl.DateTimeFormat(localeOf(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(due)
}

const safeZone = (timeZone) => {
	try {
		new Intl.DateTimeFormat('en', { timeZone })
		return timeZone
	} catch {
		return 'UTC'
	}
}

/** What one notification says in the reader's language: subject line, heading, card details. */
export const describeActivity = (notification, { lang = 'en', timezone = 'UTC', now } = {}) => {
	const t = translator(lang)
	const timeZone = safeZone(timezone)
	const data = notification.data || {}
	const type = notification.type
	const values = {
		actor: data.actorName || t('common.someone'),
		task: data.taskTitle || '',
		list: data.toColumn || '',
		to: data.toColumn || '',
		from: data.fromColumn || '',
		when: whenDue(data.dueDate, { t, lang, timeZone, now }),
		date: whenDue(data.dueDate, { t, lang, timeZone, now }),
	}
	const chips = []
	if (type === 'task_moved' && data.fromColumn && data.toColumn) chips.push({ text: t('activity.moved', values), tone: 'violet' })
	if (data.dueDate && type !== 'task_due_soon') {
		const isSoon = [t('common.today'), t('common.tomorrow')].includes(values.when)
		chips.push({ text: t('activity.due', { date: values.date }), tone: isSoon ? 'red' : 'amber' })
	}
	return {
		type,
		tone: TYPE_TONES[type] || 'gray',
		eyebrow: t(`activity.types.${type}.eyebrow`, values),
		heading: t(`activity.types.${type}.title`, values),
		subject: t(`activity.types.${type}.subject`, values),
		board: data.boardName || '',
		list: type === 'task_moved' || !data.toColumn ? '' : t('activity.inList', values),
		task: data.taskTitle || '',
		chips,
		quote: data.comment || '',
	}
}

export const verifyEmail = ({ lang, email, url, minutes }) => {
	const t = translator(lang)
	return {
		subject: t('verify.subject'),
		text: plain(t('verify.intro', { email }), url, t('common.expires', { minutes }), t('verify.note')),
		html: renderEmail({
			lang,
			title: t('verify.subject'),
			preheader: t('verify.preheader'),
			eyebrow: t('verify.eyebrow'),
			heading: t('verify.title'),
			intro: esc(t('verify.intro', { email: '\u0000' })).replace('\u0000', strong(email)),
			content: paragraph(esc(t('common.expires', { minutes })), { muted: true, size: 14 }),
			cta: { label: t('verify.cta'), url },
			after: note(esc(t('verify.note'))),
			fallbackLabel: t('common.fallback'),
			footer: accountFooter(t),
		}),
	}
}

export const resetPassword = ({ lang, email, url, minutes }) => {
	const t = translator(lang)
	return {
		subject: t('reset.subject'),
		text: plain(t('reset.intro', { email }), url, t('common.expires', { minutes }), t('reset.note')),
		html: renderEmail({
			lang,
			title: t('reset.subject'),
			preheader: t('reset.preheader', { email }),
			eyebrow: t('reset.eyebrow'),
			eyebrowTone: 'amber',
			heading: t('reset.title'),
			intro: esc(t('reset.intro', { email: '\u0000' })).replace('\u0000', strong(email)),
			content: paragraph(esc(t('common.expires', { minutes })), { muted: true, size: 14 }),
			cta: { label: t('reset.cta'), url },
			after: note(esc(t('reset.note'))),
			fallbackLabel: t('common.fallback'),
			footer: accountFooter(t),
		}),
	}
}

const securityEmail = (key, { lang, email, url, provider = '' }) => {
	const t = translator(lang)
	return {
		subject: t(`${key}.subject`, { provider }),
		text: plain(t(`${key}.intro`, { email, provider }), `${t('common.wasntYou')} ${t(`${key}.security`, { provider })}`, url),
		html: renderEmail({
			lang,
			title: t(`${key}.subject`, { provider }),
			preheader: t(`${key}.preheader`, { provider }),
			eyebrow: t(`${key}.eyebrow`),
			eyebrowTone: 'blue',
			heading: t(`${key}.title`, { provider }),
			intro: esc(t(`${key}.intro`, { email: '\u0000', provider })).replace('\u0000', strong(email)),
			cta: { label: t(`${key}.cta`), url },
			after: note(esc(t(`${key}.security`, { provider })), { title: t('common.wasntYou'), tone: 'amber' }),
			footer: accountFooter(t),
		}),
	}
}

export const passwordAdded = (options) => securityEmail('passwordAdded', options)
export const providerLinked = (options) => securityEmail('providerLinked', options)

export const boardInvite = ({ lang, inviter, board, url }) => {
	const t = translator(lang)
	const subject = inviter ? t('invite.subject', { inviter, board }) : t('invite.subjectAnonymous', { board })
	const intro = inviter ? esc(t('invite.intro', { inviter: '\u0000' })).replace('\u0000', strong(inviter)) : esc(t('invite.introAnonymous'))
	return {
		subject,
		text: plain(inviter ? t('invite.intro', { inviter }) : t('invite.introAnonymous'), url, t('invite.note')),
		html: renderEmail({
			lang,
			title: subject,
			preheader: t('invite.preheader'),
			eyebrow: t('invite.eyebrow'),
			heading: t('invite.title', { board }),
			intro,
			cta: { label: t('invite.cta'), url },
			after: note(esc(t('invite.note'))),
			fallbackLabel: t('common.fallback'),
			footer: accountFooter(t),
		}),
	}
}

/** One email for one event (frequency "instantly"). */
export const activityEmail = ({ lang, timezone, notification, url, manageUrl, now }) => {
	const t = translator(lang)
	const item = describeActivity(notification, { lang, timezone, now })
	return {
		subject: item.subject,
		text: plain(item.subject, [item.board, item.list].filter(Boolean).join(' · '), item.quote && `“${item.quote}”`, url, `${t('common.manage')}: ${manageUrl}`),
		html: renderEmail({
			lang,
			title: item.subject,
			preheader: [item.task, item.board].filter(Boolean).join(' · '),
			eyebrow: item.eyebrow,
			eyebrowTone: item.tone,
			heading: item.heading,
			content: taskCard({ board: item.board, list: item.list, title: item.task, chips: item.chips, quote: item.quote }),
			cta: { label: t('activity.cta'), url },
			footer: activityFooter(t, manageUrl),
		}),
	}
}

const MAX_PER_BOARD = 6

/** One email for everything since the last one (frequency "periodically"), by board. */
export const digestEmail = ({ lang, timezone, notifications, since, url, manageUrl, now }) => {
	const t = translator(lang)
	const timeZone = safeZone(timezone)
	const count = notifications.length
	const time = new Intl.DateTimeFormat(localeOf(lang), { hour: '2-digit', minute: '2-digit', timeZone }).format(since)
	const boards = new Map()
	for (const notification of notifications) {
		const item = describeActivity(notification, { lang, timezone, now })
		const key = notification.board?.toString() || item.board
		if (!boards.has(key)) boards.set(key, { name: '', url: `${url}/workspaces/${notification.board || ''}`, items: [] })
		const group = boards.get(key)
		group.name ||= item.board
		group.items.push({ ...item, at: notification.createdAt })
	}
	const clock = (date) => new Intl.DateTimeFormat(localeOf(lang), { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(date))
	const sections = [...boards.values()].map((board) => {
		const shown = board.items.slice(0, MAX_PER_BOARD)
		const rest = board.items.length - shown.length
		const rows = shown.map((item) => `
			<tr>
				<td width="14" valign="top" style="padding:16px 0 0;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${(TONES[item.tone] || TONES.gray).dot};"></span></td>
				<td valign="top" class="kh-rule" style="padding:12px 0;border-bottom:1px solid #e8efec;">
					<div class="kh-text" style="color:#10201d;font-size:14px;font-weight:700;line-height:1.4;">${esc(item.heading)}</div>
					<div class="kh-text2" style="margin:2px 0 0;color:#3f504c;font-size:14px;line-height:1.45;">${esc(item.task)}${item.list ? ` <span class="kh-muted" style="color:#6b7b77;">· ${esc(item.list)}</span>` : ''}</div>
					${item.chips.length ? `<div style="margin:6px 0 0;">${item.chips.map(({ text, tone }) => label(text, tone)).join('&nbsp; ')}</div>` : ''}
					${item.quote ? `<div class="kh-muted" style="margin:6px 0 0;color:#6b7b77;font-size:13px;line-height:1.5;">“${esc(item.quote)}”</div>` : ''}
				</td>
				<td width="54" valign="top" align="right" class="kh-muted kh-rule" style="padding:13px 0 0;border-bottom:1px solid #e8efec;color:#6b7b77;font-size:12px;">${esc(clock(item.at))}</td>
			</tr>`).join('')
		return `
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 0;">
			<tr><td colspan="3" style="padding:0 0 2px;"><a href="${esc(board.url)}" class="kh-text" style="color:#10201d;font-size:15px;font-weight:800;text-decoration:none;">${esc(board.name)}</a></td></tr>
			${rows}
			${rest > 0 ? `<tr><td></td><td colspan="2" class="kh-muted" style="padding:10px 0 0;color:#6b7b77;font-size:13px;">${esc(t('digest.more', { count: rest }))}</td></tr>` : ''}
		</table>`
	}).join('')
	const textLines = [...boards.values()].flatMap((board) => [`${board.name}`, ...board.items.map((item) => `• ${item.heading}: ${item.task}${item.quote ? ` — “${item.quote}”` : ''}`)])
	return {
		subject: t('digest.subject', { count }),
		text: plain(t('digest.intro', { time }), textLines.join('\n'), url, `${t('common.manage')}: ${manageUrl}`),
		html: renderEmail({
			lang,
			title: t('digest.subject', { count }),
			preheader: t('digest.preheader'),
			eyebrow: t('digest.eyebrow'),
			heading: t('digest.title', { count }),
			intro: esc(t('digest.intro', { time })),
			content: sections,
			cta: { label: t('digest.cta'), url },
			footer: activityFooter(t, manageUrl),
		}),
	}
}
