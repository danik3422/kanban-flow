import { ChevronDown, LogOut, Palette, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const AccountDropdown = () => {
	const { authUser, logout } = useAuthStore()
	const navigate = useNavigate()
	const needsSetup = authUser?.profileSetup === false
	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	const dropdownRef = useRef(null)

	useEffect(() => {
		const handleClickOutside = (event) => {
			const insideDropdown = dropdownRef.current?.contains(event.target)

            if (!insideDropdown) {
				setIsDropdownOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const closeMenu = () => {
		setIsDropdownOpen(false)
	}

	const goTo = (path) => {
		closeMenu()
		navigate(path)
	}

	return (
		<div className='account-menu-wrap'>
			<button
				onClick={() => setIsDropdownOpen((value) => !value)}
				className='account-trigger'
				aria-expanded={isDropdownOpen}
				aria-label='Open account menu'
			>
				<img src={authUser.avatar || '/avatar.png'} alt='' />
				<span className='account-trigger-copy'>
					<strong>{authUser.name || 'Your account'}</strong>
					<small>Account</small>
				</span>
				<ChevronDown size={15} className={isDropdownOpen ? 'rotate-180' : ''} />
			</button>

			{isDropdownOpen && (
				<>
					<div className='account-backdrop' onClick={closeMenu} />
					<div ref={dropdownRef} className='account-popover'>
						<div className='account-popover-head'>
							<div className='account-profile'>
								<img src={authUser.avatar || '/avatar.png'} alt='' />
								<div>
									<strong>{authUser.name || 'Your account'}</strong>
									<span>{authUser.email}</span>
								</div>
							</div>
							<button className='account-close' onClick={closeMenu} aria-label='Close account menu' title='Close account menu'><X size={17} /></button>
						</div>

						{needsSetup ? (
							<button className='account-action account-danger' onClick={logout}><LogOut size={17} /> Log out</button>
						) : (
							<>
								<div className='account-status'><span className='account-status-dot' /> Workspace member <span>·</span> Active</div>
								<div className='account-actions'>
									<button className='account-action' onClick={() => goTo('/profile')}><span className='account-action-icon'>P</span><span><strong>Profile</strong><small>Personal details</small></span></button>
									<button className='account-action' onClick={() => goTo('/settings')}><span className='account-action-icon'>S</span><span><strong>Settings</strong><small>Preferences and access</small></span></button>
									<button className='account-action account-disabled' onClick={() => toast.info('Appearance settings are in development')}><Palette size={17} /><span><strong>Appearance</strong><small>In development</small></span><span className='account-coming-soon'>Soon</span></button>
								</div>
								<div className='account-divider' />
								<button className='account-action account-danger' onClick={logout}><LogOut size={17} /> Log out</button>
							</>
						)}
					</div>
				</>
			)}
		</div>
	)
}

export default AccountDropdown
