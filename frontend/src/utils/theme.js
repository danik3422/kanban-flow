import { create } from 'zustand'

const THEMES = ['light', 'dark', 'system']
const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

const readStoredTheme = () => {
	try {
		const stored = localStorage.getItem('theme')
		return THEMES.includes(stored) ? stored : 'system'
	} catch {
		return 'system'
	}
}

const paint = (theme) => {
	const resolved = theme === 'system' ? (darkQuery?.matches ? 'dark' : 'light') : theme
	document.documentElement.setAttribute('data-theme', resolved)
	document.documentElement.style.colorScheme = resolved
	// The browser chrome matches the page background token of the active theme.
	const background = getComputedStyle(document.documentElement).getPropertyValue('--ui-bg').trim()
	if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
}

export const applyTheme = (theme = 'system') => {
	const next = THEMES.includes(theme) ? theme : 'system'
	try {
		localStorage.setItem('theme', next)
	} catch {
		// The theme still applies for this visit.
	}
	paint(next)
	useThemeStore.setState({ theme: next })
}

// One source of truth so every theme control (header, settings) stays in sync.
export const useThemeStore = create(() => ({ theme: readStoredTheme() }))

export const applyThemeFromStorage = () => {
	paint(useThemeStore.getState().theme)
	// Follow the operating system live while "System" is selected.
	darkQuery?.addEventListener?.('change', () => {
		if (useThemeStore.getState().theme === 'system') paint('system')
	})
}
