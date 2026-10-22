import { ArrowUpDown, Check, FolderKanban, Globe, Lock, Plus, Search, SearchX, Star, Users, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { relativeTime } from '../../lib/relativeTime'
import { useAuthStore } from '../../store/useAuthStore'
import { useBoardPrefs } from '../../store/useBoardPrefs'
import { useBoardStats } from '../../store/useBoardStats'
import { AvatarGroup, Badge, Button, EmptyState, IconButton, Input, Menu, PageHeader, SegmentedControl, Skeleton } from '../../ui'
import { cx } from '../../ui/utils'
import { backgroundCss } from './backgrounds/boardBackground'
import BoardTile from './BoardTile'
import '../../app/shell/app-shell.css'
import { shortcutKey } from '../../lib/shortcutKey'

const VISIBILITY_ICONS = { private: Lock, workspace: Users, public: Globe }
const SORTS = ['active', 'opened', 'name', 'newest']
const SORT_KEY = 'kh:boards-sort'

const readSort = () => {
	try {
		const value = localStorage.getItem(SORT_KEY)
		return SORTS.includes(value) ? value : 'active'
	} catch {
		return 'active'
	}
}

const BoardCard = ({ board, stats, isStarred, onToggleStar, onOpen }) => {
	const { t, language } = useI18n()
	const VisibilityIcon = VISIBILITY_ICONS[board.visibility] || Lock
	const lastActive = stats?.lastActivityAt || board.updatedAt
	const detailsId = `board-card-details-${board._id}`
	// The whole card opens the board; the star sits beside it as its own button.
	return (
		<article className={cx('board-card', board.background && 'has-cover')}>
			<button type='button' className='board-card__open' onClick={() => onOpen(board)} aria-label={t('boards.open', { name: board.name })} aria-describedby={detailsId} data-i18n-ignore>
				{board.background && <span className='board-card__cover' style={{ background: backgroundCss(board.background, { thumb: true }) }} aria-hidden='true' />}
				<span className='board-card__head'>
					<BoardTile board={board} size={36} plain />
					<span className='board-card__name'>{board.name}</span>
				</span>
				<span id={detailsId} className='board-card__details'>
					<span className='board-card__meta'>
						<span className='board-card__visibility'><VisibilityIcon size={14} aria-hidden='true' />{t(`boards.visibility.${board.visibility || 'private'}`)}</span>
						{board.access === 'invited' && <span>{t('boards.shared')}</span>}
						{board.access === 'invited' && <span>{t(`boards.role.${board.role || 'member'}`)}</span>}
					</span>
					<span className='board-card__stats'>
						{!stats ? (
							<Skeleton width='60%' height={14} />
						) : stats.taskCount ? (
							<>
								<span>{t('boards.tasks', { count: stats.taskCount })}</span>
								{stats.myTaskCount > 0 && <span>{t('boards.mine', { count: stats.myTaskCount })}</span>}
								{stats.overdueCount > 0 && <Badge tone='danger'>{t('boards.overdue', { count: stats.overdueCount })}</Badge>}
							</>
						) : (
							<span>{t('boards.noTasks')}</span>
						)}
					</span>
				</span>
				<span className='board-card__footer'>
					{stats?.members?.length ? (
						<AvatarGroup people={stats.members} max={3} size={24} label={t('boards.members', { count: stats.memberCount })} />
					) : <span />}
					{lastActive && <span className='board-card__time'>{t('boards.active', { time: relativeTime(lastActive, language, t('boards.justNow')) })}</span>}
				</span>
			</button>
			<IconButton
				className={cx('board-card__star', isStarred && 'is-starred')}
				icon={Star}
				size='sm'
				label={t(isStarred ? 'boards.unstar' : 'boards.star', { name: board.name })}
				aria-pressed={isStarred}
				onClick={() => onToggleStar(board._id)}
			/>
		</article>
	)
}

const BoardCardSkeleton = () => (
	<div className='board-card is-loading' aria-hidden='true'>
		<div className='board-card__head'><Skeleton width={36} height={36} radius={10} /><Skeleton width='55%' height={18} /></div>
		<Skeleton width='40%' height={12} />
		<Skeleton width='60%' height={14} />
		<div className='board-card__footer'><Skeleton width={64} height={24} radius={999} /><Skeleton width={90} height={12} /></div>
	</div>
)

/** The board list: find, filter and open boards, with live numbers for each. */
const BoardsOverview = ({ boards, isLoading = false, onOpenBoard, onCreateBoard, onImport }) => {
	const { t } = useI18n()
	const userId = useAuthStore((state) => state.authUser?._id)
	const { starred, recent, toggleStar, load: loadPrefs } = useBoardPrefs()
	const { byBoard, load: loadStats } = useBoardStats()
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState('all')
	const [sort, setSort] = useState(readSort)
	const searchRef = useRef(null)

	useEffect(() => {
		loadPrefs(userId)
	}, [loadPrefs, userId])

	// Fresh numbers whenever the list is shown; the store skips repeats within a few seconds.
	useEffect(() => {
		if (userId && !isLoading) loadStats({ force: true })
	}, [userId, isLoading, boards.length, loadStats])

	// "/" jumps to the search field, as in most list views.
	useEffect(() => {
		const handleKeyDown = (event) => {
			const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')
			if (shortcutKey(event) === '/' && !typing && !document.body.classList.contains('has-modal')) {
				event.preventDefault()
				searchRef.current?.focus()
			}
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [])

	const chooseSort = (value) => {
		setSort(value)
		try {
			localStorage.setItem(SORT_KEY, value)
		} catch {
			// Sorting still applies for this visit.
		}
	}

	const sharedCount = boards.filter((board) => board.access === 'invited').length
	const mineCount = boards.length - sharedCount
	const overdueTotal = Object.values(byBoard).reduce((sum, entry) => sum + (entry.overdueCount || 0), 0)

	const visibleBoards = useMemo(() => {
		const needle = query.trim().toLocaleLowerCase()
		const openedAt = new Map(recent.map((entry) => [entry.id, entry.at]))
		const activity = (board) => new Date(byBoard[board._id]?.lastActivityAt || board.updatedAt || 0).getTime()
		const compare = {
			active: (left, right) => activity(right) - activity(left),
			opened: (left, right) => (openedAt.get(right._id) || 0) - (openedAt.get(left._id) || 0) || activity(right) - activity(left),
			name: (left, right) => left.name.localeCompare(right.name),
			newest: (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
		}[sort]
		return boards
			.filter((board) => filter === 'all' || (filter === 'shared' ? board.access === 'invited' : board.access !== 'invited'))
			.filter((board) => !needle || board.name.toLocaleLowerCase().includes(needle))
			.sort(compare)
	}, [boards, byBoard, filter, query, recent, sort])
	const starredBoards = visibleBoards.filter((board) => starred.includes(board._id))

	const description = isLoading
		? t('boards.loading')
		: [t('boards.summary', { count: boards.length }), overdueTotal > 0 && t('boards.summaryOverdue', { count: overdueTotal })].filter(Boolean).join(' · ')

	const renderGrid = (items) => (
		<div className='board-grid'>
			{items.map((board) => (
				<BoardCard
					key={board._id}
					board={board}
					stats={byBoard[board._id]}
					isStarred={starred.includes(board._id)}
					onToggleStar={toggleStar}
					onOpen={onOpenBoard}
				/>
			))}
		</div>
	)

	let body
	if (isLoading) {
		body = <div className='board-grid' role='status' aria-label={t('boards.loading')}>{[0, 1, 2].map((index) => <BoardCardSkeleton key={index} />)}</div>
	} else if (!boards.length) {
		body = (
			<EmptyState
				icon={FolderKanban}
				title={t('boards.emptyTitle')}
				description={t('boards.emptyText')}
				action={
					<div className='boards-empty-actions'>
						<Button icon={Plus} onClick={onCreateBoard}>{t('boards.newBoard')}</Button>
						{onImport && <Button variant='secondary' icon={Upload} onClick={onImport}>{t('import.open')}</Button>}
					</div>
				}
			/>
		)
	} else if (!visibleBoards.length) {
		body = query.trim() ? (
			<EmptyState
				icon={SearchX}
				title={t('boards.noMatchTitle', { query: query.trim() })}
				action={<Button variant='secondary' onClick={() => setQuery('')}>{t('boards.clearSearch')}</Button>}
			/>
		) : (
			<EmptyState icon={Users} title={t('boards.noSharedTitle')} description={t('boards.noSharedText')} />
		)
	} else {
		body = (
			<>
				{starredBoards.length > 0 && (
					<section className='board-section' aria-labelledby='boards-starred'>
						<h2 className='board-section__title' id='boards-starred'>{t('boards.starredSection')}</h2>
						{renderGrid(starredBoards)}
					</section>
				)}
				<section className='board-section' aria-labelledby='boards-all'>
					{starredBoards.length > 0 && <h2 className='board-section__title' id='boards-all'>{t('boards.allSection')}</h2>}
					{starredBoards.length === 0 && <h2 className='ui-visually-hidden' id='boards-all'>{t('boards.allSection')}</h2>}
					{renderGrid(visibleBoards)}
				</section>
			</>
		)
	}

	return (
		<div className='app-page boards-page'>
			<PageHeader
				title={t('boards.title')}
				description={description}
				actions={
					<>
						{onImport && <Button variant='secondary' icon={Upload} onClick={onImport}>{t('import.open')}</Button>}
						<Button className='boards-page__new' icon={Plus} onClick={onCreateBoard}>{t('boards.newBoard')}</Button>
					</>
				}
			/>
			{!isLoading && boards.length > 0 && (
				<div className='boards-toolbar'>
					<div className='boards-toolbar__search'>
						<Input
						ref={searchRef}
						icon={Search}
						type='search'
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t('boards.searchPlaceholder')}
						aria-label={t('boards.searchLabel')}
						aria-keyshortcuts='/'
						/>
					</div>
					<div className='boards-toolbar__controls'>
						{sharedCount > 0 && (
							<SegmentedControl
								label={t('boards.filterLabel')}
								value={filter}
								onChange={setFilter}
								options={[
									{ value: 'all', label: <>{t('boards.filterAll')}<span className='ui-segmented__count'>{boards.length}</span></> },
									{ value: 'mine', label: <>{t('boards.filterMine')}<span className='ui-segmented__count'>{mineCount}</span></> },
									{ value: 'shared', label: <>{t('boards.filterShared')}<span className='ui-segmented__count'>{sharedCount}</span></> },
								]}
							/>
						)}
						<Menu
							label={t('boards.sortLabel')}
							trigger={(props) => (
								<Button variant='secondary' icon={ArrowUpDown} {...props}>
									<span className='boards-toolbar__sort-label'>{t(`boards.sort${sort[0].toUpperCase()}${sort.slice(1)}`)}</span>
								</Button>
							)}
							items={SORTS.map((value) => ({
								label: t(`boards.sort${value[0].toUpperCase()}${value.slice(1)}`),
								icon: value === sort ? Check : undefined,
								checked: value === sort,
								onSelect: () => chooseSort(value),
							}))}
						/>
					</div>
				</div>
			)}
			{body}
		</div>
	)
}

export default BoardsOverview
