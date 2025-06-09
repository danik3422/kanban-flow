import { Home, List, LogOut, Settings, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const MIN_WIDTH = 200
const MAX_WIDTH = 400

const WorkspaceSidebar = ({ isOpen, onClose }) => {
	const { authUser, logout } = useAuthStore()
	const [width, setWidth] = useState(280)
	const isDragging = useRef(false)
	const sidebarRef = useRef(null)

	useEffect(() => {
		const handleMouseMove = (e) => {
			if (!isDragging.current) return
			const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH)
			setWidth(newWidth)
		}

		const handleMouseUp = () => {
			isDragging.current = false
			document.body.style.cursor = ''
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)

		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [])

	const navItems = [
		{ icon: <Home size={20} />, label: 'Home' },
		{ icon: <List size={20} />, label: 'Tasks' },
		{ icon: <Users size={20} />, label: 'Users', count: 2 },
		{ icon: <Settings size={20} />, label: 'Settings' },
	]

	return (
		<>
			{/* Overlay for mobile */}
			<div
				className={`fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden transition-opacity duration-300 ${
					isOpen ? 'block' : 'hidden'
				}`}
				onClick={onClose}
			/>

			<aside
				ref={sidebarRef}
				style={{ width }}
				className={`bg-base-100 border-r border-base-300 flex flex-col justify-between shadow-sm
					fixed md:static h-full z-40 transition-transform duration-300
					${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
			>
				{/* Header */}
				<div className='border-b border-base-300'>
					<div className='px-5 py-4 flex items-center justify-between md:block'>
						<Link
							to='/workspaces'
							className='text-2xl font-extrabold text-primary hover:opacity-80 transition-opacity'
						>
							Trello
						</Link>
						{/* Mobile close */}
						<button onClick={onClose} className='md:hidden text-base-content'>
							<X size={22} />
						</button>
					</div>

					{/* Navigation */}
					<nav className='flex flex-col'>
						{navItems.map((item, i) => (
							<div
								key={i}
								className='flex justify-between items-center px-4 py-3 border-b border-base-300 hover:bg-base-200/60 transition-colors duration-200 rounded-md'
							>
								<div className='flex items-center gap-2 text-sm text-base-content'>
									{item.icon}
									<span>{item.label}</span>
								</div>
								{item.count !== undefined && (
									<div className='badge badge-sm badge-primary'>
										{item.count}
									</div>
								)}
							</div>
						))}
					</nav>
				</div>

				{/* Footer */}
				{/* Footer */}
				<div className='border-t border-base-300 px-4 py-4'>
					<div className='flex items-center justify-between gap-2'>
						<div className='flex items-center gap-3 min-w-0'>
							<div className='avatar'>
								<div className='w-11 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2'>
									<img src={authUser.avatar || '/avatar.png'} alt='avatar' />
								</div>
							</div>
							<div className='leading-tight hidden sm:block min-w-0'>
								<p className='font-semibold text-sm truncate'>
									{authUser.name || authUser.email}
								</p>
								<p className='text-xs text-base-content/60 truncate'>
									{authUser.email}
								</p>
							</div>
						</div>

						<button
							onClick={logout}
							className='text-error hover:text-error-focus transition-colors shrink-0'
							title='Log out'
						>
							<LogOut size={20} />
						</button>
					</div>
				</div>
			</aside>

			{/* Resize handle (desktop only) */}
			<div
				onMouseDown={() => {
					if (window.innerWidth >= 768) {
						isDragging.current = true
						document.body.style.cursor = 'col-resize'
					}
				}}
				className='hidden md:block w-1 cursor-col-resize bg-base-200 hover:bg-base-300 transition-colors'
			/>
		</>
	)
}

export default WorkspaceSidebar
