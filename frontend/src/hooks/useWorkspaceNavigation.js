import { useEffect, useState } from 'react'

const SIDEBAR_OPEN_KEY = 'kanban-sidebar-open'
const SIDEBAR_COLLAPSED_KEY = 'kanban-sidebar-collapsed'

const readStoredBoolean = (key, fallback) => {
	if (typeof window === 'undefined') return fallback
	const value = window.localStorage.getItem(key)
	return value === null ? fallback : value === 'true'
}

const useWorkspaceNavigation = () => {
	const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
		readStoredBoolean(SIDEBAR_OPEN_KEY, false),
	)
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
		readStoredBoolean(SIDEBAR_COLLAPSED_KEY, false),
	)

	useEffect(() => {
		window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(isSidebarOpen))
	}, [isSidebarOpen])

	useEffect(() => {
		window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed))
	}, [isSidebarCollapsed])

	return {
		isSidebarOpen,
		setIsSidebarOpen,
		isSidebarCollapsed,
		setIsSidebarCollapsed,
	}
}

export default useWorkspaceNavigation
