import { CheckSquare, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import AccountDropdown from './AccountDropdown'

const Navbar = () => {
	const { authUser } = useAuthStore()
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const navigate = useNavigate()

	const handleNavigate = (path) => {
		setIsMenuOpen(false)
		navigate(path)
	}

	return (
		<header className='navbar bg-base-100 fixed top-0 left-0 right-0 z-40 border-b border-base-300'>
			<div className='container mx-auto px-4 w-full flex justify-between items-center h-16'>
				{/* Logo */}
				<Link to='/' className='flex items-center gap-2 text-xl font-bold text-base-content'>
					<span className='brand-mark'><CheckSquare size={15} /></span>
					Kanban
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
							<div className='relative sm:hidden'>
								<button
									onClick={() => setIsMenuOpen((prev) => !prev)}
									className='header-menu-button'
								>
									<Menu className='w-5 h-5' />
								</button>

								{isMenuOpen && (
										<ul className='header-menu'>
										<li>
											<button onClick={() => handleNavigate('/login')}>
												Login
											</button>
										</li>
										<li>
											<button onClick={() => handleNavigate('/signup')}>
												Start organizing
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
