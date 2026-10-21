import { useLayoutEffect, useRef } from 'react'

/**
 * Cards slide to their new places when the order on the board changes (a drag
 * opening a slot, a drop, a teammate's move) instead of jumping. Positions are
 * measured inside each list, so scrolling never reads as movement.
 */
const useFlipCards = (boardRef, layoutKey) => {
	const positions = useRef(new Map())
	const lastKey = useRef(layoutKey)

	useLayoutEffect(() => {
		const board = boardRef.current
		if (!board) return
		const elements = [...board.querySelectorAll('.task-card[data-task-id]')]
		const measure = (element) => {
			const list = element.closest('.bc-tasks')
			return { list, top: element.offsetTop - (list?.scrollTop || 0) }
		}
		const next = new Map(elements.map((element) => [element.dataset.taskId, measure(element)]))
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (lastKey.current !== layoutKey && !reduceMotion) {
			for (const element of elements) {
				const before = positions.current.get(element.dataset.taskId)
				const after = next.get(element.dataset.taskId)
				// Only cards that stayed in the same list glide; a card that changed lists lands.
				if (!before || before.list !== after.list || before.top === after.top) continue
				element.style.transition = 'none'
				element.style.transform = `translateY(${before.top - after.top}px)`
				element.getBoundingClientRect()
				element.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)'
				element.style.transform = ''
				const clear = () => {
					element.style.transition = ''
					element.removeEventListener('transitionend', clear)
				}
				element.addEventListener('transitionend', clear)
			}
		}
		lastKey.current = layoutKey
		positions.current = next
	})
}

export default useFlipCards
