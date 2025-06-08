import { Menu } from 'lucide-react'
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
		<header className='navbar bg-base-100 shadow-md fixed top-0 left-0 right-0 z-40'>
			<div className='container mx-auto px-4 w-full flex justify-between items-center h-16'>
				{/* Logo */}
				<Link to='/' className='text-xl font-bold text-primary'>
					Trello
				</Link>

				{/* Right Side */}
				<div className='flex items-center gap-4'>
					{authUser ? (
						<AccountDropdown />
					) : (
						<>
							{/* Desktop Auth Buttons */}
							<Link
								to='/login'
								className='btn btn-ghost btn-sm hidden sm:inline-flex'
							>
								Login
							</Link>
							<Link
								to='/signup'
								className='btn btn-primary btn-sm hidden sm:inline-flex'
							>
								Get Trello for free
							</Link>

							{/* Mobile Burger Menu */}
							<div className='relative sm:hidden'>
								<button
									onClick={() => setIsMenuOpen((prev) => !prev)}
									className='btn btn-circle btn-ghost'
								>
									<Menu className='w-5 h-5' />
								</button>

								{isMenuOpen && (
									<ul className='menu absolute right-0 mt-2 z-50 p-2 shadow bg-base-100 rounded-box w-48'>
										<li>
											<button onClick={() => handleNavigate('/login')}>
												Login
											</button>
										</li>
										<li>
											<button onClick={() => handleNavigate('/signup')}>
												Get Trello for free
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
