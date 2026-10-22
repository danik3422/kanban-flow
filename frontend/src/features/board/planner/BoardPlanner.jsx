import { AlertCircle, CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Inbox, Plus, Repeat, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../../i18n'
import { getLocalDateKey } from '../../../lib/dueDate'
import { addDays } from '../../../lib/calendarDates'
import { AvatarGroup, Button, IconButton } from '../../../ui'
import { cx } from '../../../ui/utils'
import { CARD_COLORS } from '../model/cardDisplay'
import { dayLabel, NO_DATE, plannerGroups, weekOf, weekTitle } from './plannerModel'
import './planner.css'

const SHOW_DONE_KEY = 'kh:planner-show-done'
const SIDE_KEY = 'kh:planner-side'
// Beside a full-width week, "Overdue" and "No date" open by default only on wide screens.
const readSideOpen = () => {
	try {
		const saved = localStorage.getItem(SIDE_KEY)
		return saved === null ? window.innerWidth >= 1600 : saved === '1'
	} catch {
		return true
	}
}
const readShowDone = () => {
	try {
		return localStorage.getItem(SHOW_DONE_KEY) === '1'
	} catch {
		return false
	}
}

/** One card in the planner: tick it off, open it, or drag it to another day or list. */
const PlannerCard = ({ item, labelColors, drag, onOpen, onToggleComplete }) => {
	const { t } = useI18n()
	const { task } = item
	const people = (task.assignees || []).filter((person) => person?._id).map((person) => ({ ...person, name: person.name || person.email }))
	const urgent = task.priority === 'urgent' || task.priority === 'high'
	return (
		<div
			className={cx('pl-card', task.completed && 'is-done', drag.taskId === task._id && 'is-drag-source')}
			data-planner-task-id={task._id}
			role='button'
			tabIndex={0}
			aria-label={t('card.open', { title: task.title })}
			onPointerDown={(event) => drag.onPointerDown(event, task._id)}
			onClick={() => !drag.consumeClick() && onOpen(task)}
			onKeyDown={(event) => {
				if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
					event.preventDefault()
					onOpen(task)
				}
			}}
		>
			<button
				type='button'
				className={cx('pl-card__check', task.completed && 'is-on')}
				aria-pressed={Boolean(task.completed)}
				aria-label={task.completed ? t('planner.markOpen') : t('planner.markDone')}
				onClick={(event) => {
					event.stopPropagation()
					onToggleComplete(task)
				}}
			>
				{task.completed && <Check size={12} strokeWidth={3} aria-hidden='true' />}
			</button>
			<span className='pl-card__body'>
				<span className='pl-card__title' data-i18n-ignore>{task.title}</span>
				<span className='pl-card__meta'>
					{task.repeat?.frequency && <Repeat size={12} className='pl-card__repeat' aria-label={t('repeat.title')} />}
					{urgent && <Flag size={12} className={`pl-card__flag is-${task.priority}`} aria-label={t(`myTasks.priority.${task.priority}`)} />}
					<span className='pl-card__list' data-i18n-ignore>{item.columnTitle}</span>
					{(task.labels || []).slice(0, 4).map((name) => (
						<span key={name} className='pl-card__label' style={{ background: CARD_COLORS[labelColors.get(name)] || 'var(--ui-border-strong)' }} title={name} />
					))}
					{people.length > 0 && <span className='pl-card__people'><AvatarGroup people={people} max={2} size={20} /></span>}
				</span>
			</span>
		</div>
	)
}

/** A coming date of a repeating card: shown faintly, opens the card it comes from. */
const ProjectedCard = ({ item, onOpen }) => {
	const { t } = useI18n()
	return (
		<button type='button' className='pl-card pl-card--projected' onClick={() => onOpen(item.task)} title={t('planner.projected')}>
			<Repeat size={14} className='pl-card__projected-icon' aria-hidden='true' />
			<span className='pl-card__body'>
				<span className='pl-card__title' data-i18n-ignore>{item.task.title}</span>
				<span className='pl-card__meta'><span className='pl-card__list'>{t('planner.projected')}</span></span>
			</span>
		</button>
	)
}

