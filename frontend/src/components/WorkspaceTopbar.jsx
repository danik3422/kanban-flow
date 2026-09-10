import {
	LayoutDashboard,
	LoaderCircle,
	LockKeyhole,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	UsersRound,
	Wifi,
	WifiOff,
} from 'lucide-react'
import AccountDropdown from './AccountDropdown'
import ActivityFeed from './ActivityFeed'
import NotificationCenter from './NotificationCenter'

const WorkspaceTopbar = ({
	isSidebarOpen,
	onSidebarToggle,
	isSidebarCollapsed,
	onSidebarCollapse,
	realtimeStatus,
	onInvite,
	onVisibilityChange,
	boardVisibility,
	activities,
	activityLoading,
	children,
}) => (
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
			{onInvite && <ActivityFeed activities={activities} isLoading={activityLoading} />}
			{onInvite && (
				<button
					type='button'
					className='workspace-topbar-invite'
					onClick={onInvite}
					aria-label='Open people in this room'
					title='People'
				>
					<UsersRound size={17} />
				</button>
			)}
			<NotificationCenter />
			{onVisibilityChange && (
				<button
					type='button'
					className='workspace-topbar-visibility'
					onClick={onVisibilityChange}
					aria-label='Change room visibility'
					title={`Room visibility: ${boardVisibility || 'private'}`}
				>
					<LockKeyhole size={17} />
				</button>
			)}
			<AccountDropdown />
		</div>
	</header>
)

export default WorkspaceTopbar
