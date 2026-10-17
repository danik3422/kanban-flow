import { CheckCircle2, GripVertical, ListChecks } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'
import { Avatar, AvatarGroup, Badge } from '../../ui'
import { cx } from '../../ui/utils'

const COLUMN_ORDER = ['todo', 'doing', 'done']
const PEOPLE = { olena: 'Olena Kovalenko', mark: 'Mark Wilson', danylo: 'Danylo Syloats' }
const INITIAL_COLUMNS = {
	todo: [
		{ id: 'research', label: 'research', tone: 'orange', who: 'mark' },
		{ id: 'brief', label: 'planning', tone: 'info', who: 'danylo' },
	],
	doing: [
		{ id: 'design', label: 'design', tone: 'accent', who: 'olena', checklist: '2/4' },
		{ id: 'notes', label: 'content', tone: 'warning', who: 'mark' },
	],
	done: [
		{ id: 'analytics', label: 'analytics', tone: 'success', who: 'danylo' },
		{ id: 'landing', label: 'content', tone: 'warning', who: 'olena' },
	],
}
const PLACEHOLDER = { id: '__placeholder' }
// A mouse drag starts after a small move; a finger has to rest on the card first,
// so a quick swipe still scrolls the page.
const MOUSE_SLOP = 4
const TOUCH_SLOP = 8
const LONG_PRESS_MS = 250
const EDGE_SCROLL = 48
const STATUS_MS = 2500

const indexOfTask = (columns, taskId) => {
	for (const column of COLUMN_ORDER) {
		const index = columns[column].findIndex((task) => task.id === taskId)
		if (index > -1) return { column, index }
	}
	return null
}

const moveTo = (columns, taskId, column, index) => {
	const from = indexOfTask(columns, taskId)
	if (!from) return columns
	const task = columns[from.column][from.index]
	const next = Object.fromEntries(COLUMN_ORDER.map((key) => [key, columns[key].filter((item) => item.id !== taskId)]))
	const at = Math.max(0, Math.min(index, next[column].length))
	next[column] = [...next[column].slice(0, at), task, ...next[column].slice(at)]
	return next
}

const DemoCard = ({ task, column, title, label, floating, source, lifted, settled, nudging, ...props }) => (
	<button
		type='button'
		data-demo-card={floating ? undefined : task.id}
		className={cx(
			'demo-card',
			column === 'done' && 'is-done',
			floating && 'is-floating',
			source && 'is-drag-source',
			lifted && 'is-lifted',
			settled && 'is-settled',
			nudging && 'is-nudging',
		)}
		{...props}
	>
		<span className='demo-card__top'>
			<Badge tone={task.tone}>{label}</Badge>
			<GripVertical size={14} className='demo-card__grip' aria-hidden='true' />
		</span>
		<span className='demo-card__title'>{title}</span>
		<span className='demo-card__meta'>
			{column === 'done' ? (
				<CheckCircle2 size={16} className='demo-card__done-icon' aria-hidden='true' />
			) : task.checklist ? (
				<span className='demo-card__checklist'><ListChecks size={14} aria-hidden='true' />{task.checklist}</span>
			) : <span />}
			<Avatar name={PEOPLE[task.who]} size={22} decorative />
		</span>
	</button>
)

/**
 * A small working board for the home page: cards are dragged with a mouse,
 * a finger (hold, then drag) or the keyboard (Space, arrows, Space).
 */
