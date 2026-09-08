export const applyTheme = () => {
	localStorage.setItem('theme', 'light')
	document.documentElement.setAttribute('data-theme', 'light')
}

export const applyThemeFromStorage = () => applyTheme('light')
