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
	const [isClosing, setIsClosing] = useState(false)
	const [isSheetExpanded, setIsSheetExpanded] = useState(false)
	const [sheetOffset, setSheetOffset] = useState(0)
	const dropdownRef = useRef(null)
	const triggerRef = useRef(null)
	const sheetDragStart = useRef(null)

	useEffect(() => {
		const handleClickOutside = (event) => {
			const insideDropdown = dropdownRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)

            if (!insideDropdown) {
				setIsClosing(true)
				window.setTimeout(() => {
					setIsDropdownOpen(false)
					setIsClosing(false)
					setIsSheetExpanded(false)
					setSheetOffset(0)
				}, 220)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	useEffect(() => {
		document.body.classList.toggle('account-sheet-open', isDropdownOpen)
		return () => document.body.classList.remove('account-sheet-open')
	}, [isDropdownOpen])

	const closeMenu = () => {
		if (!isDropdownOpen || isClosing) return
		setIsClosing(true)
		window.setTimeout(() => {
			setIsDropdownOpen(false)
			setIsClosing(false)
			setIsSheetExpanded(false)
			setSheetOffset(0)
		}, 220)
	}

	const toggleMenu = () => {
		if (isDropdownOpen) closeMenu()
		else setIsDropdownOpen(true)
	}

	const handleSheetPointerDown = (event) => {
		if (window.innerWidth > 720) return
		sheetDragStart.current = event.clientY
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const handleSheetPointerMove = (event) => {
		if (sheetDragStart.current === null) return
		setSheetOffset(Math.max(-80, event.clientY - sheetDragStart.current))
	}

	const handleSheetPointerUp = (event) => {
		if (sheetDragStart.current === null) return
		const delta = event.clientY - sheetDragStart.current
		sheetDragStart.current = null
		setSheetOffset(0)
		if (delta > 110) closeMenu()
		else if (delta < -45) setIsSheetExpanded(true)
		else if (delta > 25) setIsSheetExpanded(false)
	}

	const goTo = (path) => {
		closeMenu()
		navigate(path)
	}

	return (
		<div className='account-menu-wrap'>
			<button
				onClick={toggleMenu}
				className='account-trigger'
				ref={triggerRef}
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
					<div className={`account-backdrop ${isClosing ? 'is-closing' : ''}`} onClick={closeMenu} />
					<div ref={dropdownRef} className={`account-popover ${isClosing ? 'is-closing' : ''} ${isSheetExpanded ? 'sheet-expanded' : ''}`} style={{ '--sheet-drag-offset': `${sheetOffset}px` }}>
						<button type='button' className='account-sheet-handle' onPointerDown={handleSheetPointerDown} onPointerMove={handleSheetPointerMove} onPointerUp={handleSheetPointerUp} onPointerCancel={handleSheetPointerUp} aria-label='Drag account menu'><span /></button>
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