const DemoBoard = () => {
	const { t } = useI18n()
	const [columns, setColumns] = useState(INITIAL_COLUMNS)
	const [drag, setDrag] = useState(null)
	const [lifted, setLifted] = useState(null)
	const [settledId, setSettledId] = useState(null)
	const [status, setStatus] = useState('')
	const [announcement, setAnnouncement] = useState('')
	const [activeColumn, setActiveColumn] = useState(0)
	const [nudge, setNudge] = useState(false)
	const [isTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
	const boardRef = useRef(null)
	const stripRef = useRef(null)
	const pressRef = useRef(null)
	const dragRef = useRef(null)
	const columnsRef = useRef(columns)
	const pointerRef = useRef({ x: 0, y: 0 })
	const statusTimerRef = useRef(null)

	const taskTitle = (taskId) => t(`home.demo.${taskId}`)
	const columnName = (column) => t(`home.demo.${column}`)

	const report = (message, visible = true) => {
		setAnnouncement(message)
		if (!visible) return
		setStatus(message)
		clearTimeout(statusTimerRef.current)
		statusTimerRef.current = setTimeout(() => setStatus(''), STATUS_MS)
	}

	// The chip stays short; screen readers hear which card moved.
	const reportMove = (taskId, column) => {
		report(t('home.demo.movedShort', { column: columnName(column) }))
		setAnnouncement(t('home.demo.moved', { task: taskTitle(taskId), column: columnName(column) }))
	}

	const settle = (taskId) => {
		setSettledId(taskId)
		setTimeout(() => setSettledId((current) => (current === taskId ? null : current)), 400)
	}

	// Where the pointer would drop the card: the column under it and the slot by card midpoints.
	const dropTargetAt = (x, y) => {
		const columnElement = document.elementFromPoint(x, y)?.closest('[data-demo-column]')
		if (!columnElement || !boardRef.current?.contains(columnElement)) return null
		const cards = [...columnElement.querySelectorAll('[data-demo-card]:not(.is-drag-source)')]
		const index = cards.findIndex((card) => {
			const rect = card.getBoundingClientRect()
			return y < rect.top + rect.height / 2
		})
		return { column: columnElement.dataset.demoColumn, index: index === -1 ? cards.length : index }
	}

	const updateDrag = (patch) => {
		dragRef.current = { ...dragRef.current, ...patch }
		setDrag(dragRef.current)
	}

	const endDrag = (drop) => {
		const current = dragRef.current
		dragRef.current = null
		pressRef.current = null
		setDrag(null)
		document.body.classList.remove('is-demo-dragging')
		if (!current) return
		const target = drop ? current.over : null
		if (!target) {
			report(t('home.demo.cancelled'), false)
			return
		}
		setColumns((latest) => moveTo(latest, current.taskId, target.column, target.index))
		settle(current.taskId)
		if (target.column !== current.origin.column) reportMove(current.taskId, target.column)
	}

	const beginDrag = (press, x, y) => {
		clearTimeout(press.timer)
		const origin = indexOfTask(columnsRef.current, press.taskId)
		if (!origin) return
		if (press.pointerType !== 'mouse') navigator.vibrate?.(10)
		document.body.classList.add('is-demo-dragging')
		setNudge(false)
		dragRef.current = {
			taskId: press.taskId,
			origin,
			over: origin,
			x,
			y,
			offsetX: press.startX - press.rect.left,
			offsetY: press.startY - press.rect.top,
			width: press.rect.width,
			height: press.rect.height,
		}
		setDrag(dragRef.current)
	}

	// The window listeners below are attached once; they call the latest versions
	// of these functions so messages follow a language switch.
	const actionsRef = useRef(null)
	useLayoutEffect(() => {
		columnsRef.current = columns
		actionsRef.current = { beginDrag, endDrag, updateDrag, dropTargetAt }
	})

	// Window-level listeners: the card under the finger re-renders while dragging,
	// so the gesture must not depend on it.
	useEffect(() => {
		const handleMove = (event) => {
			const press = pressRef.current
			if (!press || event.pointerId !== press.pointerId) return
			pointerRef.current = { x: event.clientX, y: event.clientY }
			if (!dragRef.current) {
				const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY)
				if (press.pointerType === 'mouse' && distance > MOUSE_SLOP) actionsRef.current.beginDrag(press, event.clientX, event.clientY)
				else if (press.pointerType !== 'mouse' && distance > TOUCH_SLOP) {
					// The finger moved before the hold finished: this is a scroll.
					clearTimeout(press.timer)
					pressRef.current = null
				}
				return
			}
			actionsRef.current.updateDrag({ x: event.clientX, y: event.clientY, over: actionsRef.current.dropTargetAt(event.clientX, event.clientY) })
		}
		const handleUp = (event) => {
			const press = pressRef.current
			if (!press || event.pointerId !== press.pointerId) return
			clearTimeout(press.timer)
			if (dragRef.current) actionsRef.current.endDrag(true)
			pressRef.current = null
		}
		const handleCancel = (event) => {
			const press = pressRef.current
			if (!press || event.pointerId !== press.pointerId) return
			// Chrome cancels the pointer once the finger moves, even over a held card;
			// from then on the touch events below carry the drag.
			if (dragRef.current && press.pointerType === 'touch') return
			clearTimeout(press.timer)
			if (dragRef.current) actionsRef.current.endDrag(false)
			pressRef.current = null
		}
		const handleKey = (event) => {
			if (event.key === 'Escape' && dragRef.current) actionsRef.current.endDrag(false)
		}
		// Once a card is held, stop the page from scrolling under the finger and follow the touch.
		const handleTouchMove = (event) => {
			if (!dragRef.current || pressRef.current?.pointerType !== 'touch') return
			if (event.cancelable) event.preventDefault()
			const touch = event.touches[0]
			if (!touch) return
			pointerRef.current = { x: touch.clientX, y: touch.clientY }
			actionsRef.current.updateDrag({ x: touch.clientX, y: touch.clientY, over: actionsRef.current.dropTargetAt(touch.clientX, touch.clientY) })
		}
		const handleTouchEnd = (event) => {
			if (!dragRef.current || pressRef.current?.pointerType !== 'touch') return
			actionsRef.current.endDrag(event.type === 'touchend')
		}
		window.addEventListener('pointermove', handleMove)
		window.addEventListener('pointerup', handleUp)
		window.addEventListener('pointercancel', handleCancel)
		window.addEventListener('keydown', handleKey)
		window.addEventListener('touchmove', handleTouchMove, { passive: false })
		window.addEventListener('touchend', handleTouchEnd)
		window.addEventListener('touchcancel', handleTouchEnd)
		return () => {
			window.removeEventListener('pointermove', handleMove)
			window.removeEventListener('pointerup', handleUp)
			window.removeEventListener('pointercancel', handleCancel)
			window.removeEventListener('keydown', handleKey)
			window.removeEventListener('touchmove', handleTouchMove)
			window.removeEventListener('touchend', handleTouchEnd)
			window.removeEventListener('touchcancel', handleTouchEnd)
			clearTimeout(pressRef.current?.timer)
			clearTimeout(statusTimerRef.current)
			document.body.classList.remove('is-demo-dragging')
		}
	}, [])

	// On a phone the columns scroll sideways: holding a card near an edge scrolls the strip.
	const isDragging = Boolean(drag)
	useEffect(() => {
		if (!isDragging) return undefined
		let frame
		const step = () => {
			const strip = stripRef.current
			if (strip && strip.scrollWidth > strip.clientWidth) {
				const rect = strip.getBoundingClientRect()
				const { x, y } = pointerRef.current
				const left = rect.left + EDGE_SCROLL - x
				const right = x - (rect.right - EDGE_SCROLL)
				const speed = left > 0 ? -Math.min(10, left / 4) : right > 0 ? Math.min(10, right / 4) : 0
				if (speed) {
					strip.scrollLeft += speed
					if (dragRef.current) actionsRef.current.updateDrag({ over: actionsRef.current.dropTargetAt(x, y) })
				}
			}
			frame = requestAnimationFrame(step)
		}
		frame = requestAnimationFrame(step)
		return () => cancelAnimationFrame(frame)
	}, [isDragging])

	// Show once that cards move: the first card lifts a little when the board comes into view.
	useEffect(() => {
		const board = boardRef.current
		if (!board || !('IntersectionObserver' in window)) return undefined
		const observer = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting) return
			setNudge(true)
			observer.disconnect()
		}, { threshold: 0.6 })
		observer.observe(board)
		return () => observer.disconnect()
	}, [])

	// Keep keyboard focus on the card being moved after it changes column.
	useEffect(() => {
		if (lifted) boardRef.current?.querySelector(`[data-demo-card="${lifted.taskId}"]`)?.focus()
	}, [columns, lifted])

	const handlePointerDown = (event, task) => {
		if (event.button !== 0 || dragRef.current) return
		const press = {
			taskId: task.id,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			startX: event.clientX,
			startY: event.clientY,
			rect: event.currentTarget.getBoundingClientRect(),
			timer: null,
		}
		pointerRef.current = { x: event.clientX, y: event.clientY }
		pressRef.current = press
		if (event.pointerType !== 'mouse') {
			press.timer = setTimeout(() => {
				if (pressRef.current === press) beginDrag(press, pointerRef.current.x, pointerRef.current.y)
			}, LONG_PRESS_MS)
		}
	}

	const handleKeyDown = (event, task) => {
		const isActivate = event.key === ' ' || event.key === 'Enter'
		if (!lifted) {
			if (!isActivate) return
			event.preventDefault()
			setLifted({ taskId: task.id, snapshot: columns, origin: indexOfTask(columns, task.id) })
			report(t('home.demo.lifted', { task: taskTitle(task.id) }), false)
			return
		}
		if (lifted.taskId !== task.id) return
		const position = indexOfTask(columns, task.id)
		const columnIndex = COLUMN_ORDER.indexOf(position.column)
		if (isActivate) {
			event.preventDefault()
			setLifted(null)
			settle(task.id)
			if (position.column !== lifted.origin.column) reportMove(task.id, position.column)
			else report(t('home.demo.moved', { task: taskTitle(task.id), column: columnName(position.column) }), false)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			setColumns(lifted.snapshot)
			setLifted(null)
			report(t('home.demo.cancelled'), false)
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault()
			const target = COLUMN_ORDER[columnIndex + (event.key === 'ArrowLeft' ? -1 : 1)]
			if (target) {
				setColumns((latest) => moveTo(latest, task.id, target, Math.min(position.index, latest[target].length)))
				setAnnouncement(columnName(target))
			}
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault()
			const index = position.index + (event.key === 'ArrowUp' ? -1 : 1)
			if (index >= 0 && index < columns[position.column].length) setColumns((latest) => moveTo(latest, task.id, position.column, index))
		}
	}

	const handleStripScroll = () => {
		const strip = stripRef.current
		if (!strip) return
		const children = [...strip.children]
		const nearest = children.reduce((best, child, index) =>
			Math.abs(child.offsetLeft - strip.offsetLeft - strip.scrollLeft) < Math.abs(children[best].offsetLeft - strip.offsetLeft - strip.scrollLeft) ? index : best, 0)
		setActiveColumn(nearest)
	}

	// While dragging, a placeholder shows where the card will land. The card itself stays
	// in the page, hidden: touch events keep going to the element the finger started
	// on, and they stop reaching the page if that element is removed.
	const visibleColumns = (() => {
		if (!drag) return columns
		const target = drag.over || drag.origin
		return Object.fromEntries(COLUMN_ORDER.map((key) => {
			const items = [...columns[key]]
			if (key !== target.column) return [key, items]
			let seen = 0
			let at = items.length
			for (let index = 0; index < items.length; index += 1) {
				if (items[index].id === drag.taskId) continue
				if (seen === target.index) {
					at = index
					break
				}
				seen += 1
			}
			items.splice(at, 0, PLACEHOLDER)
			return [key, items]
		}))
	})()
	const countOf = (column) => visibleColumns[column].filter((task) => task.id !== drag?.taskId).length
	const draggedTask = drag && columns[drag.origin.column].find((task) => task.id === drag.taskId)
	const total = COLUMN_ORDER.reduce((sum, column) => sum + columns[column].length, 0)
	const hint = isTouch ? t('home.demo.hintTouch') : t('home.demo.hint')

	return (
		<div className={cx('demo-board', drag && 'is-dragging')} ref={boardRef}>
			<div className='demo-board__top'>
				<span className='demo-board__name'>{t('home.demo.board')}</span>
				<AvatarGroup people={Object.values(PEOPLE).map((name) => ({ name }))} size={24} label={t('home.demo.team')} />
				<span className='demo-board__count'>{t('home.demo.tasks', { count: total })}</span>
			</div>
			<p className={cx('demo-board__hint', status && 'is-status')} aria-hidden='true'>
				{status ? <CheckCircle2 size={14} /> : <GripVertical size={14} />}
				<span>{status || hint}</span>
			</p>
			<div className='demo-board__columns' ref={stripRef} onScroll={handleStripScroll}>
				{COLUMN_ORDER.map((column) => (
					<section
						key={column}
						data-demo-column={column}
						className={cx('demo-board__column', drag?.over?.column === column && 'is-drop-target')}
						aria-label={columnName(column)}
					>
						<h3 className='demo-board__column-title'>
							{columnName(column)} <span>{countOf(column)}</span>
						</h3>
						{visibleColumns[column].map((task) => task === PLACEHOLDER ? (
							<span key={task.id} className='demo-card-placeholder' style={{ height: drag.height }} aria-hidden='true' />
						) : (
							<DemoCard
								key={task.id}
								task={task}
								column={column}
								title={taskTitle(task.id)}
								label={t(`home.demo.labels.${task.label}`)}
								source={drag?.taskId === task.id}
								lifted={lifted?.taskId === task.id}
								settled={settledId === task.id}
								nudging={nudge && column === 'todo' && visibleColumns.todo[0] === task}
								aria-label={t('home.demo.grab', { task: taskTitle(task.id), column: columnName(column) })}
								aria-pressed={lifted?.taskId === task.id}
								onPointerDown={(event) => handlePointerDown(event, task)}
								onKeyDown={(event) => handleKeyDown(event, task)}
								onBlur={() => {
									if (lifted?.taskId === task.id && !boardRef.current?.contains(document.activeElement)) setLifted(null)
								}}
								onContextMenu={(event) => event.preventDefault()}
								onAnimationEnd={() => setNudge(false)}
							/>
						))}
					</section>
				))}
			</div>
			<div className='demo-board__dots' aria-hidden='true'>
				{COLUMN_ORDER.map((column, index) => <span key={column} className={cx(index === activeColumn && 'is-active')} />)}
			</div>
			<span className='ui-visually-hidden' aria-live='polite'>{announcement}</span>
			{drag && draggedTask && createPortal(
				<div
					className='demo-card-drag-layer'
					style={{ width: drag.width, transform: `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)` }}
					aria-hidden='true'
				>
					<DemoCard
						task={draggedTask}
						column={drag.origin.column}
						title={taskTitle(draggedTask.id)}
						label={t(`home.demo.labels.${draggedTask.label}`)}
						floating
						tabIndex={-1}
					/>
				</div>,
				document.body,
			)}
		</div>
	)
}

export default DemoBoard
