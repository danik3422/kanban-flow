import { CloudUpload, MessageSquare, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { intlLocale, translateServerMessageCurrent } from '../../../i18n/translate'
import { axiosInstance } from '../../../lib/axios'
import { cacheKey, writeCache } from '../../../lib/apiCache'
import { makeTempId } from '../../../lib/outbox'
import { useAuthStore } from '../../../store/useAuthStore'
import { Avatar, Button, ConfirmDialog } from '../../../ui'
import { cx } from '../../../ui/utils'
import { formatDuration } from '../model/cardDisplay'
import { mentionIdsIn, splitMentions } from '../model/mentions'
import { describeRun } from '../automation/ruleModel'
import { relativeTime } from '../../../lib/relativeTime'
import MentionTextarea from './MentionTextarea'

/** An activity record in the reader's language. */
const describe = (t, item) => {
	const units = { h: t('card.units.h'), m: t('card.units.m') }
	switch (item.type) {
		case 'moved': return t('card.activity.moved', { from: item.fromColumn, to: item.toColumn })
		case 'created': return t('card.activity.created', { list: item.toColumn || item.message.replace(/^added this card to /, '') })
		case 'updated': return item.fields?.length
			? t('card.activity.updated', { fields: item.fields.map((field) => t(`card.fields.${field}`)).join(', ') })
			: item.message
		case 'time_logged': return t('card.activity.time_logged', { time: formatDuration((item.durationMinutes || 0) * 60, units) })
		case 'attachment_added': return t('card.activity.attachment_added', { name: item.message })
		case 'copied': return t('card.activity.copied', { name: item.message })
		case 'restored': return item.toColumn ? t('card.activity.restored', { list: item.toColumn }) : item.message
		case 'automation': return describeRun(t, item)
		case 'archived':
		case 'completed':
		case 'reopened':
		case 'deleted':
			return t(`card.activity.${item.type}`)
		default: return item.message
	}
}

/** A comment's text with the people it mentions picked out ("you" stands out more). */
const CommentText = ({ message, mentions, meId }) => (
	<p className='cc__message' data-i18n-ignore>
		{splitMentions(message, mentions).map((part, index) => (part.person
			? <span key={index} className={cx('cc__mention', String(part.person._id) === String(meId) && 'is-me')}>{part.text}</span>
			: part.text))}
	</p>
)

/**
 * Comments, newest first, with the card's history mixed in when "Show details" is
 * on. People edit and delete their own comments; admins can delete any. Typing "@"
 * suggests people on the board; they are notified when the comment is saved.
 */
const CardComments = ({ task, meId, canManage, version, people = [] }) => {
	const { t, language } = useI18n()
	const [items, setItems] = useState(null)
	const [details, setDetails] = useState(false)
	const [draft, setDraft] = useState('')
	const [busy, setBusy] = useState(false)
	const [editing, setEditing] = useState(null) // { id, text }
	const [removing, setRemoving] = useState(null)
	const authUser = useAuthStore((state) => state.authUser)

	const load = useCallback(async () => {
		try {
			const { data } = await axiosInstance.get(`/board/tasks/${task._id}/activities`)
			setItems(data)
		} catch {
			setItems([])
		}
	}, [task._id])
	useEffect(() => {
		queueMicrotask(load)
	}, [load, version])

	const fail = (error) => toast.error(translateServerMessageCurrent(error.response?.data?.message, 'card.saveError'))
	const post = async (event) => {
		event?.preventDefault()
		const message = draft.trim()
		if (!message) return
		setBusy(true)
		try {
			// Without a connection the comment is kept on this device and sent later, once.
			const clientId = makeTempId()
			const mentions = mentionIdsIn(message, people)
			const pending = { _id: clientId, type: 'comment', message, createdAt: new Date().toISOString(), pending: true, user: { _id: authUser?._id, name: authUser?.name, email: authUser?.email, avatar: authUser?.avatar }, mentions: people.filter((person) => mentions.includes(String(person._id))) }
			const { data } = await axiosInstance.post(`/board/tasks/${task._id}/comments`, { message, mentions, clientId }, { offline: { response: pending } })
			setItems((current) => {
				const next = [data, ...(current || [])]
				if (data.pending) writeCache(cacheKey(`/board/tasks/${task._id}/activities`), next)
				return next
			})
			setDraft('')
		} catch (error) {
			fail(error)
		} finally {
			setBusy(false)
		}
	}
	const saveEdit = async (event) => {
		event.preventDefault()
		if (!editing?.text.trim()) return
		try {
			const message = editing.text.trim()
			const { data } = await axiosInstance.patch(`/board/tasks/${task._id}/comments/${editing.id}`, { message, mentions: mentionIdsIn(message, people) })
			setItems((current) => current.map((item) => (item._id === data._id ? data : item)))
			setEditing(null)
		} catch (error) {
			fail(error)
		}
	}
	const remove = async () => {
		try {
			await axiosInstance.delete(`/board/tasks/${task._id}/comments/${removing._id}`)
			setItems((current) => current.filter((item) => item._id !== removing._id))
		} catch (error) {
			fail(error)
		} finally {
			setRemoving(null)
		}
	}

	const shown = (items || []).filter((item) => details || item.type === 'comment')
	const fullDate = (value) => new Intl.DateTimeFormat(intlLocale(language), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

	return (
		<div className='cc'>
			<div className='cc__head'>
				<MessageSquare size={18} aria-hidden='true' />
				<h3 className='cc__title'>{t('card.commentsTitle')}</h3>
				<Button variant='secondary' size='sm' aria-pressed={details} onClick={() => setDetails((value) => !value)}>{details ? t('card.hideDetails') : t('card.showDetails')}</Button>
			</div>
			<form className='cc__composer' onSubmit={post}>
				<MentionTextarea
					value={draft}
					onChange={setDraft}
					people={people}
					placeholder={t('card.writeComment')}
					aria-label={t('card.writeComment')}
					rows={draft ? 3 : 1}
					maxLength={2000}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) post(event)
					}}
				/>
				{draft.trim() && <Button type='submit' size='sm' loading={busy}>{t('card.save')}</Button>}
			</form>
			<ol className='cc__list'>
				{shown.map((item) => {
					const author = item.user?.name || item.user?.email || '?'
					const own = String(item.user?._id) === String(meId)
					if (item.type !== 'comment') {
						return (
							<li key={item._id} className='cc__event'>
								<Avatar name={author} src={item.user?.avatar} size={28} />
								<span className='cc__text'>
									<span><strong data-i18n-ignore>{author}</strong> {describe(t, item)}</span>
									<time className='cm-hint' dateTime={item.createdAt} title={fullDate(item.createdAt)}>{relativeTime(item.createdAt, language, t('boards.justNow'))}</time>
								</span>
							</li>
						)
					}
					return (
						<li key={item._id} className='cc__comment'>
							<Avatar name={author} src={item.user?.avatar} size={30} />
							<div className='cc__body'>
								<div className='cc__meta'>
									<strong data-i18n-ignore>{author}</strong>
									<time className='cm-hint' dateTime={item.createdAt} title={fullDate(item.createdAt)}>{relativeTime(item.createdAt, language, t('boards.justNow'))}</time>
									{item.editedAt && <span className='cm-hint'>({t('card.edited')})</span>}
									{item.rule && <span className='cc__rule'><Zap size={12} aria-hidden='true' />{t('automation.fromRule')}</span>}
									{item.pending && <span className='cc__pending' title={t('offline.pendingComment')}><CloudUpload size={13} aria-hidden='true' />{t('offline.notSent')}</span>}
								</div>
								{editing?.id === item._id ? (
									<form className='cc__edit' onSubmit={saveEdit}>
										<MentionTextarea value={editing.text} onChange={(text) => setEditing({ ...editing, text })} people={people} rows={3} maxLength={2000} autoFocus aria-label={t('card.editComment')} onKeyDown={(event) => event.key === 'Escape' && (event.stopPropagation(), setEditing(null))} />
										<div className='cm-row'>
											<Button type='submit' size='sm'>{t('card.save')}</Button>
											<Button variant='ghost' size='sm' onClick={() => setEditing(null)}>{t('card.cancel')}</Button>
										</div>
									</form>
								) : (
									<CommentText message={item.message} mentions={item.mentions} meId={meId} />
								)}
								{editing?.id !== item._id && (own || canManage) && (
									<div className='cc__actions'>
										{own && <button type='button' className='cm-link-button' onClick={() => setEditing({ id: item._id, text: item.message })}>{t('card.edit')}</button>}
										<button type='button' className='cm-link-button' onClick={() => setRemoving(item)}>{t('card.deleteComment')}</button>
									</div>
								)}
							</div>
						</li>
					)
				})}
			</ol>
			{items && !shown.length && <p className='cm-hint cc__empty'>{t('card.noComments')}</p>}
			<ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} title={t('card.deleteCommentTitle')} confirmLabel={t('card.deleteComment')} />
		</div>
	)
}

export default CardComments
