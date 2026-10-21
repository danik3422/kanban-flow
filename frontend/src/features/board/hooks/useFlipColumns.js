import { useLayoutEffect, useRef } from 'react'

/**
 * Lists slide to their new places whenever their order changes (dragging a list,
 * "Move list", a teammate's reorder) instead of jumping. Positions are measured
 * relative to the board, so scrolling never looks like movement.
 */
const useFlipColumns = (boardRef, orderKey) => {
	const positions = useRef(new Map())
	const lastKey = useRef(orderKey)

	useLayoutEffect(() => {
		const board = boardRef.current
		if (!board) return
		const elements = [...board.querySelectorAll(':scope > .bc-column[data-column-id]')]
		const next = new Map(elements.map((element) => [element.dataset.columnId, element.offsetLeft]))
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (lastKey.current !== orderKey && !reduceMotion) {
			for (const element of elements) {
				const before = positions.current.get(element.dataset.columnId)
				const after = next.get(element.dataset.columnId)
				if (before === undefined || before === after) continue
				element.style.transition = 'none'
				element.style.transform = `translateX(${before - after}px)`
				element.getBoundingClientRect()
				element.style.transition = 'transform 220ms cubic-bezier(0.2, 0, 0, 1)'
				element.style.transform = ''
				const clear = () => {
					element.style.transition = ''
					element.removeEventListener('transitionend', clear)
				}
				element.addEventListener('transitionend', clear)
			}
		}
		lastKey.current = orderKey
		positions.current = next
	})
}

export default useFlipColumns
