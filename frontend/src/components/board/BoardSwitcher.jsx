import { LayoutGrid, List, Plus, Search, SearchX, Star } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { useBoardPrefs } from '../../store/useBoardPrefs'
import { EmptyState, IconButton, Input, Modal, SegmentedControl } from '../../ui'
import { cx } from '../../ui/utils'
import { backgroundCss } from '../../utils/boardBackground'
import { boardToneFor } from '../../utils/boardTone'
import './board-dock.css'

const VIEW_KEY = 'kh:switcher-view'
const MAX_RECENT = 8

const readView = () => {
	try {
		return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
	} catch {
		return 'grid'
	}
}

// A board's cover: its background, or a soft gradient in its own tone.
const coverOf = (board) => (board.background
	? backgroundCss(board.background, { thumb: true })
	: `linear-gradient(135deg, var(--ui-${boardToneFor(board._id)}-soft) 0%, color-mix(in srgb, var(--ui-${boardToneFor(board._id)}-soft-text) 55%, var(--ui-${boardToneFor(board._id)}-soft)) 100%)`)

/** Move focus between tiles with the arrow keys, row by row like the grid looks. */
const moveFocus = (event, container) => {
	const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
	if (!keys.includes(event.key) || !container) return
	const tiles = [...container.querySelectorAll('.bs-tile__open')]
	const index = tiles.indexOf(document.activeElement)
	if (index < 0) return
	event.preventDefault()
	const top = tiles[index].getBoundingClientRect().top
	const perRow = Math.max(1, tiles.filter((tile) => Math.abs(tile.getBoundingClientRect().top - top) < 4).length)
	const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -perRow, ArrowDown: perRow }[event.key]
	tiles[Math.max(0, Math.min(tiles.length - 1, index + step))]?.focus()
}

const BoardTileButton = ({ board, isCurrent, isStarred, onOpen, onToggleStar, view }) => {
	const { t } = useI18n()
	return (
		<li className={cx('bs-tile', view === 'list' && 'bs-tile--row', isCurrent && 'is-current')}>
			<button type='button' className='bs-tile__open' onClick={() => onOpen(board)} aria-current={isCurrent ? 'page' : undefined}>
				<span className='bs-tile__cover' style={{ background: coverOf(board) }} aria-hidden='true' />
				<span className='bs-tile__name' data-i18n-ignore><span>{board.name}</span></span>
				{isCurrent && <span className='bs-tile__current'>{t('boardSwitcher.current')}</span>}
			</button>
			<IconButton
				className={cx('bs-tile__star', isStarred && 'is-starred')}
				icon={Star}
				size='sm'
				label={t(isStarred ? 'boards.unstar' : 'boards.star', { name: board.name })}
				aria-pressed={isStarred}
				onClick={() => onToggleStar(board._id)}
			/>
		</li>
	)
}

/**
 * Jump to another board: search, filter mine/shared, starred and recent first,
 * a grid of covers or a compact list, arrow keys to move and Enter to open.
 */
