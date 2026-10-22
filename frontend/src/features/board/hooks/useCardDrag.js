import { useEffect, useRef, useState } from 'react'
import { cardDropIndex } from '../model/cardOrdering'

const MOUSE_START = 4
const TOUCH_HOLD_MS = 280
const TOUCH_SLOP = 8
const EDGE = 64

const isControl = (target) => target instanceof Element && Boolean(target.closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-drag]'))

/**
 * Dragging cards with a mouse, pen or finger. A mouse lifts the card after a few
 * pixels; a finger after a short press (so swiping still scrolls the board). The
 * card follows the pointer as a tilted ghost, a slot opens where it would land,
 * the board and lists scroll at their edges, Escape cancels, and the ghost glides
 * into place on drop. `onDrop(taskId, columnId, index)` decides what happens.
 * Cards can also be dropped on a planner day (`[data-planner-day]`), which calls
 * `onPlannerDrop(taskId, dayKey)`, and picked up from the planner with the same handler.
 */
const useCardDrag = ({ boardRef, enabled, onDrop, onPlannerDrop }) => {
	const [drag, setDrag] = useState(null) // { taskId, columnId, index, height, plannerDay }
	const session = useRef(null)
	const suppressClick = useRef(false)
	const onDropRef = useRef(onDrop)
	const onPlannerDropRef = useRef(onPlannerDrop)
	useEffect(() => {
		onDropRef.current = onDrop
		onPlannerDropRef.current = onPlannerDrop
	})

	const cleanup = () => {
		const current = session.current
		if (!current) return
		window.clearTimeout(current.holdTimer)
		cancelAnimationFrame(current.frame)
		document.body.classList.remove('is-dragging-card')
		session.current = null
	}

	// Which list is under the pointer, and the slot in it.
	const locate = (x, y) => {
		const current = session.current
		const ghost = current.ghost
		if (ghost) ghost.style.visibility = 'hidden'
		const under = document.elementFromPoint(x, y)
		if (ghost) ghost.style.visibility = ''
		const day = under?.closest?.('[data-planner-day]')
		if (day) return { plannerDay: day.dataset.plannerDay }
		const column = under?.closest?.('.bc-column[data-column-id]')
		if (!column || !boardRef.current?.contains(column)) return null
		const list = column.querySelector('.bc-tasks')
		if (!list) return { columnId: column.dataset.columnId, index: Number.MAX_SAFE_INTEGER, list: null }
		let previous = -Infinity
		const centers = [...list.querySelectorAll('.task-card[data-task-id]')]
			.filter((card) => card.dataset.taskId !== current.taskId)
			.map((card) => {
				const rect = card.getBoundingClientRect()
				// Cards hidden by the filter count where the previous visible card is.
				previous = rect.height ? rect.top + rect.height / 2 : previous + 0.01
				return previous
			})
		const draggedCenter = y - current.grabY + current.height / 2
		return { columnId: column.dataset.columnId, index: cardDropIndex(centers, draggedCenter), list }
	}

	const autoScroll = () => {
		const current = session.current
		if (!current?.active) return
		const { x, y } = current.pointer
		const scroller = boardRef.current?.closest('.bc-scroll')
		if (scroller) {
			const rect = scroller.getBoundingClientRect()
			if (x < rect.left + EDGE) scroller.scrollLeft -= Math.ceil((rect.left + EDGE - x) / 4)
			else if (x > rect.right - EDGE) scroller.scrollLeft += Math.ceil((x - rect.right + EDGE) / 4)
		}
		// The planner scrolls at its edges too, so far days and "No date" can be reached.
		const planner = document.elementFromPoint(x, y)?.closest?.('.pl-scroll, .pl-side, .pl-week > .pl-day')
		if (planner) {
			const rect = planner.getBoundingClientRect()
			if (y < rect.top + EDGE) planner.scrollTop -= Math.ceil((rect.top + EDGE - y) / 3)
			else if (y > rect.bottom - EDGE) planner.scrollTop += Math.ceil((y - rect.bottom + EDGE) / 3)
		}
		const list = current.list
		if (list) {
			const rect = list.getBoundingClientRect()
			if (y < rect.top + EDGE / 2) list.scrollTop -= Math.ceil((rect.top + EDGE / 2 - y) / 3)
			else if (y > rect.bottom - EDGE / 2) list.scrollTop += Math.ceil((y - rect.bottom + EDGE / 2) / 3)
		}
		const spot = locate(x, y)
		if (spot?.plannerDay) {
			current.list = null
			current.target = { plannerDay: spot.plannerDay }
			setDrag((state) => (state && state.plannerDay !== spot.plannerDay ? { ...state, columnId: null, index: -1, plannerDay: spot.plannerDay } : state))
		} else if (spot) {
			current.list = spot.list
			current.target = { columnId: spot.columnId, index: spot.index }
			setDrag((state) => (state && (state.columnId !== spot.columnId || state.index !== spot.index || state.plannerDay) ? { ...state, columnId: spot.columnId, index: spot.index, plannerDay: null } : state))
		}
		current.frame = requestAnimationFrame(autoScroll)
	}

	const activate = () => {
		const current = session.current
		if (!current || current.active) return
		current.active = true
		const card = current.element
		const rect = card.getBoundingClientRect()
		const ghost = card.cloneNode(true)
		ghost.classList.add('task-card--ghost')
		ghost.removeAttribute('data-task-id')
		ghost.setAttribute('aria-hidden', 'true')
		Object.assign(ghost.style, { width: `${rect.width}px`, height: `${rect.height}px`, left: '0px', top: '0px', transform: `translate(${rect.left}px, ${rect.top}px)` })
		document.body.appendChild(ghost)
		requestAnimationFrame(() => ghost.classList.add('is-lifted'))
		current.ghost = ghost
		current.height = rect.height
		current.grabX = current.start.x - rect.left
		current.grabY = current.start.y - rect.top
		document.body.classList.add('is-dragging-card')
		window.getSelection()?.removeAllRanges()
		if (current.pointerType !== 'mouse') navigator.vibrate?.(10)
		// A card picked up from the planner starts on its day, not in a list.
		const column = card.closest('.bc-column[data-column-id]')
		const siblings = [...(column?.querySelectorAll('.task-card[data-task-id]') || [])]
		current.target = column ? { columnId: column.dataset.columnId, index: siblings.indexOf(card) } : { plannerDay: card.closest('[data-planner-day]')?.dataset.plannerDay }
		setDrag({ taskId: current.taskId, ...current.target, height: rect.height })
		current.list = column?.querySelector('.bc-tasks') || null
		current.frame = requestAnimationFrame(autoScroll)
	}

	const moveGhost = (x, y) => {
		const current = session.current
		if (!current?.ghost) return
		current.ghost.style.transform = `translate(${x - current.grabX}px, ${y - current.grabY}px)`
	}

	const finish = (cancelled) => {
		const current = session.current
		if (!current) return
		const wasActive = current.active
		const ghost = current.ghost
		const taskId = current.taskId
		const target = current.target
		setDrag(null)
		cleanup()
		if (!wasActive) return
		suppressClick.current = true
		window.setTimeout(() => {
			suppressClick.current = false
		}, 0)
		if (!cancelled && target?.plannerDay) onPlannerDropRef.current?.(taskId, target.plannerDay)
		else if (!cancelled && target?.columnId) onDropRef.current?.(taskId, target.columnId, target.index)
		// The ghost glides into the card's new place, then hands over to it.
		requestAnimationFrame(() => requestAnimationFrame(() => {
			const landed = target?.plannerDay
				? document.querySelector(`[data-planner-day="${target.plannerDay}"] [data-planner-task-id="${taskId}"]`)
				: boardRef.current?.querySelector(`.task-card[data-task-id="${taskId}"]`)
			const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
			if (!ghost) return
			if (!landed || reduceMotion) {
				ghost.remove()
				return
			}
			const rect = landed.getBoundingClientRect()
			landed.classList.add('is-landing')
			ghost.classList.remove('is-lifted')
			ghost.classList.add('is-dropping')
			ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`
			window.setTimeout(() => {
				ghost.remove()
				landed.classList.remove('is-landing')
			}, 190)
		}))
	}

	useEffect(() => {
		const onMove = (event) => {
			const current = session.current
			if (!current || event.pointerId !== current.pointerId) return
			current.pointer = { x: event.clientX, y: event.clientY }
			const distance = Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y)
			if (!current.active) {
				if (current.pointerType === 'mouse') {
					if (distance > MOUSE_START) activate()
				} else if (distance > TOUCH_SLOP) {
					// The finger moved before the hold: it is scrolling, not dragging.
					cleanup()
				}
				if (!session.current?.active) return
			}
			moveGhost(event.clientX, event.clientY)
		}
		const onUp = (event) => {
			if (session.current && event.pointerId === session.current.pointerId) finish(false)
		}
		const onCancel = (event) => {
			if (session.current && event.pointerId === session.current.pointerId) finish(true)
		}
		const onKey = (event) => {
			if (event.key === 'Escape' && session.current?.active) {
				event.preventDefault()
				finish(true)
			}
		}
		// Once a finger has picked a card up, the page must not scroll under it.
		const onTouchMove = (event) => {
			if (session.current?.active) event.preventDefault()
		}
		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', onUp)
		window.addEventListener('pointercancel', onCancel)
		window.addEventListener('keydown', onKey)
		window.addEventListener('touchmove', onTouchMove, { passive: false })
		return () => {
			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('pointerup', onUp)
			window.removeEventListener('pointercancel', onCancel)
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('touchmove', onTouchMove)
			cleanup()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- the handlers read the live session ref.
	}, [])

	const onPointerDown = (event, taskId) => {
		if (!enabled || session.current || (event.pointerType === 'mouse' && event.button !== 0) || isControl(event.target)) return
		const element = event.currentTarget
		if (event.pointerType === 'mouse') event.preventDefault()
		session.current = {
			taskId,
			element,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			start: { x: event.clientX, y: event.clientY },
			pointer: { x: event.clientX, y: event.clientY },
			active: false,
		}
		if (event.pointerType !== 'mouse') {
			session.current.holdTimer = window.setTimeout(() => {
				if (session.current?.taskId === taskId) {
					activate()
					moveGhost(session.current.pointer.x, session.current.pointer.y)
				}
			}, TOUCH_HOLD_MS)
		}
	}

	/** True right after a drag, so the click that ends it does not open the card. */
	const consumeClick = () => suppressClick.current

	return { drag, onPointerDown, consumeClick }
}

export default useCardDrag
