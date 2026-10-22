import { LoaderCircle, PanelLeftClose, PanelLeftOpen, Search, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { IconButton } from '../../ui'
import { cx } from '../../ui/utils'
import AccountMenu from './AccountMenu'
import QuickSwitcher from './QuickSwitcher'
import './app-shell.css'
import NotificationCenter from '../../features/notifications/NotificationCenter'
import OfflineBanner from '../OfflineBanner'
import { shortcutKey } from '../../lib/shortcutKey'

const LIVE_ICONS = { connected: Wifi, connecting: LoaderCircle, reconnecting: LoaderCircle, offline: WifiOff }
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * The bar above every app page: the page or board title (passed as children),
 * live status, the board's own actions on a board, search, notifications and the
 * account menu.
 */
const AppTopbar = ({
	isSidebarCollapsed,
	onSidebarCollapse,
	realtimeStatus,
	boardActions,
	children,
}) => {
	const { t } = useI18n()
	const [isSearchOpen, setIsSearchOpen] = useState(false)

	// Ctrl/⌘+K opens the switcher from anywhere in the app.
	useEffect(() => {
		const handleKeyDown = (event) => {
			if ((event.metaKey || event.ctrlKey) && shortcutKey(event) === 'k') {
				event.preventDefault()
				setIsSearchOpen(true)
			}
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Unknown states read as a connection in progress rather than breaking the bar.
	const liveStatus = realtimeStatus && (LIVE_ICONS[realtimeStatus] ? realtimeStatus : 'reconnecting')
	const LiveIcon = liveStatus ? LIVE_ICONS[liveStatus] : null

	return (
		<>
		<header className={cx('app-topbar', boardActions && 'app-topbar--board')}>
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
				{boardActions}
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
		<OfflineBanner inline />
		</>
	)
}

export default AppTopbar
