import { ArrowUpRight, CalendarDays, Check, Flag, ListChecks } from 'lucide-react'
import { useRef } from 'react'
import { useI18n } from '../../i18n'
import { AvatarGroup, Badge, IconButton, Menu } from '../../ui'
import { cx } from '../../ui/utils'
import { addDaysToKey, getDueDateKey, getLocalDateKey } from '../../lib/dueDate'
import { dueLabel, PRIORITY_TONE } from '../board/model/taskDisplay'

const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent']

/**
 * One assigned task: tick it done, open it on its board, and (with a mouse)
 * change its due date or priority without leaving the list.
 */
const MyTaskRow = ({ task, done, showBoard, canToggle, toggleHint, userId, onToggle, onOpen, onOpenBoard, onDueChange, onPriorityChange }) => {
	const { t, language } = useI18n()
	const dateInputRef = useRef(null)
	const dueKey = getDueDateKey(task.dueDate)
	const todayKey = getLocalDateKey()
	const dueTone = done || !dueKey ? 'neutral' : dueKey < todayKey ? 'danger' : dueKey === todayKey ? 'warning' : 'neutral'
	const checklist = task.checklist || []
	const checked = checklist.filter((item) => item.completed).length
	const others = (task.assignees || []).filter((person) => person?._id && person._id !== userId)
	const boardName = task.column?.board?.name
	const columnTitle = task.column?.title

	const pickDate = () => {
		const input = dateInputRef.current
		if (!input) return
		input.value = dueKey
		if (typeof input.showPicker === 'function') input.showPicker()
		else input.click()
	}

	return (
		<li className={cx('mt-row', done && 'is-done')}>
			<button
				type='button'
				role='checkbox'
				aria-checked={done}
				className='mt-row__check'
				onClick={() => onToggle(task)}
				disabled={!canToggle}
				aria-label={done ? t('myTasks.markOpen', { task: task.title }) : t('myTasks.markDone', { task: task.title })}
				title={canToggle ? undefined : toggleHint}
				data-i18n-ignore
			>
				<span className='mt-row__box' aria-hidden='true'>{done && <Check size={14} strokeWidth={3} />}</span>
			</button>
			<button type='button' className='mt-row__main' onClick={() => onOpen(task)} aria-label={t('myTasks.openTask', { task: task.title })} data-i18n-ignore>
				<span className='mt-row__title'>{task.title}</span>
				<span className='mt-row__meta'>
					{(showBoard ? [boardName, columnTitle] : [columnTitle]).filter(Boolean).length > 0 && (
						<span className='mt-row__where'>{(showBoard ? [boardName, columnTitle] : [columnTitle]).filter(Boolean).join(' · ')}</span>
					)}
					{dueKey && <Badge tone={dueTone}><CalendarDays size={12} aria-hidden='true' />{dueLabel(dueKey, t, language)}</Badge>}
					{task.priority && task.priority !== 'none' && (
						<Badge tone={PRIORITY_TONE[task.priority]}><Flag size={12} aria-hidden='true' />{t(`myTasks.priority.${task.priority}`)}</Badge>
					)}
					{checklist.length > 0 && (
						<span className='mt-row__checklist'><ListChecks size={14} aria-hidden='true' />{checked}/{checklist.length}</span>
					)}
					{(task.labels || []).slice(0, 2).map((label) => <span key={label} className='mt-row__label'>{label}</span>)}
				</span>
			</button>
			{others.length > 0 && (
				<span className='mt-row__people'><AvatarGroup people={others.map((person) => ({ ...person, name: person.name || person.email }))} max={3} size={24} /></span>
			)}
			<span className='mt-row__actions'>
				<Menu
					label={t('myTasks.changeDue')}
					trigger={(props) => <IconButton icon={CalendarDays} size='sm' label={t('myTasks.changeDue')} {...props} />}
					items={[
						{ label: t('myTasks.dueToday'), onSelect: () => onDueChange(task, todayKey) },
						{ label: t('myTasks.dueTomorrow'), onSelect: () => onDueChange(task, addDaysToKey(todayKey, 1)) },
						{ label: t('myTasks.dueNextWeek'), onSelect: () => onDueChange(task, addDaysToKey(todayKey, 7)) },
						{ label: t('myTasks.duePick'), onSelect: pickDate },
						dueKey && { separator: true },
						dueKey && { label: t('myTasks.dueClear'), tone: 'danger', onSelect: () => onDueChange(task, null) },
					]}
				/>
				{/* The native date picker opens from here, next to the button that asked for it. */}
				<input
					ref={dateInputRef}
					type='date'
					className='mt-row__date-input'
					tabIndex={-1}
					aria-hidden='true'
					onChange={(event) => event.target.value && onDueChange(task, event.target.value)}
				/>
				<Menu
					label={t('myTasks.changePriority')}
					trigger={(props) => <IconButton icon={Flag} size='sm' label={t('myTasks.changePriority')} {...props} />}
					items={PRIORITIES.map((value) => ({
						label: t(`myTasks.priority.${value}`),
						icon: value === (task.priority || 'none') ? Check : undefined,
						checked: value === (task.priority || 'none'),
						onSelect: () => onPriorityChange(task, value),
					}))}
				/>
				<IconButton icon={ArrowUpRight} size='sm' label={t('myTasks.openBoard')} onClick={() => onOpenBoard(task)} />
			</span>
		</li>
	)
}

export default MyTaskRow
