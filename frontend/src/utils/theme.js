const systemTheme = () =>
	window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const applyTheme = (theme) => {
	theme === 'system'
		? (localStorage.removeItem('theme'),
		  document.documentElement.setAttribute('data-theme', systemTheme()))
		: (localStorage.setItem('theme', theme),
		  document.documentElement.setAttribute('data-theme', theme))
}

export const applyThemeFromStorage = () =>
	applyTheme(localStorage.getItem('theme') || 'system')
