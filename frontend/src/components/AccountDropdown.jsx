import { ChevronDown, LogOut, Settings2, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { handleAvatarError } from '../utils/avatar'

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
	const [isSheetDragging, setIsSheetDragging] = useState(false)
	const [isSheetSettling, setIsSheetSettling] = useState(false)
	const [sheetSettleDuration, setSheetSettleDuration] = useState(360)
	const dropdownRef = useRef(null)
	const triggerRef = useRef(null)
	const sheetDragStart = useRef(null)
	const sheetDragLastY = useRef(null)
	const sheetBaseHeight = useRef(0)
	const sheetDraggingRef = useRef(false)
	const sheetFrameRef = useRef(null)
	const sheetLastTime = useRef(0)
	const sheetVelocity = useRef(0)

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
				}, 300)
			}
		}

		document.addEventListener('pointerdown', handleClickOutside)
		return () => document.removeEventListener('pointerdown', handleClickOutside)
	}, [])

	useEffect(() => {
		document.body.classList.toggle('account-sheet-open', isDropdownOpen)
		return () => document.body.classList.remove('account-sheet-open')
	}, [isDropdownOpen])

	const closeMenu = useCallback(({ swipe = false } = {}) => {
		if (!isDropdownOpen || isClosing) return
		if (swipe) {
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
		}, 300)
	}, [isClosing, isDropdownOpen])

	useEffect(() => {
		if (!isDropdownOpen) return undefined
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') closeMenu()
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [closeMenu, isDropdownOpen])

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
		const isHandle = event.currentTarget.classList.contains(
			'account-sheet-handle',
		)
		if (
			!isHandle &&
			event.currentTarget !== event.target &&
			event.target.closest('button, a, input, select, textarea')
		)
			return
		sheetDragStart.current = event.clientY
		sheetDragLastY.current = event.clientY
		sheetBaseHeight.current =
			dropdownRef.current?.getBoundingClientRect().height || 0
		sheetDraggingRef.current = false
		sheetLastTime.current = performance.now()
		sheetVelocity.current = 0
		setIsSheetSettling(false)
		setIsSheetDragging(false)
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const handleSheetPointerMove = (event) => {
		if (sheetDragStart.current === null) return
		if (Math.abs(event.clientY - sheetDragStart.current) < 4) return
		if (!sheetDraggingRef.current) {
			sheetDraggingRef.current = true
			setIsSheetDragging(true)
		}
		event.preventDefault()
		const delta = event.clientY - sheetDragStart.current
		const now = performance.now()
		const elapsed = Math.max(8, now - sheetLastTime.current)
		const instantVelocity = (event.clientY - (sheetDragLastY.current ?? event.clientY)) / elapsed
		sheetVelocity.current = sheetVelocity.current * 0.65 + instantVelocity * 0.35
		sheetLastTime.current = now
		sheetDragLastY.current = event.clientY
		const offset = delta < 0 ? 0 : Math.min(180, delta)
		if (sheetFrameRef.current) cancelAnimationFrame(sheetFrameRef.current)
		sheetFrameRef.current = requestAnimationFrame(() => {
			dropdownRef.current?.style.setProperty('--sheet-drag-offset', `${offset}px`)
		})
	}

	const handleSheetPointerUp = (event) => {
		if (sheetDragStart.current === null) return
		const delta =
			(sheetDragLastY.current ?? event.clientY) - sheetDragStart.current
		sheetDragStart.current = null
		sheetDragLastY.current = null
		sheetDraggingRef.current = false
		setIsSheetDragging(false)
		const projectedDelta = delta + sheetVelocity.current * 140
		if (projectedDelta > 120) {
			closeMenu({ swipe: true })
			return
		}
		const settleDuration = Math.min(
			520,
			Math.max(260, 360 - Math.abs(sheetVelocity.current) * 80),
		)
		setSheetSettleDuration(settleDuration)
		setIsSheetSettling(true)
		setSheetOffset(0)
		setIsSheetExpanded(false)
		window.setTimeout(() => setIsSheetSettling(false), settleDuration + 30)
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
				<img
					className={!authUser.avatar ? 'is-default-avatar' : ''}
					src={authUser.avatar || '/avatar.png'}
					onError={handleAvatarError}
					alt=''
				/>
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
						className={`account-popover ${isClosing ? 'is-closing' : ''} ${isSwipeClosing ? 'is-swipe-closing' : ''} ${isSheetEntering ? 'is-entering' : ''} ${isSheetExpanded ? 'sheet-expanded' : ''} ${isSheetDragging ? 'is-dragging' : ''} ${isSheetSettling ? 'is-settling' : ''}`}
						style={{
							'--sheet-drag-offset': `${sheetOffset}px`,
							'--sheet-settle-duration': `${sheetSettleDuration}ms`,
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
								<img
									className={!authUser.avatar ? 'is-default-avatar' : ''}
									src={authUser.avatar || '/avatar.png'}
									onError={handleAvatarError}
									alt=''
								/>
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
											<div className='account-actions account-actions-setup'>
												<button className='account-action' onClick={() => goTo('/setup-profile')}>
													<span className='account-action-icon'><UserRound size={17} /></span>
													<span><strong>Complete profile</strong><small>Add your details to unlock the workspace.</small></span>
												</button>
												<button className='account-action account-danger' onClick={logout}>
													<LogOut size={17} /> Log out
												</button>
											</div>
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
										<span className='account-action-icon'>
											<UserRound size={17} strokeWidth={2} />
										</span>
										<span>
											<strong>Profile</strong>
											<small>Personal details</small>
										</span>
									</button>
									<button
										className='account-action'
										onClick={() => goTo('/settings')}
									>
										<span className='account-action-icon'>
											<Settings2 size={17} strokeWidth={2} />
										</span>
										<span>
											<strong>Settings</strong>
											<small>Preferences and access</small>
										</span>
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
