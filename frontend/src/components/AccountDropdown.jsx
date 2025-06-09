import {
	HelpCircle,
	Keyboard,
	LayoutDashboard,
	LogOut,
	Palette,
	Settings,
	User,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import ThemeSelector from './ThemeSelector'

const AccountDropdown = () => {
	const { authUser, logout } = useAuthStore()
	const needsSetup = authUser?.profileSetup === false

	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	const [isThemeOpen, setIsThemeOpen] = useState(false)

	const dropdownRef = useRef(null)
	const themeRef = useRef(null)
	const buttonRef = useRef(null)

	useEffect(() => {
		const handleClickOutside = (event) => {
			const isClickInsideDropdown = dropdownRef.current?.contains(event.target)
			const isClickInsideTheme = themeRef.current?.contains(event.target)
			const isClickOnThemeButton = buttonRef.current?.contains(event.target)

			// If click is outside all controlled areas → close both
			if (
				!isClickInsideDropdown &&
				!isClickInsideTheme &&
				!isClickOnThemeButton
			) {
				setIsDropdownOpen(false)
				setIsThemeOpen(false)
			}

			// If click is outside just the theme and its button → close only theme
			if (
				isDropdownOpen &&
				!isClickInsideTheme &&
				!isClickOnThemeButton &&
				isClickInsideDropdown
			) {
				setIsThemeOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [isDropdownOpen])

	return (
		<div className='relative'>
			<button
				onClick={() => setIsDropdownOpen(!isDropdownOpen)}
				className='btn btn-ghost btn-circle avatar'
			>
				<div className='w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2'>
					<img src={authUser.avatar || '/avatar.png'} alt='avatar' />
				</div>
			</button>

			{isDropdownOpen && (
				<div
					ref={dropdownRef}
					className='absolute right-0 mt-3 z-50 w-72 bg-base-200 rounded-box shadow-lg p-4'
				>
					{/* User Info */}
					<div className='flex items-center gap-4 mb-4'>
						<div className='avatar'>
							<div className='w-12 rounded-full'>
								<img src={authUser.avatar || '/avatar.png'} alt='avatar' />
							</div>
						</div>
						<div>
							<p className='font-bold'>{authUser.name || authUser.email}</p>
							<p className='text-sm text-gray-500'>{authUser.email}</p>
						</div>
					</div>

					{needsSetup ? (
						<ul className='menu menu-sm bg-base-200 rounded-box'>
							<li>
								<button
									onClick={logout}
									className='flex items-center gap-2 text-error'
								>
									<LogOut className='w-4 h-4' />
									Log out
								</button>
							</li>
						</ul>
					) : (
						<>
							<p className='text-xs font-semibold text-gray-500 mb-1'>
								ACCOUNT
							</p>
							<ul className='menu menu-sm bg-base-200 rounded-box mb-2'>
								<li>
									<a className='flex items-center gap-2'>
										<User className='w-4 h-4' />
										Profile & Access
									</a>
								</li>
								<li>
									<a className='flex items-center gap-2'>
										<Settings className='w-4 h-4' />
										Account Settings
									</a>
								</li>
							</ul>

							<p className='text-xs font-semibold text-gray-500 mb-1'>TRELLO</p>
							<ul className='menu menu-sm bg-base-200 rounded-box mb-2'>
								<li>
									<a className='flex items-center gap-2'>
										<LayoutDashboard className='w-4 h-4' />
										Boards
									</a>
								</li>
								<li className='relative'>
									<button
										ref={buttonRef}
										onClick={() => setIsThemeOpen(!isThemeOpen)}
										className='flex items-center gap-2 w-full text-left'
									>
										<Palette className='w-4 h-4' />
										Theme
									</button>

									{isThemeOpen && (
										<div
											ref={themeRef}
											className='absolute top-full mt-2 sm:top-0 sm:mt-0 sm:-left-65 z-50'
										>
											<ThemeSelector onClose={() => setIsThemeOpen(false)} />
										</div>
									)}
								</li>
							</ul>

							<p className='text-xs font-semibold text-gray-500 mb-1'>MORE</p>
							<ul className='menu menu-sm bg-base-200 rounded-box mb-2'>
								<li>
									<a className='flex items-center gap-2'>
										<HelpCircle className='w-4 h-4' />
										Help
									</a>
								</li>
								<li>
									<a className='flex items-center gap-2'>
										<Keyboard className='w-4 h-4' />
										Keyboard Shortcuts
									</a>
								</li>
							</ul>

							<div className='divider my-2' />
							<ul className='menu menu-sm bg-base-200 rounded-box'>
								<li>
									<button
										onClick={logout}
										className='flex items-center gap-2 text-error'
									>
										<LogOut className='w-4 h-4' />
										Log out
									</button>
								</li>
							</ul>
						</>
					)}
				</div>
			)}
		</div>
	)
}

export default AccountDropdown
