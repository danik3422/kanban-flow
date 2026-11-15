import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// How the board page is laid out: the planner beside the board (desktop), the board or
// the table in the main area, and on phones one of board, table or planner at a time.
// Remembered on this device.

const PLANNER_KEY = 'kh:planner'
const PHONE_VIEW_KEY = 'kh:phone-view'
const PLANNER_MIN = 300
const PLANNER_MAX = 560

const readPlannerLayout = () => {
	try {
		const saved = JSON.parse(localStorage.getItem(PLANNER_KEY) || '{}')
		return { open: Boolean(saved.open), board: saved.board !== false, view: saved.view === 'table' ? 'table' : 'board', width: Math.min(Math.max(Number(saved.width) || 360, PLANNER_MIN), PLANNER_MAX) }
	} catch {
		return { open: false, board: true, view: 'board', width: 360 }
	}
}

const readPhoneView = () => {
	try {
		const saved = localStorage.getItem(PHONE_VIEW_KEY)
		return ['table', 'planner'].includes(saved) ? saved : 'board'
	} catch {
		return 'board'
	}
}

const useBoardLayout = ({ isPhone, onShortcuts }) => {
	// The planner sits beside the board; hiding the board leaves it full width.
	const [plannerLayout, setPlannerLayout] = useState(readPlannerLayout)
	useEffect(() => {
		try {
			localStorage.setItem(PLANNER_KEY, JSON.stringify(plannerLayout))
		} catch {
			// Only a preference.
		}
	}, [plannerLayout])

	const [phoneView, setPhoneView] = useState(readPhoneView)
	const choosePhoneView = useCallback((view) => {
		setPhoneView(view)
		try {
			localStorage.setItem(PHONE_VIEW_KEY, view)
		} catch {
			// Only a preference.
		}
	}, [])

	const togglePlanner = useCallback(() => {
		if (isPhone) {
			choosePhoneView(phoneView === 'planner' ? 'board' : 'planner')
			return
		}
		setPlannerLayout((current) => (current.open ? { ...current, open: false, board: true } : { ...current, open: true }))
	}, [isPhone, phoneView, choosePhoneView])
	// The board or the table fills the main area; it can be hidden only while the planner
	// is open, so one of them always shows. Switching to the other view shows it.
	const showMainView = useCallback((view) => {
		setPlannerLayout((current) => {
			if (current.view !== view) return { ...current, view, board: true }
			return !current.board ? { ...current, board: true } : current.open ? { ...current, board: false } : current
		})
	}, [])
	const toggleBoard = useCallback(() => showMainView('board'), [showMainView])
	const toggleTable = useCallback(() => {
		if (!isPhone) showMainView('table')
	}, [isPhone, showMainView])

	// Tips (the light bulb in the top bar) can open the planner, the table or the shortcuts.
	const onShortcutsRef = useRef(onShortcuts)
	useLayoutEffect(() => {
		onShortcutsRef.current = onShortcuts
	})
	useEffect(() => {
		const handleView = (event) => {
			const view = event.detail
			if (isPhone) choosePhoneView(view)
			else if (view === 'planner') setPlannerLayout((current) => ({ ...current, open: true }))
			else setPlannerLayout((current) => ({ ...current, view, board: true }))
		}
		const handleShortcuts = () => onShortcutsRef.current?.()
		window.addEventListener('kh:board-view', handleView)
		window.addEventListener('kh:shortcuts', handleShortcuts)
		return () => {
			window.removeEventListener('kh:board-view', handleView)
			window.removeEventListener('kh:shortcuts', handleShortcuts)
		}
	}, [isPhone, choosePhoneView])

	// Dragging the planner's edge; leaving the page mid-drag removes the listeners too.
	const stopResizeRef = useRef(null)
	const startPlannerResize = (event) => {
		event.preventDefault()
		const startX = event.clientX
		const startWidth = plannerLayout.width
		document.body.classList.add('is-resizing-planner')
		const move = (moveEvent) => {
			const width = Math.round(Math.min(Math.max(startWidth + moveEvent.clientX - startX, PLANNER_MIN), Math.min(PLANNER_MAX, window.innerWidth * 0.6)))
			setPlannerLayout((current) => (current.width === width ? current : { ...current, width }))
		}
		const stop = () => {
			document.body.classList.remove('is-resizing-planner')
			window.removeEventListener('pointermove', move)
			window.removeEventListener('pointerup', stop)
			window.removeEventListener('pointercancel', stop)
			stopResizeRef.current = null
		}
		stopResizeRef.current = stop
		window.addEventListener('pointermove', move)
		window.addEventListener('pointerup', stop)
		window.addEventListener('pointercancel', stop)
	}
	useEffect(() => () => stopResizeRef.current?.(), [])

	const plannerShown = isPhone ? phoneView === 'planner' : plannerLayout.open
	return {
		plannerWidth: plannerLayout.width,
		phoneView,
		choosePhoneView,
		togglePlanner,
		toggleBoard,
		toggleTable,
		startPlannerResize,
		plannerShown,
		boardShown: isPhone ? phoneView !== 'planner' : !plannerShown || plannerLayout.board,
		mainView: isPhone ? (phoneView === 'table' ? 'table' : 'board') : plannerLayout.view,
	}
}

export default useBoardLayout
