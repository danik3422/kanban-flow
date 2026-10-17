import { Flag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { cx } from '../../ui/utils'
import { boardToneFor } from '../../utils/boardTone'
import { addDays, dayTitle } from '../../utils/calendar'

const MAX_CHIPS = 3
const MAX_DOTS = 3

const boardIdOf = (task) => task.column?.board?._id || task.column?.board || ''

/**
 * The month as a grid of days. Each day lists its first tasks (dots on phones);
 * tasks can be dragged to another day with a mouse, and the arrow keys move
 * between days (Page Up/Down change the month, T jumps to today).
 */
const MonthGrid = ({ days, weekdays, tasksByKey, todayKey, selectedKey, onSelect, onOpenTask, onMoveTask, onCreate, onShiftMonth, isOverdue }) => {
	const { t, language } = useI18n()
	const gridRef = useRef(null)
	const [dropKey, setDropKey] = useState(null)
	const [draggedId, setDraggedId] = useState(null)
	const [keyboardMoved, setKeyboardMoved] = useState(false)
	const taskById = new Map([...tasksByKey.values()].flat().map((task) => [task._id, task]))

	// After arrow-key moves, keep focus on the newly selected day.
	useEffect(() => {
		if (!keyboardMoved) return
		gridRef.current?.querySelector(`[data-day="${selectedKey}"]`)?.focus()
	}, [keyboardMoved, selectedKey, days])

	const handleKeyDown = (event) => {
		const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
		let next = null
		if (moves[event.key] !== undefined) next = addDays(selectedKey, moves[event.key])
		else if (event.key === 'PageUp' || event.key === 'PageDown') {
			event.preventDefault()
			setKeyboardMoved(true)
			onShiftMonth(event.key === 'PageUp' ? -1 : 1)
			return
		} else if (event.key === 't' || event.key === 'T') next = todayKey
		else if (event.key === 'n' || event.key === 'N') {
			event.preventDefault()
			onCreate(selectedKey)
			return
		}
		if (!next) return
		event.preventDefault()
		setKeyboardMoved(true)
		onSelect(next)
	}

	return (
		<div className='cal-grid' role='grid' aria-label={t('calendar.title')} ref={gridRef} onKeyDown={handleKeyDown}>
			<div className='cal-grid__head' role='row'>
				{weekdays.map((name) => <span key={name} role='columnheader' className='cal-grid__weekday'>{name}</span>)}
			</div>
			<div className='cal-grid__body'>
				{Array.from({ length: 6 }, (_, week) => (
					<div key={week} role='row' className='cal-grid__week'>
						{days.slice(week * 7, week * 7 + 7).map((day) => {
							const tasks = tasksByKey.get(day.key) || []
							const shown = tasks.slice(0, MAX_CHIPS)
							const hidden = tasks.length - shown.length
							const hasOverdue = tasks.some(isOverdue)
							const weekend = day.weekday === 0 || day.weekday === 6
							const label = tasks.length
								? t('calendar.dayLabel', { day: dayTitle(day.key, language), count: t('calendar.count', { count: tasks.length }) })
								: t('calendar.noTasksLabel', { day: dayTitle(day.key, language) })
							return (
								<div
									key={day.key}
									role='gridcell'
									aria-selected={day.key === selectedKey}
									className={cx(
										'cal-cell',
										!day.inMonth && 'is-outside',
										weekend && 'is-weekend',
										day.key === todayKey && 'is-today',
										day.key === selectedKey && 'is-selected',
										dropKey === day.key && 'is-drop-target',
									)}
									onClick={(event) => {
										if (event.target === event.currentTarget || event.target.classList.contains('cal-cell__chips')) onSelect(day.key)
									}}
									onDoubleClick={(event) => {
										if (event.target === event.currentTarget || event.target.classList.contains('cal-cell__chips')) onCreate(day.key)
									}}
									onDragOver={(event) => {
										if (!draggedId) return
										event.preventDefault()
										setDropKey(day.key)
									}}
									onDragLeave={(event) => {
										if (!event.currentTarget.contains(event.relatedTarget)) setDropKey((current) => (current === day.key ? null : current))
									}}
									onDrop={(event) => {
										event.preventDefault()
										const task = taskById.get(draggedId)
										setDropKey(null)
										setDraggedId(null)
										if (task) onMoveTask(task, day.key)
									}}
								>
									<button
										type='button'
										className='cal-cell__day'
										data-day={day.key}
										tabIndex={day.key === selectedKey ? 0 : -1}
										aria-label={label}
										aria-current={day.key === todayKey ? 'date' : undefined}
										onClick={() => {
											setKeyboardMoved(false)
											onSelect(day.key)
										}}
										data-i18n-ignore
									>
										<span className='cal-cell__number'>{day.date.getDate()}</span>
										{tasks.length > 0 && (
											<span className='cal-cell__dots' aria-hidden='true'>
												{tasks.slice(0, MAX_DOTS).map((task) => (
													<i key={task._id} style={{ background: hasOverdue ? 'var(--ui-danger)' : `var(--ui-${boardToneFor(boardIdOf(task))}-soft-text)` }} />
												))}
											</span>
										)}
									</button>
									<ul className='cal-cell__chips'>
										{shown.map((task) => (
											<li key={task._id}>
												<button
													type='button'
													className={cx('cal-chip', task.isDone && 'is-done', isOverdue(task) && 'is-overdue', draggedId === task._id && 'is-dragging')}
													draggable={!task.isDone}
													onDragStart={(event) => {
														event.dataTransfer.effectAllowed = 'move'
														event.dataTransfer.setData('text/plain', task._id)
														setDraggedId(task._id)
													}}
													onDragEnd={() => {
														setDraggedId(null)
														setDropKey(null)
													}}
													onClick={() => onOpenTask(task)}
													title={task.title}
													tabIndex={-1}
													data-i18n-ignore
												>
													<i className='cal-chip__dot' style={{ background: `var(--ui-${boardToneFor(boardIdOf(task))}-soft-text)` }} aria-hidden='true' />
													<span className='cal-chip__title'>{task.title}</span>
													{['high', 'urgent'].includes(task.priority) && !task.isDone && <Flag size={10} className='cal-chip__flag' aria-hidden='true' />}
												</button>
											</li>
										))}
									</ul>
									{hidden > 0 && (
										<button
											type='button'
											className='cal-cell__more'
											tabIndex={-1}
											onClick={() => onSelect(day.key)}
											aria-label={t('calendar.moreLabel', { count: hidden, day: dayTitle(day.key, language) })}
										>
											{t('calendar.more', { count: hidden })}
										</button>
									)}
								</div>
							)
						})}
					</div>
				))}
			</div>
		</div>
	)
}

export default MonthGrid