/** Add a card due on a day, in the list chosen (the board's first list by default). */
const QuickAdd = ({ columns, onAdd, onDone }) => {
	const { t } = useI18n()
	const [title, setTitle] = useState('')
	const [columnId, setColumnId] = useState(columns[0]?._id || '')
	const [busy, setBusy] = useState(false)
	const submit = async (event) => {
		event.preventDefault()
		if (!title.trim() || !columnId || busy) return
		setBusy(true)
		const ok = await onAdd(title.trim(), columnId)
		setBusy(false)
		if (ok) setTitle('')
	}
	return (
		<form className='pl-add' onSubmit={submit}>
			<input
				className='pl-add__input'
				value={title}
				onChange={(event) => setTitle(event.target.value)}
				placeholder={t('planner.addPlaceholder')}
				aria-label={t('planner.addPlaceholder')}
				maxLength={200}
				autoFocus
				onKeyDown={(event) => {
					if (event.key === 'Escape') {
						event.stopPropagation()
						onDone()
					}
				}}
			/>
			{columns.length > 1 && (
				<select className='pl-add__list' value={columnId} onChange={(event) => setColumnId(event.target.value)} aria-label={t('planner.addToList')}>
					{columns.map((column) => <option key={column._id} value={column._id}>{column.title}</option>)}
				</select>
			)}
			<div className='pl-add__actions'>
				<Button type='submit' size='sm' loading={busy} disabled={!title.trim()}>{t('planner.add')}</Button>
				<IconButton icon={X} size='sm' label={t('common.cancel')} onClick={onDone} />
			</div>
		</form>
	)
}

/**
 * The board's planner, Trello-style but with the board's own dates: no calendar
 * account needed. Beside the board it lists the week day by day; on its own (board
 * hidden) it is a week grid. Cards dragged from the board onto a day get that due
 * date, onto "No date" lose it; cards can be ticked off, opened or added for a day.
 */
