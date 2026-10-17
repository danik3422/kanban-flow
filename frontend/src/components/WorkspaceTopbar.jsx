import { LoaderCircle, LockKeyhole, LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Search, Trash2, UsersRound, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { IconButton } from '../ui'
import { cx } from '../ui/utils'
import AccountMenu from './app/AccountMenu'
import QuickSwitcher from './app/QuickSwitcher'
import './app/app-shell.css'
import ActivityFeed from './ActivityFeed'
import NotificationCenter from './NotificationCenter'

const LIVE_ICONS = { connected: Wifi, connecting: LoaderCircle, reconnecting: LoaderCircle, offline: WifiOff }
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * The bar above every app page: the page or board title (passed as children),
 * search, live status, board actions, notifications and the account menu.
 */
const WorkspaceTopbar = ({
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
	const { t } = useI18n()
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const [isMoreOpen, setIsMoreOpen] = useState(false)
	const secondaryActionsRef = useRef(null)
	const hasRoomActions = Boolean(onInvite || onVisibilityChange || onRoomAction)

	// Ctrl/⌘+K opens the switcher from anywhere in the app.
	useEffect(() => {
		const handleKeyDown = (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault()
				setIsSearchOpen(true)
			}
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [])

	useEffect(() => {
		if (!isMoreOpen) return undefined
		const handlePointerDown = (event) => {
			if (!secondaryActionsRef.current?.contains(event.target)) setIsMoreOpen(false)
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

	// Unknown states read as a connection in progress rather than breaking the bar.
	const liveStatus = realtimeStatus && (LIVE_ICONS[realtimeStatus] ? realtimeStatus : 'reconnecting')
	const LiveIcon = liveStatus ? LIVE_ICONS[liveStatus] : null

	return (
		<header className='app-topbar'>
			<div className='app-topbar__leading'>
				{onSidebarCollapse && (
					<IconButton
						className='app-topbar__collapse'
						icon={isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose}
						label={isSidebarCollapsed ? t('app.nav.expand') : t('app.nav.collapse')}
						onClick={onSidebarCollapse}
					/>
				)}
				<div className='app-topbar__context'>{children}</div>
			</div>
			<div className='app-topbar__actions'>
				{liveStatus && (
					<span className={cx('app-live', `app-live--${liveStatus}`)} title={t(`app.live.${liveStatus}Hint`)} role='status'>
						<LiveIcon size={14} className={liveStatus === 'connecting' || liveStatus === 'reconnecting' ? 'app-live__spin' : undefined} aria-hidden='true' />
						<span className='app-live__label'>{t(`app.live.${liveStatus}`)}</span>
						<span className='ui-visually-hidden'>{t(`app.live.${liveStatus}Hint`)}</span>
					</span>
				)}
				{hasRoomActions && (
					<div className='workspace-secondary-actions' ref={secondaryActionsRef}>
						<button type='button' className='workspace-more-trigger' onClick={() => setIsMoreOpen((value) => !value)} aria-expanded={isMoreOpen} aria-controls='workspace-secondary-menu' aria-label='More room actions' title='More room actions'>
							<MoreHorizontal size={18} />
						</button>
						<div id='workspace-secondary-menu' className={`workspace-secondary-menu ${isMoreOpen ? 'is-open' : ''}`}>
							{onInvite && <ActivityFeed activities={activities} isLoading={activityLoading} />}
							{onInvite && (
								<button type='button' className='workspace-topbar-invite' onClick={() => { setIsMoreOpen(false); onInvite() }} aria-label='Open people in this room' title='People'>
									<UsersRound size={17} />
								</button>
							)}
							{onVisibilityChange && (
								<button type='button' className='workspace-topbar-visibility' onClick={() => { setIsMoreOpen(false); onVisibilityChange() }} aria-label='Change room visibility' title={`Room visibility: ${boardVisibility || 'private'}`}>
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
				<button type='button' className='app-search-trigger' onClick={() => setIsSearchOpen(true)} aria-label={t('app.search.label')} aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}>
					<Search size={17} aria-hidden='true' />
					<span className='app-search-trigger__text'>{t('app.search.trigger')}</span>
					<kbd className='app-search-trigger__kbd' aria-hidden='true'>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
				</button>
				<NotificationCenter />
				<AccountMenu />
			</div>
			<QuickSwitcher open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
		</header>
	)
}

export default WorkspaceTopbar
