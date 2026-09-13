import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import AccountDropdown from './AccountDropdown'

const Navbar = () => {
	const { authUser } = useAuthStore()
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const mobileMenuRef = useRef(null)
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

	const handleNavigate = (path) => {
		setIsMenuOpen(false)
		navigate(path)
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
