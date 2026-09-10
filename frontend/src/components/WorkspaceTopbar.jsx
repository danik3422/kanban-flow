import {
	LayoutDashboard,
	LoaderCircle,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	Wifi,
	WifiOff,
} from 'lucide-react'
import AccountDropdown from './AccountDropdown'
import NotificationCenter from './NotificationCenter'

const WorkspaceTopbar = ({
	isSidebarOpen,
	onSidebarToggle,
	isSidebarCollapsed,
	onSidebarCollapse,
	realtimeStatus,
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
					title={`Realtime: ${realtimeStatus}`}
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
				</div>
			)}
			<NotificationCenter />
			<AccountDropdown />
		</div>
	</header>
)

export default WorkspaceTopbar
