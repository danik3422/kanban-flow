import { CalendarDays, ClipboardList, LayoutGrid, Plus, Users } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuthStore } from '../store/useAuthStore'
import { useBoardPrefs } from '../store/useBoardPrefs'
import { selectMyOpenTasks, useBoardStats } from '../store/useBoardStats'
import { Button, IconButton } from '../ui'
import { cx } from '../ui/utils'
import BoardTile from './app/BoardTile'
import './app/app-shell.css'
import BrandMark, { LogoMark } from './BrandMark'

const MAX_RECENT = 5
const MAX_STARRED = 8
// Between phone and desktop the sidebar shows as a narrow rail of icons.
const RAIL_QUERY = '(max-width: 1023px)'

const subscribeRail = (callback) => {
	const query = window.matchMedia(RAIL_QUERY)
	query.addEventListener('change', callback)
	return () => query.removeEventListener('change', callback)
}
const isRailWidth = () => window.matchMedia(RAIL_QUERY).matches

const NAV_ITEMS = [
	{ key: 'boards', to: '/workspaces', icon: LayoutGrid },
	{ key: 'myTasks', to: '/my-tasks', icon: ClipboardList },
	{ key: 'calendar', to: '/calendar', icon: CalendarDays },
	{ key: 'team', to: '/team', icon: Users },
]

const useNavigationData = (boards) => {
	const authUser = useAuthStore((state) => state.authUser)
	const { starred, recent, load } = useBoardPrefs()
	const loadStats = useBoardStats((state) => state.load)
	const myOpenTasks = useBoardStats(selectMyOpenTasks)

	useEffect(() => {
		load(authUser?._id)
	}, [authUser?._id, load])

	useEffect(() => {
		if (authUser?._id) loadStats()
	}, [authUser?._id, loadStats])

	const byId = new Map(boards.map((board) => [board._id, board]))
	const starredBoards = starred.map((id) => byId.get(id)).filter(Boolean).slice(0, MAX_STARRED)
	const recentBoards = recent
		.map((entry) => byId.get(entry.id))
		.filter((board) => board && !starred.includes(board._id))
		.slice(0, MAX_RECENT)
	return { starredBoards, recentBoards, myOpenTasks }
}

/**
 * The app's navigation: a sidebar on desktop (a rail of icons on tablets) and a
 * bottom bar on phones. Pages pass their boards and how to open or create one.
 */
const WorkspaceSidebar = ({ boards = [], selectedBoardId, onBoardSelect, onCreateBoard, isCollapsed = false }) => {
	const { t } = useI18n()
	const location = useLocation()
	const navigate = useNavigate()
	const isRail = useSyncExternalStore(subscribeRail, isRailWidth, () => false)
	const collapsed = isCollapsed || isRail
	const { starredBoards, recentBoards, myOpenTasks } = useNavigationData(boards)

	const createBoard = () => (onCreateBoard ? onCreateBoard() : navigate('/workspaces', { state: { createBoard: true } }))
	const isActive = (to) => (to === '/workspaces' ? location.pathname.startsWith('/workspaces') : location.pathname === to)

	const boardLink = (board) => (
		<li key={board._id}>
			<button
				type='button'
				className={cx('app-sidebar__board', selectedBoardId === board._id && 'is-active')}
				onClick={() => onBoardSelect?.(board)}
				aria-current={selectedBoardId === board._id ? 'page' : undefined}
				title={collapsed ? board.name : undefined}
			>
				<BoardTile board={board} size={collapsed ? 28 : 20} />
				<span className='app-sidebar__label' data-i18n-ignore>{board.name}</span>
			</button>
		</li>
	)

	const section = (title, items) => items.length > 0 && (
		<div className='app-sidebar__section'>
			<h2 className='app-sidebar__section-title'>{title}</h2>
			<ul>{items.map(boardLink)}</ul>
		</div>
	)

	return (
		<>
			<aside className={cx('app-sidebar', collapsed && 'is-collapsed')} aria-label={t('app.nav.label')}>
				<Link to='/workspaces' className='app-sidebar__brand' aria-label={t('common.homeLink')}>
					{collapsed ? <LogoMark size={32} /> : <BrandMark />}
				</Link>
				<nav className='app-sidebar__nav'>
					<ul>
						{NAV_ITEMS.map(({ key, to, icon: Icon }) => (
							<li key={key}>
								<NavLink
									to={to}
									className={() => cx('app-sidebar__link', isActive(to) && 'is-active')}
									aria-current={isActive(to) ? 'page' : undefined}
									title={collapsed ? t(`app.nav.${key}`) : undefined}
								>
									<Icon size={18} aria-hidden='true' />
									<span className='app-sidebar__label'>{t(`app.nav.${key}`)}</span>
									{key === 'myTasks' && myOpenTasks > 0 && (
										<span className='app-sidebar__count' title={t('app.nav.myTasksCount', { count: myOpenTasks })}>
											{myOpenTasks > 99 ? '99+' : myOpenTasks}
										</span>
									)}
								</NavLink>
							</li>
						))}
					</ul>
				</nav>
				<div className='app-sidebar__boards'>
					{section(t('app.nav.starred'), starredBoards)}
					{section(t('app.nav.recent'), recentBoards)}
					{!collapsed && !starredBoards.length && !recentBoards.length && boards.length > 0 && (
						<p className='app-sidebar__hint'>{t('app.nav.starHint')}</p>
					)}
				</div>
				<div className='app-sidebar__footer'>
					{collapsed ? (
						<IconButton icon={Plus} label={t('app.nav.newBoard')} variant='secondary' onClick={createBoard} />
					) : (
						<Button variant='secondary' size='sm' icon={Plus} block onClick={createBoard}>{t('app.nav.newBoard')}</Button>
					)}
				</div>
			</aside>

			<nav className='app-bottom-nav' aria-label={t('app.nav.label')}>
				{NAV_ITEMS.slice(0, 2).map(({ key, to, icon: Icon }) => (
					<Link key={key} to={to} className={cx('app-bottom-nav__item', isActive(to) && 'is-active')} aria-current={isActive(to) ? 'page' : undefined}>
						<span className='app-bottom-nav__icon'>
							<Icon size={22} aria-hidden='true' />
							{key === 'myTasks' && myOpenTasks > 0 && <span className='app-bottom-nav__badge' aria-hidden='true'>{myOpenTasks > 9 ? '9+' : myOpenTasks}</span>}
						</span>
						<span className='app-bottom-nav__label'>{t(`app.nav.${key}`)}</span>
					</Link>
				))}
				<button type='button' className='app-bottom-nav__primary' onClick={createBoard} aria-label={t('app.nav.newBoard')}>
					<Plus size={24} aria-hidden='true' />
				</button>
				{NAV_ITEMS.slice(2).map(({ key, to, icon: Icon }) => (
					<Link key={key} to={to} className={cx('app-bottom-nav__item', isActive(to) && 'is-active')} aria-current={isActive(to) ? 'page' : undefined}>
						<span className='app-bottom-nav__icon'><Icon size={22} aria-hidden='true' /></span>
						<span className='app-bottom-nav__label'>{t(`app.nav.${key}`)}</span>
					</Link>
				))}
			</nav>
		</>
	)
}

export default WorkspaceSidebar
