import { useEffect, useState } from 'react'
import { themes } from '../data/themes'
import { applyTheme } from '../utils/theme'

const ThemeSelector = () => {
	const [selected, setSelected] = useState('system')

	useEffect(() => {
		const saved = localStorage.getItem('theme') || 'system'
		setSelected(saved)
	}, [])

	const handleChange = (theme) => {
		setSelected(theme)
		applyTheme(theme)
	}

	return (
		<div className='p-2 rounded-box bg-base-100 shadow space-y-2 w-max max-w-sm'>
			{themes.map((theme) => (
				<button
					key={theme.id}
					onClick={() => handleChange(theme.id)}
					className={`flex items-center gap-3 p-2 rounded-lg text-left transition-colors w-full ${
						selected === theme.id
							? 'bg-primary/10 text-primary'
							: 'hover:bg-base-200'
					}`}
				>
					<div className='relative w-8 h-8'>
						<div
							className={`w-full h-full rounded-md border ${
								theme.id === 'light'
									? 'bg-gray-200'
									: theme.id === 'dark'
									? 'bg-gray-800'
									: 'bg-gradient-to-br from-white to-black'
							}`}
						/>
						{selected === theme.id && (
							<span className='absolute -top-1 -left-1 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-white' />
						)}
					</div>
					<span className='text-sm font-medium whitespace-nowrap'>
						{theme.label}
					</span>
				</button>
			))}
		</div>
	)
}

export default ThemeSelector
