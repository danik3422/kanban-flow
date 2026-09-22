import { Menu, Monitor, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { applyTheme } from '../utils/theme'
import AccountDropdown from './AccountDropdown'

const themeOptions = [
	{ id: 'light', label: 'Light', Icon: Sun },
	{ id: 'system', label: 'System', Icon: Monitor },
	{ id: 'dark', label: 'Dark', Icon: Moon },
]

const Navbar = () => {
	const { authUser } = useAuthStore()
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isThemeOpen, setIsThemeOpen] = useState(false)
	const [selectedTheme, setSelectedTheme] = useState(
		() => localStorage.getItem('theme') || 'system',
	)
	const mobileMenuRef = useRef(null)
	const themeControlRef = useRef(null)
	const navigate = useNavigate()

	useEffect(() => {
		if (!isMenuOpen) return undefined

		const handleKeyDown = (event) => {
			if (event.key === 'Escape') setIsMenuOpen(false)
		}
		const handlePointerDown = (event) => {
			if (!mobileMenuRef.current?.contains(event.target)) setIsMenuOpen(false)
		}

		document.addEventListener('keydown', handleKeyDown)
		document.addEventListener('pointerdown', handlePointerDown)
		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			document.removeEventListener('pointerdown', handlePointerDown)
		}
	}, [isMenuOpen])

	useEffect(() => {
		if (!isThemeOpen) return undefined
		const handlePointerDown = (event) => {
			if (!themeControlRef.current?.contains(event.target)) setIsThemeOpen(false)
		}
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') setIsThemeOpen(false)
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isThemeOpen])

	const handleNavigate = (path) => {
		setIsMenuOpen(false)
		navigate(path)
	}

	const handleThemeChange = (theme) => {
		setSelectedTheme(theme)
		applyTheme(theme)
		setIsThemeOpen(false)
	}

	return (
		<header className='navbar bg-base-100 fixed top-0 left-0 right-0 z-40 border-b border-base-300'>
			<div className='navbar-inner flex justify-between items-center h-16'>
				{/* Logo */}
				<Link to='/' className='flex items-center gap-2 text-xl font-bold text-base-content'>
					<span className='brand-mark'>K</span>
					KanbanHub
				</Link>

				{/* Right Side */}
				<div className='header-actions'>
					{!authUser && (
						<div className='guest-theme-control' ref={themeControlRef}>
							<button
								type='button'
								className='guest-theme-trigger'
								onClick={() => setIsThemeOpen((current) => !current)}
								aria-expanded={isThemeOpen}
								aria-label='Choose color theme'
								title='Choose color theme'
							>
								{(() => {
									const option = themeOptions.find(({ id }) => id === selectedTheme) || themeOptions[1]
									const Icon = option.Icon
									return <Icon size={17} />
								})()}
							</button>
							{isThemeOpen && (
								<div className='guest-theme-menu' role='menu' aria-label='Color theme'>
									{themeOptions.map(({ id, label, Icon }) => (
										<button
											type='button'
											key={id}
											className={`guest-theme-option ${selectedTheme === id ? 'is-active' : ''}`}
											onClick={() => handleThemeChange(id)}
											role='menuitemradio'
											aria-checked={selectedTheme === id}
										>
											<Icon size={15} />
											<span>{label}</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}
					{authUser ? (
						<AccountDropdown />
					) : (
						<>
							{/* Desktop Auth Buttons */}
							<Link
								to='/login'
								className='header-link hidden sm:inline-flex'
							>
								Login
							</Link>
							<Link
								to='/signup'
								className='header-cta hidden sm:inline-flex'
							>
									Start organizing
							</Link>

							{/* Mobile Burger Menu */}
							<div className='relative sm:hidden' ref={mobileMenuRef}>
								<button
									onClick={() => setIsMenuOpen((prev) => !prev)}
									className='header-menu-button'
									aria-expanded={isMenuOpen}
									aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
								>
									{isMenuOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
								</button>

								{isMenuOpen && (
									<ul className='header-menu'>
										<li className='header-menu-intro'>
											<strong>Welcome to KanbanHub</strong>
											<span>Start with a clear next step.</span>
										</li>
										<li>
											<button onClick={() => handleNavigate('/login')}>
												<span><strong>Log in</strong><small>Return to your workspace</small></span>
											</button>
										</li>
										<li>
											<button onClick={() => handleNavigate('/signup')}>
												<span><strong>Start organizing</strong><small>Create your first workspace</small></span>
											</button>
										</li>
									</ul>
								)}
							</div>
						</>
					)}
				</div>
			</div>
		</header>
	)
}

export default Navbar