const BoardPlanner = ({ mode, columns, labels, weekStart, drag, canEdit, calendarHref, onOpenTask, onToggleComplete, onAddCard, onClose, width, onResizeStart }) => {
	const { t, language } = useI18n()
	const todayKey = getLocalDateKey()
	const [cursor, setCursor] = useState(todayKey)
	const [showDone, setShowDone] = useState(readShowDone)
	const [addingOn, setAddingOn] = useState(null)
	const [sideOpen, setSideOpen] = useState(readSideOpen)
	const toggleSide = () => setSideOpen((value) => {
		try {
			localStorage.setItem(SIDE_KEY, value ? '0' : '1')
		} catch {
			// Only a preference.
		}
		return !value
	})
	const days = useMemo(() => weekOf(cursor, weekStart), [cursor, weekStart])
	const groups = useMemo(() => plannerGroups(columns, days, todayKey, { showDone }), [columns, days, todayKey, showDone])
	const labelColors = useMemo(() => new Map((labels || []).map((label) => [label.name, label.color])), [labels])
	const openColumns = columns.filter((column) => !column.archivedAt)

	const toggleDone = () => {
		setShowDone((value) => {
			try {
				localStorage.setItem(SHOW_DONE_KEY, value ? '0' : '1')
			} catch {
				// Only a preference.
			}
			return !value
		})
	}

	const cards = (items, emptyText, projected = []) => (
		<div className='pl-cards'>
			{items.map((item) => <PlannerCard key={item.task._id} item={item} labelColors={labelColors} drag={drag} onOpen={onOpenTask} onToggleComplete={onToggleComplete} />)}
			{projected.map((item) => <ProjectedCard key={`${item.task._id}-next`} item={item} onOpen={onOpenTask} />)}
			{!items.length && !projected.length && <p className='pl-empty'>{drag.active ? t('planner.dropHere') : emptyText}</p>}
		</div>
	)

	const daySection = (key) => {
		const { weekday, day } = dayLabel(key, language)
		const items = groups.days[key]
		return (
			<section key={key} className={cx('pl-day', key === todayKey && 'is-today', key < todayKey && 'is-past', drag.plannerDay === key && 'is-drop-target')} data-planner-day={key} aria-label={weekday}>
				<header className='pl-day__head'>
					<span className='pl-day__weekday'>{weekday}</span>
					<span className='pl-day__date'>{day}</span>
					{items.length > 0 && <span className='pl-day__count'>{items.length}</span>}
					{canEdit && openColumns.length > 0 && (
						<IconButton icon={Plus} size='sm' label={t('planner.addOn', { day: `${weekday} ${day}` })} className='pl-day__add' onClick={() => setAddingOn(key)} />
					)}
				</header>
				{addingOn === key && (
					<QuickAdd columns={openColumns} onAdd={(title, columnId) => onAddCard(key, title, columnId)} onDone={() => setAddingOn(null)} />
				)}
				{cards(items, mode === 'full' ? '' : t('planner.nothing'), groups.projected[key])}
			</section>
		)
	}

	const overdue = groups.overdue.length > 0 && (
		<section className='pl-day pl-day--overdue' aria-label={t('planner.overdue')}>
			<header className='pl-day__head'>
				<AlertCircle size={15} aria-hidden='true' />
				<span className='pl-day__name'>{t('planner.overdue')}</span>
				<span className='pl-day__count'>{groups.overdue.length}</span>
			</header>
			{cards(groups.overdue, '')}
		</section>
	)
	const undated = (
		<section className={cx('pl-day pl-day--undated', drag.plannerDay === NO_DATE && 'is-drop-target')} data-planner-day={NO_DATE} aria-label={t('planner.noDate')}>
			<header className='pl-day__head'>
				<Inbox size={15} aria-hidden='true' />
				<span className='pl-day__name'>{t('planner.noDate')}</span>
				{groups.undated.length > 0 && <span className='pl-day__count'>{groups.undated.length}</span>}
			</header>
			{cards(groups.undated, t('planner.noDateEmpty'))}
		</section>
	)

	return (
		<aside className={cx('pl', `pl--${mode}`, drag.active && 'is-dragging')} style={mode === 'side' ? { width } : undefined} aria-label={t('planner.title')}>
			<header className='pl-head'>
				<div className='pl-head__title'>
					<CalendarDays size={18} aria-hidden='true' />
					<h2>{t('planner.title')}</h2>
				</div>
				<div className='pl-head__nav'>
					<IconButton icon={ChevronLeft} size='sm' label={t('planner.previousWeek')} onClick={() => setCursor((key) => addDays(key, -7))} />
					<Button variant='secondary' size='sm' onClick={() => setCursor(todayKey)} disabled={days.includes(todayKey)}>{t('planner.today')}</Button>
					<IconButton icon={ChevronRight} size='sm' label={t('planner.nextWeek')} onClick={() => setCursor((key) => addDays(key, 7))} />
				</div>
				<span className='pl-head__range'>{weekTitle(days, language)}</span>
				<div className='pl-head__tools'>
					{mode === 'full' && (
						<Button variant={sideOpen ? 'secondary' : 'ghost'} size='sm' icon={Inbox} aria-pressed={sideOpen} onClick={toggleSide} className='pl-head__side'>
							{t('planner.noDate')} <span className='pl-day__count'>{groups.undated.length + groups.overdue.length}</span>
						</Button>
					)}
					<IconButton icon={showDone ? EyeOff : Eye} size='sm' label={showDone ? t('planner.hideDone') : t('planner.showDone')} aria-pressed={showDone} onClick={toggleDone} />
					{mode === 'phone'
						? <IconButton as={Link} to={calendarHref} icon={CalendarRange} size='sm' label={t('planner.calendar')} />
						: <Button as={Link} to={calendarHref} variant='ghost' size='sm'>{t('planner.calendar')}</Button>}
					{mode !== 'phone' && <IconButton icon={X} size='sm' label={t('planner.close')} onClick={onClose} />}
				</div>
			</header>
			{mode !== 'full' ? (
				<div className='pl-scroll'>
					{overdue}
					{days.map(daySection)}
					{undated}
				</div>
			) : (
				<div className={cx('pl-grid', !sideOpen && 'is-week-only')}>
					<div className='pl-week'>{days.map(daySection)}</div>
					{sideOpen && (
						<div className='pl-side'>
							{overdue}
							{undated}
						</div>
					)}
				</div>
			)}
			<p className='pl-hint'>{t('planner.hint')}</p>
			{mode === 'side' && <div className='pl-resize' role='separator' aria-orientation='vertical' aria-label={t('planner.resize')} onPointerDown={onResizeStart} />}
		</aside>
	)
}

export default BoardPlanner
