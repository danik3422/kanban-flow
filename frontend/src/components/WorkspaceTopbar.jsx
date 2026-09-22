import {
	LayoutDashboard,
	LoaderCircle,
	LockKeyhole,
	Menu,
	MoreHorizontal,
	PanelLeftClose,
	PanelLeftOpen,
	LogOut,
	Trash2,
	UsersRound,
	Wifi,
	WifiOff,
} from 'lucide-react'
import AccountDropdown from './AccountDropdown'
import ActivityFeed from './ActivityFeed'
import NotificationCenter from './NotificationCenter'
import { useEffect, useRef, useState } from 'react'

const WorkspaceTopbar = ({
	isSidebarOpen,
	onSidebarToggle,
	isSidebarCollapsed,
	onSidebarCollapse,
	realtimeStatus,
	onInvite,
	onVisibilityChange,
	boardVisibility,
	onRoomAction,
	roomActionLabel = 'Room actions',
	activities,
	activityLoading,
	children,
}) => {
	const [isMoreOpen, setIsMoreOpen] = useState(false)
	const secondaryActionsRef = useRef(null)
	const hasRoomActions = Boolean(onInvite || onVisibilityChange || onRoomAction)

	useEffect(() => {
		if (!isMoreOpen) return undefined

		const handlePointerDown = (event) => {
			if (!secondaryActionsRef.current?.contains(event.target)) {
				setIsMoreOpen(false)
			}
		}
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') setIsMoreOpen(false)
		}

		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isMoreOpen])

	return (
	<header className='workspace-topbar'>
		<div className='workspace-topbar-leading'>
			<button
				className='workspace-mobile-menu'
				onClick={onSidebarToggle}
				aria-expanded={isSidebarOpen}
				aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
				title={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
			>
				<Menu size={20} />
			</button>
			<button
				className='icon-button workspace-collapse-toggle hidden md:grid'
				onClick={onSidebarCollapse}
				aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				{isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
			</button>
			<div className='workspace-context'>
				<span className='workspace-context-icon'>
					<LayoutDashboard size={16} />
				</span>
				{children}
			</div>
		</div>
		<div className='topbar-actions'>
			{realtimeStatus && (
				<div
					className={`realtime-status realtime-status-${realtimeStatus}`}
					aria-describedby='realtime-status-help'
					aria-live='polite'
				>
					{realtimeStatus === 'connected' && <Wifi size={14} />}
					{realtimeStatus === 'reconnecting' && (
						<LoaderCircle className='realtime-status-spin' size={14} />
					)}
					{realtimeStatus === 'offline' && <WifiOff size={14} />}
					<span>
						{realtimeStatus === 'connected'
							? 'Live'
							: realtimeStatus === 'reconnecting'
								? 'Reconnecting'
								: 'Offline'}
					</span>
					<span id='realtime-status-help' className='realtime-status-tooltip' role='tooltip'>
						{realtimeStatus === 'connected'
							? 'Live updates are active. Changes from other users appear automatically.'
							: realtimeStatus === 'reconnecting'
								? 'The connection is being restored. Live updates may be delayed.'
								: 'Live updates are unavailable. Refresh or check your connection.'}
					</span>
				</div>
			)}
			{hasRoomActions && (
			<div className='workspace-secondary-actions' ref={secondaryActionsRef}>
				<button type='button' className='workspace-more-trigger' onClick={() => setIsMoreOpen((value) => !value)} aria-expanded={isMoreOpen} aria-controls='workspace-secondary-menu' aria-label='More room actions' title='More room actions'>
					<MoreHorizontal size={18} />
				</button>
				<div id='workspace-secondary-menu' className={`workspace-secondary-menu ${isMoreOpen ? 'is-open' : ''}`}>
					{onInvite && <ActivityFeed activities={activities} isLoading={activityLoading} />}
					{onInvite && (
						<button
							type='button'
							className='workspace-topbar-invite'
							onClick={() => { setIsMoreOpen(false); onInvite() }}
							aria-label='Open people in this room'
							title='People'
						>
							<UsersRound size={17} />
						</button>
					)}
					{onVisibilityChange && (
						<button
							type='button'
							className='workspace-topbar-visibility'
							onClick={() => { setIsMoreOpen(false); onVisibilityChange() }}
							aria-label='Change room visibility'
							title={`Room visibility: ${boardVisibility || 'private'}`}
						>
							<LockKeyhole size={17} />
						</button>
					)}
					{onRoomAction && (
						<button type='button' className='workspace-topbar-room-action' onClick={() => { setIsMoreOpen(false); onRoomAction() }} aria-label={roomActionLabel} title={roomActionLabel}>
							{roomActionLabel === 'Delete room' ? <Trash2 size={17} /> : <LogOut size={17} />}
						</button>
					)}
				</div>
			</div>
			)}
			<NotificationCenter />
			<AccountDropdown />
		</div>
	</header>
)
}

export default WorkspaceTopbar
