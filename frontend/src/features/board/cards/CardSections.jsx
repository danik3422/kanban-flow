import { CheckSquare, ExternalLink, Image as ImageIcon, Link2, Paperclip, Pause, Pencil, Play, Plus, Timer, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { intlLocale, translateServerMessageCurrent } from '../../../i18n/translate'
import { axiosInstance } from '../../../lib/axios'
import { Avatar, Button, IconButton, Input } from '../../../ui'
import { cx } from '../../../ui/utils'
import { formatClock, formatDuration, parseDuration } from '../model/cardDisplay'
import { getLocalDateKey } from '../../../lib/dueDate'
import { relativeTime } from '../../../lib/relativeTime'

export const SectionHead = ({ icon: Icon, title, children }) => (
	<div className='cm-section__head'>
		<Icon size={18} aria-hidden='true' className='cm-section__icon' />
		<h3 className='cm-section__title'>{title}</h3>
		<div className='cm-section__actions'>{children}</div>
	</div>
)

/** The checklist: tick, rename in place, delete, add; finished items can be hidden. */
export const ChecklistSection = ({ items, canEdit, onChange, autoAdd, onAutoAddDone }) => {
	const { t } = useI18n()
	const [hideChecked, setHideChecked] = useState(false)
	const [adding, setAdding] = useState(false)
	const [draft, setDraft] = useState('')
	const [editing, setEditing] = useState(null) // index
	const [editText, setEditText] = useState('')
	const isAdding = adding || autoAdd
	const done = items.filter((item) => item.completed).length
	const percent = items.length ? Math.round((done / items.length) * 100) : 0
	const visible = items.map((item, index) => ({ item, index })).filter(({ item }) => !hideChecked || !item.completed)
	const save = (next) => onChange(next.map(({ _id, text, completed }) => ({ ...(_id && { _id }), text, completed: Boolean(completed) })))
	const add = (event) => {
		event.preventDefault()
		const text = draft.trim()
		if (!text) return
		save([...items, { text, completed: false }])
		setDraft('')
	}
	const stopAdding = () => {
		setAdding(false)
		setDraft('')
		onAutoAddDone?.()
	}
	return (
		<section className='cm-section'>
			<SectionHead icon={CheckSquare} title={t('card.checklist')}>
				{done > 0 && <Button variant='ghost' size='sm' onClick={() => setHideChecked((value) => !value)}>{hideChecked ? t('card.showChecked', { count: done }) : t('card.hideChecked')}</Button>}
				{canEdit && <Button variant='ghost' size='sm' className='cp-danger' onClick={() => save([])}>{t('card.deleteChecklist')}</Button>}
			</SectionHead>
			<div className='cm-progress' aria-hidden='true'>
				<span className='cm-progress__value'>{percent}%</span>
				<span className='cm-progress__bar'><span className={cx('cm-progress__fill', percent === 100 && 'is-done')} style={{ width: `${percent}%` }} /></span>
			</div>
			<ul className='cm-checklist'>
				{visible.map(({ item, index }) => (
					<li key={item._id || index} className={cx('cm-check', item.completed && 'is-done')}>
						<input
							type='checkbox'
							className='ui-check__box'
							checked={Boolean(item.completed)}
							disabled={!canEdit}
							aria-label={item.text}
							onChange={(event) => save(items.map((entry, position) => (position === index ? { ...entry, completed: event.target.checked } : entry)))}
						/>
						{editing === index ? (
							<form className='cm-check__edit' onSubmit={(event) => { event.preventDefault(); if (editText.trim()) save(items.map((entry, position) => (position === index ? { ...entry, text: editText.trim() } : entry))); setEditing(null) }}>
								<Input value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={300} autoFocus onKeyDown={(event) => event.key === 'Escape' && (event.stopPropagation(), setEditing(null))} />
								<Button type='submit' size='sm'>{t('card.save')}</Button>
								<IconButton icon={X} size='sm' label={t('card.cancel')} onClick={() => setEditing(null)} />
							</form>
						) : (
							<>
								<button type='button' className='cm-check__text' disabled={!canEdit} onClick={() => { setEditing(index); setEditText(item.text) }} data-i18n-ignore>{item.text}</button>
								{canEdit && <IconButton className='cm-check__delete' icon={Trash2} size='sm' label={t('card.deleteItem', { item: item.text })} onClick={() => save(items.filter((_, position) => position !== index))} />}
							</>
						)}
					</li>
				))}
			</ul>
			{canEdit && (isAdding ? (
				<form className='cm-check-add' onSubmit={add}>
					<Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('card.itemPlaceholder')} aria-label={t('card.addItem')} maxLength={300} autoFocus onKeyDown={(event) => event.key === 'Escape' && (event.stopPropagation(), stopAdding())} />
					<div className='cm-row'>
						<Button type='submit' size='sm' disabled={!draft.trim()}>{t('card.add')}</Button>
						<Button variant='ghost' size='sm' onClick={stopAdding}>{t('card.cancel')}</Button>
					</div>
				</form>
			) : (
				<Button variant='secondary' size='sm' icon={Plus} onClick={() => setAdding(true)}>{t('card.addItem')}</Button>
			))}
			{!items.length && !isAdding && <p className='cm-hint'>{t('card.checklistEmpty')}</p>}
		</section>
	)
}