const BoardSwitcher = ({ open, onClose, boards, currentBoardId, onOpenBoard, onCreateBoard }) => {
	const { t } = useI18n()
	const { starred, recent, toggleStar } = useBoardPrefs()
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState('all')
	const [view, setView] = useState(readView)
	const bodyRef = useRef(null)
	const searchRef = useRef(null)
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) {
			setQuery('')
			setFilter('all')
		}
	}

	const changeView = (next) => {
		setView(next)
		try {
			localStorage.setItem(VIEW_KEY, next)
		} catch {
			// The choice lasts for this visit.
		}
	}

	const mine = boards.filter((board) => board.access !== 'invited')
	const shared = boards.filter((board) => board.access === 'invited')
	const scoped = filter === 'mine' ? mine : filter === 'shared' ? shared : boards
	const needle = query.trim().toLowerCase()
	const matches = needle ? scoped.filter((board) => board.name.toLowerCase().includes(needle)) : scoped
	const byId = useMemo(() => new Map(boards.map((board) => [board._id, board])), [boards])
	const starredBoards = starred.map((id) => byId.get(id)).filter((board) => board && matches.includes(board))
	const recentBoards = recent.map((entry) => byId.get(entry.id)).filter((board) => board && matches.includes(board) && !starred.includes(board._id)).slice(0, MAX_RECENT)
	const allBoards = [...matches].sort((a, b) => a.name.localeCompare(b.name))

	const open_ = (board) => {
		onClose()
		if (board._id !== currentBoardId) onOpenBoard(board)
	}
	const section = (key, title, items, withCreate = false) => (items.length > 0 || withCreate) && (
		<section key={key} className='bs-section' aria-label={title}>
			<h3 className='bs-section__title'>{title}</h3>
			<ul className={cx('bs-grid', view === 'list' && 'bs-grid--list')}>
				{items.map((board) => (
					<BoardTileButton key={board._id} board={board} view={view} isCurrent={board._id === currentBoardId} isStarred={starred.includes(board._id)} onOpen={open_} onToggleStar={toggleStar} />
				))}
				{withCreate && (
					<li className={cx('bs-tile bs-tile--create', view === 'list' && 'bs-tile--row')}>
						<button type='button' className='bs-tile__open' onClick={() => { onClose(); onCreateBoard() }}>
							<span className='bs-tile__cover bs-tile__cover--create' aria-hidden='true'><Plus size={20} /></span>
							<span className='bs-tile__name'><span>{t('boardSwitcher.create')}</span></span>
						</button>
					</li>
				)}
			</ul>
		</section>
	)

	return (
		<Modal open={open} onClose={onClose} title={t('boardSwitcher.title')} size='lg' className='bs-modal' initialFocusRef={searchRef}>
			<div className='bs' ref={bodyRef} onKeyDown={(event) => moveFocus(event, bodyRef.current)}>
				<div className='bs-toolbar'>
					<div className='bs-search'>
						<Input
							ref={searchRef}
							icon={Search}
							type='search'
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t('boardSwitcher.search')}
							aria-label={t('boardSwitcher.search')}
							onKeyDown={(event) => {
								if (event.key === 'ArrowDown') {
									event.preventDefault()
									bodyRef.current?.querySelector('.bs-tile__open')?.focus()
								} else if (event.key === 'Enter' && matches.length) {
									event.preventDefault()
									open_(starredBoards[0] || recentBoards[0] || allBoards[0])
								}
							}}
						/>
					</div>
					<IconButton icon={view === 'grid' ? List : LayoutGrid} variant='secondary' label={view === 'grid' ? t('boardSwitcher.asList') : t('boardSwitcher.asGrid')} onClick={() => changeView(view === 'grid' ? 'list' : 'grid')} />
				</div>
				{shared.length > 0 && (
					<SegmentedControl
						label={t('boards.filterLabel')}
						value={filter}
						onChange={setFilter}
						options={[
							{ value: 'all', label: <>{t('boards.filterAll')}<span className='ui-segmented__count'>{boards.length}</span></> },
							{ value: 'mine', label: <>{t('boards.filterMine')}<span className='ui-segmented__count'>{mine.length}</span></> },
							{ value: 'shared', label: <>{t('boards.filterShared')}<span className='ui-segmented__count'>{shared.length}</span></> },
						]}
					/>
				)}
				{matches.length === 0 ? (
					<EmptyState icon={SearchX} title={t('boardSwitcher.empty')} description={t('boardSwitcher.emptyText')} />
				) : needle ? (
					section('results', t('boardSwitcher.results'), allBoards)
				) : (
					<>
						{section('starred', t('boardSwitcher.starred'), starredBoards)}
						{section('recent', t('boardSwitcher.recent'), recentBoards)}
						{section('all', t('boardSwitcher.all'), allBoards, filter !== 'shared')}
					</>
				)}
			</div>
		</Modal>
	)
}

export default BoardSwitcher
