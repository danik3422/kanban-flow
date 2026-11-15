import { useEffect, useLayoutEffect, useRef } from 'react'
import { translateCurrent } from '../../../i18n/translate'
import { shortcutKey } from '../../../lib/shortcutKey'

/**
 * Board keyboard shortcuts (listed in ShortcutsDialog): arrows move focus between cards,
 * Alt + arrows move the focused card, and single keys act on the focused or hovered card.
 * Listens once per board; everything else is read fresh from `latest` on each key.
 *
 * latest: { columns, findTask, patchTask, archiveTask, moveCard, meId, announce,
 *   openShortcuts, openFilter, setCardFilter, startNewCard, openCard }
 */
const useBoardShortcuts = (boardId, latest) => {
	const actions = useRef(latest)
	useLayoutEffect(() => {
		actions.current = latest
	})
	const hoveredCardId = useRef(null)
	const hoveredColumnId = useRef(null)

	useEffect(() => {
		if (!boardId) return undefined
		const onOver = (event) => {
			const element = event.target instanceof Element ? event.target : null
			hoveredCardId.current = element?.closest('.bc-board .task-card[data-task-id]')?.dataset.taskId || null
			hoveredColumnId.current = element?.closest('.bc-board .bc-column[data-column-id]')?.dataset.columnId || null
		}
		// What is on screen, in order: lists that are open and the cards the filter shows.
		const grid = () => [...document.querySelectorAll('.bc-board > .bc-column[data-column-id]:not(.bc-column--collapsed)')]
			.map((column) => ({ id: column.dataset.columnId, cards: [...column.querySelectorAll('.task-card[data-task-id]:not(.is-filtered-out)')].map((card) => card.dataset.taskId) }))
		const focusCard = (taskId) => window.requestAnimationFrame(() => {
			const card = document.querySelector(`.bc-board .task-card[data-task-id="${taskId}"]`)
			card?.focus({ preventScroll: true })
			card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
		})
		const indexIn = (columnId, taskId) => actions.current.columns.find((column) => column._id === columnId)?.tasks.findIndex((task) => task._id === taskId) ?? -1

		const arrows = (event, focusedId) => {
			const lists = grid()
			const columnIndex = lists.findIndex((list) => list.cards.includes(focusedId))
			if (columnIndex < 0) return
			const list = lists[columnIndex]
			const row = list.cards.indexOf(focusedId)
			const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[event.key]
			const sideways = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
			event.preventDefault()
			if (!event.altKey) {
				if (!sideways) {
					const next = list.cards[row + step]
					if (next) focusCard(next)
					return
				}
				for (let index = columnIndex + step; index >= 0 && index < lists.length; index += step) {
					if (lists[index].cards.length) return focusCard(lists[index].cards[Math.min(row, lists[index].cards.length - 1)])
				}
				return
			}
			// Alt + arrows move the card: within its list, or to the next list at the same height.
			const { moveCard, findTask, columns, announce } = actions.current
			let target = list
			let index
			if (sideways) {
				target = lists[columnIndex + step]
				if (!target) return
				const before = target.cards[row]
				index = before ? indexIn(target.id, before) : (columns.find((column) => column._id === target.id)?.tasks.length ?? 0)
			} else {
				const neighbour = list.cards[row + step]
				if (!neighbour) return
				index = indexIn(list.id, neighbour)
			}
			moveCard(focusedId, target.id, index)
			const title = findTask(focusedId)?.title || ''
			const columnTitle = columns.find((column) => column._id === target.id)?.title || ''
			announce(translateCurrent('shortcuts.moved', { title, list: columnTitle, position: (sideways ? Math.min(row, target.cards.length) : row + step) + 1 }))
			focusCard(focusedId)
		}

		const onKey = (event) => {
			const target = event.target
			const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
			if (event.metaKey || event.ctrlKey || typing || document.body.classList.contains('has-modal')) return
			const focusedId = document.activeElement?.closest?.('.bc-board .task-card[data-task-id]')?.dataset.taskId || null
			if (event.key.startsWith('Arrow')) {
				if (focusedId) arrows(event, focusedId)
				else if (!event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowRight')) {
					const first = grid().find((list) => list.cards.length)?.cards[0]
					if (first) {
						event.preventDefault()
						focusCard(first)
					}
				}
				return
			}
			if (event.altKey) return
			const key = shortcutKey(event)
			const { findTask, patchTask, archiveTask, meId, openShortcuts, openFilter, setCardFilter, startNewCard, openCard } = actions.current
			const task = findTask(focusedId || hoveredCardId.current)
			if (key === '?') {
				event.preventDefault()
				openShortcuts()
			} else if (key === 'f') {
				event.preventDefault()
				openFilter()
			} else if (key === 'q' && meId) {
				event.preventDefault()
				setCardFilter((current) => {
					const onlyMine = current.members.length === 1 && current.members[0] === meId
					return { ...current, members: onlyMine ? [] : [meId] }
				})
			} else if (key === 'n') {
				const columnId = (task && String(task.column)) || hoveredColumnId.current || grid()[0]?.id
				if (!columnId) return
				event.preventDefault()
				startNewCard(columnId)
			} else if (task && key === 'e') {
				event.preventDefault()
				openCard(task)
			} else if (task && key === 'm' && meId) {
				event.preventDefault()
				const ids = (task.assignees || []).map((person) => String(person?._id || person))
				patchTask(task, { assignees: ids.includes(meId) ? ids.filter((id) => id !== meId) : [...ids, meId] })
			} else if (task && key === 'c') {
				event.preventDefault()
				patchTask(task, { completed: !task.completed })
			} else if (task && key === 'a') {
				event.preventDefault()
				archiveTask(task)
			}
		}
		document.addEventListener('mouseover', onOver, { passive: true })
		document.addEventListener('keydown', onKey)
		return () => {
			document.removeEventListener('mouseover', onOver)
			document.removeEventListener('keydown', onKey)
		}
	}, [boardId])
}

export default useBoardShortcuts
