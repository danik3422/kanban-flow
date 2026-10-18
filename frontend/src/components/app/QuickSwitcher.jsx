import { Bell, CalendarDays, CircleUser, ClipboardList, LayoutGrid, Search, Settings, ShieldCheck, SlidersHorizontal, UserCog, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { fetchBoardsWithCache, getCachedBoards } from '../../lib/boardsCache'
import { useAuthStore } from '../../store/useAuthStore'
import { useBoardPrefs } from '../../store/useBoardPrefs'
import { Input, Modal } from '../../ui'
import { cx } from '../../ui/utils'
import BoardTile from './BoardTile'

// Bold the part of a name that matches what was typed.
const highlight = (label, query) => {
	const needle = query.trim()
	const index = needle ? label.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase()) : -1
	if (index < 0) return label
	return (
		<>
			{label.slice(0, index)}
			<mark className='quick-switcher__match'>{label.slice(index, index + needle.length)}</mark>
			{label.slice(index + needle.length)}
		</>
	)
}

const PAGES = [
	{ key: 'boards', to: '/workspaces', icon: LayoutGrid },
	{ key: 'myTasks', to: '/my-tasks', icon: ClipboardList },
	{ key: 'calendar', to: '/calendar', icon: CalendarDays },
	{ key: 'team', to: '/team', icon: Users },
	{ key: 'profile', to: '/profile', icon: CircleUser },
	{ key: 'settings', to: '/settings', icon: Settings },
]

// Settings sections show up once you type, found by their name or a related word.
const SETTINGS = [
	{ key: 'account', icon: UserCog, words: ['account', 'email', 'logout'] },
	{ key: 'preferences', icon: SlidersHorizontal, words: ['theme', 'language', 'start page', 'week', 'dark'] },
	{ key: 'notifications', icon: Bell, words: ['notifications', 'email', 'push'] },
	{ key: 'security', icon: ShieldCheck, words: ['security', 'password', 'sessions', 'devices'] },
]

/** Jump to any board or page from the keyboard (Ctrl/⌘+K) or the search button. */
const QuickSwitcher = ({ open, onClose }) => {
	const { t } = useI18n()
	const navigate = useNavigate()
	const userId = useAuthStore((state) => state.authUser?._id)
	const recent = useBoardPrefs((state) => state.recent)
	const [boards, setBoards] = useState(() => getCachedBoards(userId) || [])
	const [query, setQuery] = useState('')
	const [activeIndex, setActiveIndex] = useState(0)
	const inputRef = useRef(null)
	const listRef = useRef(null)

	useEffect(() => {
		if (!open) return undefined
		let ignore = false
		fetchBoardsWithCache(userId).then((data) => {
			if (!ignore && Array.isArray(data)) setBoards(data)
		}).catch(() => {})
		return () => {
			ignore = true
		}
	}, [open, userId])

	const results = useMemo(() => {
		const needle = query.trim().toLocaleLowerCase()
		const openedAt = new Map(recent.map((entry) => [entry.id, entry.at]))
		const boardResults = boards
			.filter((board) => !needle || board.name.toLocaleLowerCase().includes(needle))
			.sort((left, right) => (openedAt.get(right._id) || 0) - (openedAt.get(left._id) || 0))
			.slice(0, 8)
			.map((board) => ({ id: board._id, kind: 'board', label: board.name, board, to: `/workspaces/${board._id}` }))
		const pageResults = PAGES
			.map((page) => ({ id: page.key, kind: 'page', label: t(`app.nav.${page.key}`), icon: page.icon, to: page.to }))
			.filter((page) => !needle || page.label.toLocaleLowerCase().includes(needle))
		const settingsResults = needle ? SETTINGS
			.map((item) => ({
				id: item.key,
				kind: 'setting',
				label: t(`settings.sections.${item.key}`),
				icon: item.icon,
				to: `/settings#${item.key}`,
				words: [...item.words, ...t(`app.search.settingsWords.${item.key}`).split(',')].map((word) => word.trim().toLocaleLowerCase()),
			}))
			.filter((item) => item.label.toLocaleLowerCase().includes(needle) || item.words.some((word) => word && (word.includes(needle) || needle.includes(word)))) : []
		return [...boardResults, ...pageResults, ...settingsResults]
	}, [boards, query, recent, t])

	const close = () => {
		setQuery('')
		setActiveIndex(0)
		onClose()
	}

	const choose = (result) => {
		if (!result) return
		close()
		// Commit the new page in the same frame as the URL, so the previous board never shows under it.
		navigate(result.to, { flushSync: true })
	}

	const handleKeyDown = (event) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			const step = event.key === 'ArrowDown' ? 1 : -1
			const next = (activeIndex + step + results.length) % Math.max(results.length, 1)
			setActiveIndex(next)
			listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
		} else if (event.key === 'Enter') {
			event.preventDefault()
			choose(results[activeIndex])
		}
	}

	const boardsCount = results.filter((result) => result.kind === 'board').length
	const pagesCount = results.filter((result) => result.kind === 'page').length
	const activeId = results[activeIndex] ? `switcher-option-${results[activeIndex].kind}-${results[activeIndex].id}` : undefined

	return (
		<Modal open={open} onClose={close} title={t('app.search.label')} size='sm' initialFocusRef={inputRef} className='quick-switcher'>
			<Input
				ref={inputRef}
				icon={Search}
				value={query}
				onChange={(event) => {
					setQuery(event.target.value)
					setActiveIndex(0)
				}}
				onKeyDown={handleKeyDown}
				placeholder={t('app.search.placeholder')}
				aria-label={t('app.search.placeholder')}
				role='combobox'
				aria-expanded='true'
				aria-controls='quick-switcher-list'
				aria-activedescendant={activeId}
				autoComplete='off'
			/>
			{results.length ? (
				<div className='quick-switcher__list' id='quick-switcher-list' role='listbox' ref={listRef} aria-label={t('app.search.label')}>
					{[
						{ key: 'boards', items: results.slice(0, boardsCount), offset: 0 },
						{ key: 'pages', items: results.slice(boardsCount, boardsCount + pagesCount), offset: boardsCount },
						{ key: 'settings', items: results.slice(boardsCount + pagesCount), offset: boardsCount + pagesCount },
					].filter((group) => group.items.length).map((group) => (
						<div key={group.key} role='group' aria-labelledby={`quick-switcher-${group.key}`}>
							<p className='quick-switcher__group' id={`quick-switcher-${group.key}`}>{t(`app.search.${group.key}`)}</p>
							{group.items.map((result, position) => {
								const index = group.offset + position
								return (
									<button
										key={`${result.kind}-${result.id}`}
										type='button'
										id={`switcher-option-${result.kind}-${result.id}`}
										data-index={index}
										role='option'
										aria-selected={index === activeIndex}
										className={cx('quick-switcher__option', index === activeIndex && 'is-active')}
										onMouseMove={() => setActiveIndex(index)}
										onClick={() => choose(result)}
										tabIndex={-1}
									>
										{result.kind === 'board' ? <BoardTile board={result.board} size={24} /> : <span className='quick-switcher__page-icon'><result.icon size={16} aria-hidden='true' /></span>}
										<span className='quick-switcher__label'>{highlight(result.label, query)}</span>
									</button>
								)
							})}
						</div>
					))}
				</div>
			) : (
				<p className='quick-switcher__empty'>{t('app.search.empty', { query: query.trim() })}</p>
			)}
			<p className='quick-switcher__hint' aria-hidden='true'>{t('app.search.hint')}</p>
		</Modal>
	)
}

export default QuickSwitcher
