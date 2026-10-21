import { useEffect, useState } from 'react'

const SIDEBAR_COLLAPSED_KEY = 'kanban-sidebar-collapsed'

const readStoredBoolean = (key, fallback) => {
	try {
		const value = window.localStorage.getItem(key)
		return value === null ? fallback : value === 'true'
	} catch {
		return fallback
	}
}

const useWorkspaceNavigation = () => {
	// The mobile drawer always starts closed; only the desktop collapse preference persists.
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
		readStoredBoolean(SIDEBAR_COLLAPSED_KEY, false),
	)

	useEffect(() => {
		try {
			window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed))
		} catch {
			// Storage can be unavailable in private mode.
		}
	}, [isSidebarCollapsed])

	return {
		isSidebarOpen,
		setIsSidebarOpen,
		isSidebarCollapsed,
		setIsSidebarCollapsed,
	}
}

export default useWorkspaceNavigation
