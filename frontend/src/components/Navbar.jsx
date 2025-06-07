import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const Navbar = () => {
	const [isMenuOpen, setIsMenuOpen] = useState(false)

	return (
		<header className='fixed w-full top-0 z-40 backdrop-blur-2xl bg-base-100 sm:shadow-md'>
			<div className='container mx-auto px-4 h-16 flex items-center justify-between'>
				<Link
					to='/'
					className='flex items-center gap-2.5 hover:opacity-60 transition-all'
				>
					<h1 className='text-lg font-bold'>Trello</h1>
				</Link>

				{/* Desktop navigation */}
				<nav className='hidden sm:flex items-center gap-6'>
					<Link
						to='/login'
						className='text-sm font-medium hover:text-blue-600 transition'
					>
						Login
					</Link>
					<Link
						to='/signup'
						className='btn btn-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 transition'
					>
						Get Trello for free
					</Link>
				</nav>

				{/* Burger icon for mobile */}
				<button
					className='sm:hidden p-2 rounded-md focus:outline-none'
					onClick={() => setIsMenuOpen(!isMenuOpen)}
					aria-label='Toggle Menu'
				>
					{isMenuOpen ? <X size={24} /> : <Menu size={24} />}
				</button>
			</div>

			{/* Mobile dropdown menu */}
			<div
				className={`sm:hidden transition-all duration-300 ease-in-out overflow-hidden ${
					isMenuOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
				}`}
			>
				<div className='px-4 py-4 shadow-md space-y-2'>
					<Link
						to='/login'
						className='block w-full text-sm bg-blue-600 text-white rounded-md text-center py-2 hover:bg-blue-700 transition'
						onClick={() => setIsMenuOpen(false)}
					>
						Login
					</Link>
					<Link
						to='/signup'
						className='block w-full text-sm bg-blue-600 text-white rounded-md text-center py-2 hover:bg-blue-700 transition'
						onClick={() => setIsMenuOpen(false)}
					>
						Get Trello for free
					</Link>
				</div>
			</div>
		</header>
	)
}

export default Navbar
