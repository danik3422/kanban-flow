import { ChevronDown, LogOut, Palette, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../store/useAuthStore'

const AccountDropdown = () => {
	const { authUser, logout } = useAuthStore()
	const navigate = useNavigate()
	const needsSetup = authUser?.profileSetup === false
	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	const [isSheetEntering, setIsSheetEntering] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [isSwipeClosing, setIsSwipeClosing] = useState(false)
	const [isSheetExpanded, setIsSheetExpanded] = useState(false)
	const [sheetOffset, setSheetOffset] = useState(0)
	const [sheetDragHeight, setSheetDragHeight] = useState(null)
	const [sheetSettle, setSheetSettle] = useState(null)
	const [isSheetDragging, setIsSheetDragging] = useState(false)
	const dropdownRef = useRef(null)
	const triggerRef = useRef(null)
	const sheetDragStart = useRef(null)
	const sheetDragLastY = useRef(null)
	const sheetBaseHeight = useRef(0)

	useEffect(() => {
		const handleClickOutside = (event) => {
			const insideDropdown =
				dropdownRef.current?.contains(event.target) ||
				triggerRef.current?.contains(event.target)

			if (!insideDropdown) {
				setIsClosing(true)
				setIsSheetEntering(false)
				window.setTimeout(() => {
					setIsDropdownOpen(false)
					setIsClosing(false)
					setIsSheetExpanded(false)
					setSheetOffset(0)
					setSheetDragHeight(null)
				}, 300)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	useEffect(() => {
		document.body.classList.toggle('account-sheet-open', isDropdownOpen)
		return () => document.body.classList.remove('account-sheet-open')
	}, [isDropdownOpen])

	const closeMenu = ({ swipe = false } = {}) => {
		if (!isDropdownOpen || isClosing) return
		if (swipe) {
			setSheetDragHeight(null)
			setIsSheetEntering(false)
			setIsSwipeClosing(true)
			setSheetOffset(window.innerHeight)
			window.setTimeout(() => {
				setIsDropdownOpen(false)
				setSheetOffset(0)
				setIsSheetExpanded(false)
				setIsSwipeClosing(false)
			}, 300)
			return
		}
		setIsClosing(true)
		setIsSheetEntering(false)
		window.setTimeout(() => {
			setIsDropdownOpen(false)
			setIsClosing(false)
			setIsSheetExpanded(false)
			setSheetOffset(0)
			setSheetDragHeight(null)
		}, 300)
	}

	const toggleMenu = () => {
		if (isDropdownOpen) closeMenu()
		else {
			setIsDropdownOpen(true)
			setIsSheetEntering(true)
			window.setTimeout(() => setIsSheetEntering(false), 420)
		}
	}

	const handleSheetPointerDown = (event) => {
		if (window.innerWidth > 720) return
		const isHandle = event.currentTarget.classList.contains('account-sheet-handle')
		if (!isHandle && event.currentTarget !== event.target && event.target.closest('button, a, input, select, textarea')) return
		sheetDragStart.current = event.clientY
		sheetDragLastY.current = event.clientY
		sheetBaseHeight.current = dropdownRef.current?.getBoundingClientRect().height || 0
		setIsSheetDragging(false)
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const handleSheetPointerMove = (event) => {
		if (sheetDragStart.current === null) return
		if (Math.abs(event.clientY - sheetDragStart.current) < 4) return
		setIsSheetDragging(true)
		event.preventDefault()
		const delta = event.clientY - sheetDragStart.current
		sheetDragLastY.current = event.clientY
		if (delta < 0) {
			const stretch = Math.min(132, Math.abs(delta) * 0.48)
			setSheetOffset(0)
			setSheetDragHeight(Math.min(window.innerHeight - 12, sheetBaseHeight.current + stretch))
		} else {
			setSheetDragHeight(sheetBaseHeight.current)
			setSheetOffset(Math.min(180, delta))
		}
	}

	const handleSheetPointerUp = (event) => {
		if (sheetDragStart.current === null) return
		const delta = (sheetDragLastY.current ?? event.clientY) - sheetDragStart.current
		sheetDragStart.current = null
		sheetDragLastY.current = null
		setIsSheetDragging(false)
		if (delta > 96) {
			closeMenu({ swipe: true })
			return
		}
		setSheetOffset(0)
		setIsSheetExpanded(false)
		const pullStrength = Math.min(1, Math.abs(delta) / 160)
		const settleDuration = Math.round(380 + pullStrength * 140)
		setSheetSettle({
			duration: settleDuration,
			easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
		})
		setSheetDragHeight(sheetBaseHeight.current)
		window.setTimeout(() => {
			setSheetDragHeight(null)
			setSheetSettle(null)
		}, settleDuration + 30)
	}

	const goTo = (path) => {
		closeMenu()
		window.setTimeout(() => navigate(path), 300)
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
					{createPortal(
						<div
							className={`account-backdrop ${isClosing ? 'is-closing' : ''}`}
							onClick={closeMenu}
						/>,
						document.body,
					)}
					<div
						ref={dropdownRef}
						className={`account-popover ${isClosing ? 'is-closing' : ''} ${isSwipeClosing ? 'is-swipe-closing' : ''} ${isSheetEntering ? 'is-entering' : ''} ${isSheetExpanded ? 'sheet-expanded' : ''} ${isSheetDragging ? 'is-dragging' : ''} ${sheetSettle ? 'is-settling' : ''}`}
						style={{
							'--sheet-drag-offset': `${sheetOffset}px`,
							'--sheet-settle-duration': sheetSettle ? `${sheetSettle.duration}ms` : undefined,
							'--sheet-settle-ease': sheetSettle?.easing,
							height: sheetDragHeight ? `${sheetDragHeight}px` : undefined,
						}}
					>
						<button
							type='button'
							className='account-sheet-handle'
							onPointerDown={handleSheetPointerDown}
							onPointerMove={handleSheetPointerMove}
							onPointerUp={handleSheetPointerUp}
							onPointerCancel={handleSheetPointerUp}
							aria-label='Drag account menu'
						>
							<span />
						</button>
						<div
							className='account-popover-head'
							onPointerDown={handleSheetPointerDown}
							onPointerMove={handleSheetPointerMove}
							onPointerUp={handleSheetPointerUp}
							onPointerCancel={handleSheetPointerUp}
						>
							<div className='account-profile'>
								<img src={authUser.avatar || '/avatar.png'} alt='' />
								<div>
									<strong>{authUser.name || 'Your account'}</strong>
									<span>{authUser.email}</span>
								</div>
							</div>
							<button
								className='account-close'
								onClick={closeMenu}
								aria-label='Close account menu'
								title='Close account menu'
							>
								<X size={17} />
							</button>
						</div>

						{needsSetup ? (
							<button
								className='account-action account-danger'
								onClick={logout}
							>
								<LogOut size={17} /> Log out
							</button>
						) : (
							<>
								<div className='account-status'>
									<span className='account-status-dot' /> Workspace member{' '}
									<span>·</span> Active
								</div>
								<div className='account-actions'>
									<button
										className='account-action'
										onClick={() => goTo('/profile')}
									>
										<span className='account-action-icon'>P</span>
										<span>
											<strong>Profile</strong>
											<small>Personal details</small>
										</span>
									</button>
									<button
										className='account-action'
										onClick={() => goTo('/settings')}
									>
										<span className='account-action-icon'>S</span>
										<span>
											<strong>Settings</strong>
											<small>Preferences and access</small>
										</span>
									</button>
									<button
										className='account-action account-disabled'
										onClick={() =>
											toast.info('Appearance settings are in development')
										}
									>
										<Palette size={17} />
										<span>
											<strong>Appearance</strong>
											<small>In development</small>
										</span>
										<span className='account-coming-soon'>Soon</span>
									</button>
								</div>
								<div className='account-divider' />
								<button
									className='account-action account-danger'
									onClick={logout}
								>
									<LogOut size={17} /> Log out
								</button>
							</>
						)}
					</div>
				</>
			)}
		</div>
	)
}

export default AccountDropdown
