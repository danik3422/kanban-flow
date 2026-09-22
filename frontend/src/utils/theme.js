const resolveSystemTheme = () =>
	window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light'

export const applyTheme = (theme = 'system') => {
	const nextTheme = theme === 'system' ? resolveSystemTheme() : theme
	const isDark = nextTheme === 'dark'
	localStorage.setItem('theme', theme)
	document.documentElement.setAttribute('data-theme', nextTheme)
	document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
}

export const applyThemeFromStorage = () => {
	const storedTheme = localStorage.getItem('theme') || 'system'
	applyTheme(storedTheme)
}