const hostOf = (url) => {
	try {
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return url
	}
}

/** Links and images on the card, newest first, each with what can be done to it. */
export const AttachmentsSection = ({ attachments, meId, canManage, onAdd, onRemove, onMakeCover }) => {
	const { t, language } = useI18n()
	const items = [...attachments].reverse()
	return (
		<section className='cm-section'>
			<SectionHead icon={Paperclip} title={t('card.attachments')}>
				<Button variant='ghost' size='sm' icon={Plus} onClick={onAdd}>{t('card.add')}</Button>
			</SectionHead>
			<ul className='cm-attachments'>
				{items.map((item) => {
					const canRemove = canManage || String(item.addedBy) === String(meId)
					return (
						<li key={item._id} className='cm-attachment'>
							<a className={cx('cm-attachment__thumb', item.kind === 'image' && 'is-image')} href={item.url} target='_blank' rel='noopener noreferrer' style={item.kind === 'image' ? { backgroundImage: `url("${item.url}")` } : undefined} aria-label={item.name || hostOf(item.url)}>
								{item.kind !== 'image' && <Link2 size={18} aria-hidden='true' />}
							</a>
							<span className='cm-attachment__text'>
								<a className='cm-attachment__name' href={item.url} target='_blank' rel='noopener noreferrer' data-i18n-ignore>{item.name || hostOf(item.url)} <ExternalLink size={12} aria-hidden='true' /></a>
								<span className='cm-hint'>{t('card.addedAgo', { time: relativeTime(item.createdAt, language, t('boards.justNow')) })}{item.name ? ` · ${hostOf(item.url)}` : ''}</span>
								<span className='cm-row'>
									{item.kind === 'image' && <button type='button' className='cm-link-button' onClick={() => onMakeCover(item)}><ImageIcon size={13} aria-hidden='true' /> {t('card.makeCover')}</button>}
									{canRemove && <button type='button' className='cm-link-button cp-danger' onClick={() => onRemove(item)}>{t('card.remove')}</button>}
								</span>
							</span>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

/**
 * Time on the card: my timer (one at a time; starting here stops it elsewhere), the
 * total against an estimate, who spent what, time added by hand, and every entry.
 */
export const TimeSection = ({ task, meId, canManage, onTaskChange, taskTitleOf }) => {
	const { t, language } = useI18n()
	const units = { h: t('card.units.h'), m: t('card.units.m') }
	const [data, setData] = useState(null)
	const [now, setNow] = useState(() => Date.now())
	const [busy, setBusy] = useState(false)
	const [estimateDraft, setEstimateDraft] = useState(null)
	const [form, setForm] = useState({ time: '', date: getLocalDateKey(), note: '' })
	const [formError, setFormError] = useState('')
	const [editing, setEditing] = useState(null) // { id, time, note }

	const load = useCallback(async () => {
		try {
			const { data: next } = await axiosInstance.get(`/board/tasks/${task._id}/time`)
			setData(next)
		} catch {
			setData({ entries: [], people: [], trackedSeconds: task.trackedSeconds || 0 })
		}
	}, [task._id, task.trackedSeconds])
	useEffect(() => {
		queueMicrotask(load)
	}, [load, task.runningTimers?.length])

	const mine = data?.entries.find((entry) => !entry.endedAt && String(entry.user?._id) === String(meId))
	useEffect(() => {
		if (!mine) return undefined
		const timer = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(timer)
	}, [mine])

	const fail = (error, key) => toast.error(translateServerMessageCurrent(error.response?.data?.message, key))
	const toggleTimer = async () => {
		setBusy(true)
		try {
			if (mine) {
				const { data: result } = await axiosInstance.post(`/board/tasks/${task._id}/timer/stop`)
				onTaskChange({ trackedSeconds: result.trackedSeconds })
			} else {
				const { data: result } = await axiosInstance.post(`/board/tasks/${task._id}/timer/start`)
				if (result.stopped && String(result.stopped.taskId) !== String(task._id)) toast.info(t('card.stoppedOther', { task: taskTitleOf(result.stopped.taskId) }))
				setNow(Date.now())
			}
			await load()
		} catch (error) {
			fail(error, 'card.saveError')
		} finally {
			setBusy(false)
		}
	}

	const saveEstimate = async () => {
		if (estimateDraft === null) return
		const minutes = estimateDraft.trim() ? parseDuration(estimateDraft) : 0
		if (minutes === null) {
			toast.error(t('card.timeInvalid'))
			return
		}
		setEstimateDraft(null)
		await onTaskChange({ estimateMinutes: minutes }, true)
	}

	const addTime = async (event) => {
		event.preventDefault()
		const minutes = parseDuration(form.time)
		if (!minutes) {
			setFormError(t('card.timeInvalid'))
			return
		}
		setBusy(true)
		try {
			const { data: result } = await axiosInstance.post(`/board/tasks/${task._id}/time`, { minutes, date: form.date || undefined, note: form.note })
			onTaskChange({ trackedSeconds: result.trackedSeconds })
			setForm({ time: '', date: getLocalDateKey(), note: '' })
			toast.success(t('card.timeAdded'))
			await load()
		} catch (error) {
			fail(error, 'card.saveError')
		} finally {
			setBusy(false)
		}
	}

	const saveEntry = async (event) => {
		event.preventDefault()
		const minutes = parseDuration(editing.time)
		if (!minutes) {
			toast.error(t('card.timeInvalid'))
			return
		}
		try {
			const { data: result } = await axiosInstance.patch(`/board/time/${editing.id}`, { minutes, note: editing.note })
			onTaskChange({ trackedSeconds: result.trackedSeconds })
			setEditing(null)
			await load()
		} catch (error) {
			fail(error, 'card.saveError')
		}
	}
	const removeEntry = async (entry) => {
		try {
			const { data: result } = await axiosInstance.delete(`/board/time/${entry._id}`)
			onTaskChange({ trackedSeconds: result.trackedSeconds })
			await load()
		} catch (error) {
			fail(error, 'card.saveError')
		}
	}

	const tracked = data?.trackedSeconds ?? task.trackedSeconds ?? 0
	const live = mine ? (now - new Date(mine.startedAt).getTime()) / 1000 : 0
	const estimate = (task.estimateMinutes || 0) * 60
	const percent = estimate ? Math.min(100, Math.round(((tracked + live) / estimate) * 100)) : 0
	const over = estimate && tracked + live > estimate
	const runningOthers = (data?.people || []).filter((person) => person.running && String(person.user?._id) !== String(meId))
	const formatDay = (value) => new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short' }).format(new Date(value))

	return (
		<section className='cm-section cm-time'>
			<SectionHead icon={Timer} title={t('card.timeTitle')} />
			<div className='cm-time__top'>
				<Button className={cx('cm-timer', mine && 'is-running')} icon={mine ? Pause : Play} loading={busy} onClick={toggleTimer} aria-pressed={Boolean(mine)}>
					{mine ? <><span>{t('card.stopTimer')}</span><span className='cm-timer__clock'>{formatClock(live)}</span></> : t('card.startTimer')}
				</Button>
				<div className='cm-time__totals'>
					<span className='cm-time__value'>{formatDuration(tracked + live, units)}</span>
					<span className='cm-hint'>{t('card.tracked')}</span>
				</div>
				<div className='cm-time__estimate'>
					{estimateDraft !== null ? (
						<Input
							value={estimateDraft}
							onChange={(event) => setEstimateDraft(event.target.value)}
							onBlur={saveEstimate}
							onKeyDown={(event) => {
								if (event.key === 'Enter') event.currentTarget.blur()
								if (event.key === 'Escape') {
									event.stopPropagation()
									setEstimateDraft(null)
								}
							}}
							placeholder={t('card.estimatePlaceholder')}
							aria-label={t('card.estimate')}
							autoFocus
						/>
					) : (
						<button type='button' className='cm-estimate' onClick={() => setEstimateDraft(task.estimateMinutes ? formatDuration(task.estimateMinutes * 60, units) : '')}>
							<span className='cm-time__value'>{task.estimateMinutes ? formatDuration(task.estimateMinutes * 60, units) : '—'}</span>
							<span className='cm-hint'>{task.estimateMinutes ? t('card.estimate') : t('card.setEstimate')}</span>
						</button>
					)}
				</div>
			</div>
			{estimate > 0 && (
				<div className='cm-progress'>
					<span className='cm-progress__bar'><span className={cx('cm-progress__fill', over && 'is-over')} style={{ width: `${percent}%` }} /></span>
					<span className={cx('cm-hint', over && 'cp-danger')}>{over ? t('card.over', { time: formatDuration(tracked + live - estimate, units) }) : t('card.left', { time: formatDuration(estimate - tracked - live, units) })}</span>
				</div>
			)}
			{runningOthers.length > 0 && <p className='cm-hint'>{runningOthers.map((person) => t('card.tracking', { name: person.user?.name || person.user?.email })).join(' · ')}</p>}

			{(data?.people || []).length > 0 && (
				<div className='cm-time__people'>
					<h4 className='cm-subtitle'>{t('card.byPerson')}</h4>
					<ul className='cm-list'>
						{data.people.map((person) => (
							<li key={person.user?._id} className='cm-time__person'>
								<Avatar name={person.user?.name || person.user?.email || '?'} src={person.user?.avatar} size={26} status={person.running ? 'online' : undefined} />
								<span className='cm-grow' data-i18n-ignore>{person.user?.name || person.user?.email}</span>
								<span className='cm-time__amount'>{formatDuration(person.seconds + (person.running && String(person.user?._id) === String(meId) ? live : 0), units)}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<form className='cm-time__add' onSubmit={addTime} noValidate>
				<h4 className='cm-subtitle'>{t('card.addTime')}</h4>
				<div className='cm-time__fields'>
					<Input value={form.time} onChange={(event) => { setForm({ ...form, time: event.target.value }); setFormError('') }} placeholder={t('card.estimatePlaceholder')} aria-label={t('card.timeSpent')} aria-invalid={formError ? 'true' : undefined} />
					<input type='date' className='ui-control' value={form.date} max={getLocalDateKey()} onChange={(event) => setForm({ ...form, date: event.target.value })} aria-label={t('card.timeOn')} />
				</div>
				<Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={t('card.note')} aria-label={t('card.note')} maxLength={200} />
				{formError && <p className='cm-error' role='alert'>{formError}</p>}
				<Button type='submit' size='sm' variant='secondary' loading={busy} disabled={!form.time.trim()}>{t('card.addTime')}</Button>
			</form>

			{(data?.entries || []).filter((entry) => entry.endedAt).length > 0 && (
				<div>
					<h4 className='cm-subtitle'>{t('card.entries')}</h4>
					<ul className='cm-list cm-entries'>
						{data.entries.filter((entry) => entry.endedAt).slice(0, 30).map((entry) => {
							const editable = canManage || String(entry.user?._id) === String(meId)
							return (
								<li key={entry._id} className='cm-entry'>
									{editing?.id === entry._id ? (
										<form className='cm-entry__edit' onSubmit={saveEntry}>
											<Input value={editing.time} onChange={(event) => setEditing({ ...editing, time: event.target.value })} aria-label={t('card.timeSpent')} autoFocus />
											<Input value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} aria-label={t('card.note')} maxLength={200} />
											<Button type='submit' size='sm'>{t('card.save')}</Button>
											<IconButton icon={X} size='sm' label={t('card.cancel')} onClick={() => setEditing(null)} />
										</form>
									) : (
										<>
											<Avatar name={entry.user?.name || entry.user?.email || '?'} src={entry.user?.avatar} size={24} />
											<span className='cm-entry__text'>
												<span><strong>{formatDuration(entry.seconds, units)}</strong> · {formatDay(entry.endedAt)}{entry.manual ? ` · ${t('card.manual')}` : ''}</span>
												{entry.note && <span className='cm-hint' data-i18n-ignore>{entry.note}</span>}
											</span>
											{editable && (
												<span className='cm-row'>
													<IconButton icon={Pencil} size='sm' label={t('card.editEntry')} onClick={() => setEditing({ id: entry._id, time: formatDuration(entry.seconds, units), note: entry.note || '' })} />
													<IconButton icon={Trash2} size='sm' label={t('card.deleteEntry')} onClick={() => removeEntry(entry)} />
												</span>
											)}
										</>
									)}
								</li>
							)
						})}
					</ul>
				</div>
			)}
			{data && !data.entries.length && !mine && <p className='cm-hint'>{t('card.noTime')}</p>}
		</section>
	)
}
