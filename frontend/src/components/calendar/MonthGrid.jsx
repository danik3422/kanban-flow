import { Flag } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { cx } from '../../ui/utils'
import { boardToneFor } from '../../utils/boardTone'
import { addDays, dayTitle } from '../../utils/calendar'

const MAX_CHIPS = 3
const MAX_DOTS = 3
// A finger swipe across the month turns it: far enough, or a quick flick.
const SWIPE_DISTANCE = 60
const SWIPE_FLICK = 30
const SWIPE_SPEED = 0.4
// A two-finger sideways swipe on a trackpad turns it too.
const WHEEL_DISTANCE = 60
const WHEEL_SETTLE_MS = 160
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)'
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
	const bodyRef = useRef(null)
	const swipeRef = useRef(null)
	const swipedRef = useRef(false)
	const shiftRef = useRef(onShiftMonth)
	// Set when the old month has already slid away, so the new one arrives from further out.
	const carriedRef = useRef(false)
	const monthKey = days[10]?.key
	const shownMonthRef = useRef(monthKey)
	const taskById = new Map([...tasksByKey.values()].flat().map((task) => [task._id, task]))

	// After arrow-key moves, keep focus on the newly selected day.
	useEffect(() => {
		if (!keyboardMoved) return
		gridRef.current?.querySelector(`[data-day="${selectedKey}"]`)?.focus()
	}, [keyboardMoved, selectedKey, days])

	useEffect(() => {
		shiftRef.current = onShiftMonth
	})

	// A new month slides in from the side it comes from (later months from the right).
	useLayoutEffect(() => {
		const previous = shownMonthRef.current
		shownMonthRef.current = monthKey
		const body = bodyRef.current
		if (!body || !previous || previous === monthKey) return
		const carried = carriedRef.current
		carriedRef.current = false
		for (const animation of body.getAnimations()) animation.cancel()
		if (reducedMotion()) return
		const direction = monthKey > previous ? 1 : -1
		body.animate(
			[{ transform: `translateX(${direction * (carried ? 36 : 6)}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
			{ duration: carried ? 300 : 260, easing: EASE_OUT },
		)
	}, [monthKey])

	// Swipe left or right on a touch screen to turn the month; vertical moves still scroll the page.
	// The grid follows the finger through its style directly, so nothing re-renders mid-gesture.
	useEffect(() => {
		const grid = gridRef.current
		if (!grid) return undefined
		let frame = 0
		const place = (dx) => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				const body = bodyRef.current
				if (!body) return
				body.style.transform = dx ? `translateX(${dx}px)` : ''
				body.style.opacity = dx ? String(Math.max(0.35, 1 - Math.abs(dx) / (body.offsetWidth * 0.9))) : ''
			})
		}
		const turn = (step) => {
			swipedRef.current = true
			window.setTimeout(() => { swipedRef.current = false }, 350)
			shiftRef.current(step)
		}
		const onStart = (event) => {
			if (event.touches.length !== 1) return
			const touch = event.touches[0]
			for (const animation of bodyRef.current?.getAnimations() || []) animation.finish()
			swipeRef.current = { x: touch.clientX, y: touch.clientY, time: performance.now(), axis: null, dx: 0 }
		}
		const onMove = (event) => {
			const swipe = swipeRef.current
			if (!swipe) return
			const touch = event.touches[0]
			const dx = touch.clientX - swipe.x
			const dy = touch.clientY - swipe.y
			if (!swipe.axis) {
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
				swipe.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
				// Measured from here, so the grid does not jump by the dead zone.
				swipe.x = touch.clientX
				swipe.time = performance.now()
			}
			if (swipe.axis !== 'x') return
			swipe.dx = touch.clientX - swipe.x
			place(swipe.dx)
		}
		const onEnd = () => {
			const swipe = swipeRef.current
			swipeRef.current = null
			if (!swipe || swipe.axis !== 'x') return
			cancelAnimationFrame(frame)
			const body = bodyRef.current
			const { dx } = swipe
			const speed = Math.abs(dx) / Math.max(1, performance.now() - swipe.time)
			const shouldTurn = Math.abs(dx) > SWIPE_DISTANCE || (Math.abs(dx) > SWIPE_FLICK && speed > SWIPE_SPEED)
			const opacity = body?.style.opacity || '1'
			if (body) {
				body.style.transform = ''
				body.style.opacity = ''
			}
			if (!shouldTurn) {
				// Not far enough: spring back to where it was.
				if (body && dx && !reducedMotion()) body.animate([{ transform: `translateX(${dx}px)`, opacity }, { transform: 'translateX(0)', opacity: 1 }], { duration: 220, easing: EASE_OUT })
				return
			}
			const step = dx < 0 ? 1 : -1
			if (!body || reducedMotion()) {
				turn(step)
				return
			}
			// Carry on in the direction of the swipe, then bring the next month in.
			const out = body.animate(
				[{ transform: `translateX(${dx}px)`, opacity }, { transform: `translateX(${-step * body.offsetWidth * 0.5}px)`, opacity: 0 }],
				{ duration: 150, easing: EASE_IN, fill: 'forwards' },
			)
			out.onfinish = () => {
				carriedRef.current = true
				turn(step)
			}
		}
		// Trackpads: a sideways two-finger swipe turns the month once per gesture.
		let wheelTotal = 0
		let wheelLocked = false
		let wheelTimer = 0
		const onWheel = (event) => {
			if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
			event.preventDefault()
			window.clearTimeout(wheelTimer)
			wheelTimer = window.setTimeout(() => {
				wheelLocked = false
				wheelTotal = 0
			}, WHEEL_SETTLE_MS)
			if (wheelLocked) return
			wheelTotal += event.deltaX
			if (Math.abs(wheelTotal) < WHEEL_DISTANCE) return
			wheelLocked = true
			shiftRef.current(wheelTotal > 0 ? 1 : -1)
			wheelTotal = 0
		}
		grid.addEventListener('touchstart', onStart, { passive: true })
		grid.addEventListener('touchmove', onMove, { passive: true })
		grid.addEventListener('touchend', onEnd)
		grid.addEventListener('touchcancel', onEnd)
		grid.addEventListener('wheel', onWheel, { passive: false })
		return () => {
			cancelAnimationFrame(frame)
			window.clearTimeout(wheelTimer)
			grid.removeEventListener('touchstart', onStart)
			grid.removeEventListener('touchmove', onMove)
			grid.removeEventListener('touchend', onEnd)
			grid.removeEventListener('touchcancel', onEnd)
			grid.removeEventListener('wheel', onWheel)
		}
	}, [])

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
		<div
			className='cal-grid'
			role='grid'
			aria-label={t('calendar.title')}
			ref={gridRef}
			onKeyDown={handleKeyDown}
			onClickCapture={(event) => {
				if (!swipedRef.current) return
				event.preventDefault()
				event.stopPropagation()
			}}
		>
			<div className='cal-grid__head' role='row'>
				{weekdays.map((name) => <span key={name} role='columnheader' className='cal-grid__weekday'>{name}</span>)}
			</div>
			<div className='cal-grid__body' ref={bodyRef}>
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
