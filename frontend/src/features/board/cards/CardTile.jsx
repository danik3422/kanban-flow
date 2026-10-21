import { AlignLeft, CheckSquare, Circle, CircleCheck, Clock3, Eye, Flag, MessageSquare, Paperclip, Timer } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { useI18n } from '../../../i18n'
import { intlLocale } from '../../../i18n/translate'
import { AvatarGroup } from '../../../ui'
import { cx } from '../../../ui/utils'
import { CARD_COLORS, dueTone, formatClock, formatDuration, labelColorKey } from '../model/cardDisplay'
import { formatDueDate } from '../../../lib/dueDate'
import './card.css'
import { assetUrl } from '../../../lib/runtimeConfig'

/** A live clock for a running timer, ticking only while it is shown. */
const LiveClock = ({ since, base = 0 }) => {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(timer)
	}, [])
	return <span className='ct-clock'>{formatClock(base + (now - new Date(since).getTime()) / 1000)}</span>
}

/**
 * A card on the board: its cover, labels, title and what is going on with it
 * (dates, checklist, comments, attachments, time, people). The round button marks
 * it complete without opening it.
 */
const CardTile = ({ task, boardLabels, done, meId, canEdit, isDragSource, isFilteredOut, onOpen, onToggleComplete, onPointerDown }) => {
	const { t, language } = useI18n()
	const units = { h: t('card.units.h'), m: t('card.units.m') }
	const complete = Boolean(task.completed)
	const tone = dueTone(task, done || complete)
	const checklist = task.checklist || []
	const checked = checklist.filter((item) => item.completed).length
	const running = task.runningTimers || []
	const myRun = running.find((entry) => String(entry.user) === String(meId))
	const firstRun = myRun || running[0]
	const watching = (task.watchers || []).some((id) => String(id) === String(meId))
	const people = (task.assignees || []).filter((person) => person && typeof person === 'object').map((person) => ({ id: person._id, name: person.name || person.email, avatar: person.avatar }))
	const cover = task.cover
	const fullCover = cover?.size === 'full'
	const coverStyle = cover ? (cover.type === 'color' ? { background: CARD_COLORS[cover.key] } : { backgroundImage: `url("${assetUrl(cover.thumb || cover.url)}")`, backgroundColor: cover.color || '#5b6470' }) : null
	const dateText = [task.startDate && formatDueDate(task.startDate, undefined, intlLocale(language)), task.dueDate && formatDueDate(task.dueDate, undefined, intlLocale(language))].filter(Boolean).join(' – ')

	const badges = (
		<div className='ct-badges'>
			{task.priority && task.priority !== 'none' && (
				<span className={`ct-badge ct-priority ct-priority--${task.priority}`}><Flag size={12} aria-hidden='true' />{t(`myTasks.priority.${task.priority}`)}</span>
			)}
			{tone && (
				<span className={`ct-badge ct-due ct-due--${tone}`} title={t(`card.due.${tone}`)}>
					{tone === 'done' ? <CircleCheck size={13} aria-hidden='true' /> : <Clock3 size={13} aria-hidden='true' />}
					<span>{dateText}</span>
				</span>
			)}
			{!tone && task.startDate && <span className='ct-badge'><Clock3 size={13} aria-hidden='true' /><span>{dateText}</span></span>}
			{watching && <span className='ct-badge ct-icon-badge' title={t('card.badges.watching')}><Eye size={13} aria-label={t('card.badges.watching')} /></span>}
			{task.description && task.description.replace(/<[^>]*>/g, '').trim() && (
				<span className='ct-badge ct-icon-badge' title={t('card.badges.description')}><AlignLeft size={13} aria-label={t('card.badges.description')} /></span>
			)}
			{task.commentCount > 0 && (
				<span className='ct-badge' title={t('card.badges.comments', { count: task.commentCount })}><MessageSquare size={13} aria-hidden='true' /><span>{task.commentCount}</span></span>
			)}
			{task.attachments?.length > 0 && (
				<span className='ct-badge' title={t('card.badges.attachments', { count: task.attachments.length })}><Paperclip size={13} aria-hidden='true' /><span>{task.attachments.length}</span></span>
			)}
			{checklist.length > 0 && (
				<span className={cx('ct-badge', checked === checklist.length && 'ct-badge--done')} title={t('card.badges.checklist', { done: checked, total: checklist.length })}>
					<CheckSquare size={13} aria-hidden='true' /><span>{checked}/{checklist.length}</span>
				</span>
			)}
			{firstRun ? (
				<span className='ct-badge ct-timer is-running' title={t('card.running')}>
					<Timer size={13} aria-hidden='true' /><LiveClock since={firstRun.startedAt} base={myRun ? task.trackedSeconds || 0 : 0} />
				</span>
			) : task.trackedSeconds > 0 && (
				<span className='ct-badge' title={t('card.badges.tracked', { time: formatDuration(task.trackedSeconds, units) })}>
					<Timer size={13} aria-hidden='true' /><span>{formatDuration(task.trackedSeconds, units)}</span>
				</span>
			)}
			{people.length > 0 && <span className='ct-people'><AvatarGroup people={people} max={3} size={24} /></span>}
		</div>
	)

	return (
		<article
			className={cx('task-card ct', complete && 'is-complete', fullCover && 'ct--full', isDragSource && 'is-drag-source', isFilteredOut && 'is-filtered-out')}
			data-task-id={task._id}
			tabIndex={0}
			role='button'
			aria-label={t('card.open', { title: task.title })}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
					event.preventDefault()
					onOpen()
				}
			}}
			onPointerDown={onPointerDown}
			style={fullCover ? coverStyle : undefined}
		>
			{cover && !fullCover && <div className='ct-cover' style={coverStyle} aria-hidden='true' />}
			<div className='ct-body'>
				{task.labels?.length > 0 && (
					<div className='ct-labels'>
						{task.labels.map((name) => (
							<span key={name} className='ct-label' style={{ '--label': CARD_COLORS[labelColorKey(name, boardLabels)] }} data-i18n-ignore>{name}</span>
						))}
					</div>
				)}
				<div className='ct-title-row'>
					{canEdit && (
						<button
							type='button'
							className='ct-check'
							aria-pressed={complete}
							aria-label={complete ? t('card.markIncomplete') : t('card.markComplete')}
							onClick={(event) => {
								event.stopPropagation()
								onToggleComplete()
							}}
						>
							{complete ? <CircleCheck size={17} aria-hidden='true' /> : <Circle size={17} aria-hidden='true' />}
						</button>
					)}
					<span className='ct-title' data-i18n-ignore>{task.title}</span>
				</div>
				{badges}
			</div>
		</article>
	)
}

export default memo(CardTile)
