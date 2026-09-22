import { themes } from '../data/themes'
import { applyTheme } from '../utils/theme'

const ThemeSelector = ({ selected, onChange }) => {
	const currentTheme = selected || localStorage.getItem('theme') || 'system'

	const handleChange = (theme) => {
		if (onChange) {
			onChange(theme)
		}
		applyTheme(theme)
	}

	return (
		<div className='theme-selector'>
			{themes.map((theme) => (
				<button
					type='button'
					key={theme.id}
					onClick={() => handleChange(theme.id)}
					className={`theme-option ${currentTheme === theme.id ? 'is-active' : ''}`}
				>
					<span className={`theme-swatch theme-swatch--${theme.id}`} />
					<span>{theme.label}</span>
				</button>
			))}
		</div>
	)
}

export default ThemeSelector
