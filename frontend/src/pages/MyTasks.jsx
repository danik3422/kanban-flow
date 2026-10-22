import { ChevronDown, ClipboardList, Flag, KanbanSquare, PartyPopper, RotateCcw, Search, SearchX, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MyTaskRow from '../features/my-tasks/MyTaskRow'
import '../features/my-tasks/my-tasks.css'
import AppSidebar from '../app/shell/AppSidebar'
import AppTopbar from '../app/shell/AppTopbar'
import useTaskActions from '../features/my-tasks/useTaskActions'
import useWorkspaceNavigation from '../app/shell/useWorkspaceNavigation'
import { useI18n } from '../i18n'
import { translateServerMessageCurrent } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import { useAuthStore } from '../store/useAuthStore'
import { Button, Chip, EmptyState, IconButton, Input, Menu, Modal, PageHeader, SegmentedControl, Select, Skeleton } from '../ui'
import { cx } from '../ui/utils'
import { addDaysToKey, getDueDateKey, getLocalDateKey } from '../lib/dueDate'
import { peekCache } from '../lib/apiCache'
import { shortcutKey } from '../lib/shortcutKey'

const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 }
const DATE_SECTIONS = ['overdue', 'today', 'tomorrow', 'week', 'later', 'noDate']
const FOCUS_SECTIONS = { open: DATE_SECTIONS, overdue: ['overdue'], week: ['today', 'tomorrow', 'week'] }
const GROUP_KEY = 'kh:my-tasks-group'
const SHOW_DONE_KEY = 'kh:my-tasks-show-done'

const readSetting = (key, allowed, fallback) => {
	try {
		const value = localStorage.getItem(key)
		return allowed.includes(value) ? value : fallback
	} catch {
		return fallback
	}
}
const saveSetting = (key, value) => {
	try {
		localStorage.setItem(key, value)
	} catch {
		// The choice still applies for this visit.
	}
}

// One rule across the app: a task is done when it sits in its board's last column.
const isDone = (task) => Boolean(task.isDone)

const dateSection = (task, todayKey) => {
	const dueKey = getDueDateKey(task.dueDate)
	if (!dueKey) return 'noDate'
	if (dueKey < todayKey) return 'overdue'
	if (dueKey === todayKey) return 'today'
	if (dueKey === addDaysToKey(todayKey, 1)) return 'tomorrow'
	if (dueKey <= addDaysToKey(todayKey, 7)) return 'week'
	return 'later'
}

const byDueThenPriority = (left, right) => {
	const leftKey = getDueDateKey(left.dueDate) || '9999'
	const rightKey = getDueDateKey(right.dueDate) || '9999'
	return leftKey.localeCompare(rightKey)
		|| (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0)
		|| left.title.localeCompare(right.title)
}

const RowSkeleton = () => (
	<li className='mt-row is-loading' aria-hidden='true'>
		<span className='mt-row__check'><Skeleton width={20} height={20} radius={6} /></span>
		<span className='mt-row__main'><Skeleton width='45%' height={15} /><Skeleton width='70%' height={12} /></span>
	</li>
)

const MyTasks = () => {
	const { t } = useI18n()
	const authUser = useAuthStore((state) => state.authUser)
	const navigate = useNavigate()
	const [boards, setBoards] = useState([])
	// Saved on this device: the list shows at once and refreshes behind it.
	const [tasks, setTasks] = useState(() => peekCache('/board/my-tasks', { search: '', priority: 'all', board: 'all' }) || [])
	const [search, setSearch] = useState('')
	const [priority, setPriority] = useState('all')
	const [board, setBoard] = useState('all')
	const [focus, setFocus] = useState('open')
	const [groupBy, setGroupBy] = useState(() => readSetting(GROUP_KEY, ['date', 'board'], 'date'))
	const [showDone, setShowDone] = useState(() => readSetting(SHOW_DONE_KEY, ['true', 'false'], 'false') === 'true')
	const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(() => !peekCache('/board/my-tasks', { search: '', priority: 'all', board: 'all' }))
	const [loadError, setLoadError] = useState('')
	const [reloadKey, setReloadKey] = useState(0)
	const searchRef = useRef(null)
	const { isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, setIsSidebarCollapsed } = useWorkspaceNavigation()

	useEffect(() => {
		fetchBoardsWithCache(authUser?._id)
			.then((nextBoards) => setBoards(nextBoards))
			.catch(() => setBoards([]))
	}, [authUser?._id])

	useEffect(() => {
		let isCurrent = true
		const requestTimer = window.setTimeout(() => {
			axiosInstance
				.get('/board/my-tasks', { params: { search, priority, board } })
				.then(({ data }) => {
					if (!isCurrent) return
					setTasks(Array.isArray(data) ? data : [])
					setLoadError('')
				})
				.catch((error) => {
					if (!isCurrent) return
					if ([404, 204].includes(error.response?.status)) setTasks([])
					else setLoadError(translateServerMessageCurrent(error.response?.data?.message, 'myTasks.loadError'))
				})
				.finally(() => {
					if (isCurrent) setIsLoading(false)
				})
		}, 220)
		return () => {
			isCurrent = false
			window.clearTimeout(requestTimer)
		}
	}, [search, priority, board, reloadKey])

	// "/" jumps to the search field.
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

	const changeFilter = (setter) => (value) => {
		setIsLoading(true)
		setter(value)
	}
	const hasFilters = Boolean(search || priority !== 'all' || board !== 'all')
	const clearFilters = () => {
		setIsLoading(true)
		setSearch('')
		setPriority('all')
		setBoard('all')
	}

	const { toggleDone, setDueDate: changeDueDate, setPriority: changePriority, canToggle, toggleHint, openTask, openBoard } = useTaskActions({
		setTasks,
		onChanged: () => setReloadKey((key) => key + 1),
	})

	const todayKey = getLocalDateKey()
	const openTasks = useMemo(() => tasks.filter((task) => !isDone(task)), [tasks])
	const doneTasks = useMemo(() => tasks.filter(isDone).sort(byDueThenPriority), [tasks])
	const counts = {
		open: openTasks.length,
		overdue: openTasks.filter((task) => dateSection(task, todayKey) === 'overdue').length,
		week: openTasks.filter((task) => ['today', 'tomorrow', 'week'].includes(dateSection(task, todayKey))).length,
		done: doneTasks.length,
	}

	const focusedOpenTasks = focus === 'done' ? [] : openTasks.filter((task) => FOCUS_SECTIONS[focus].includes(dateSection(task, todayKey)))
	const sections = groupBy === 'date'
		? DATE_SECTIONS
			.map((key) => ({ key, title: t(`myTasks.sections.${key}`), tone: key === 'overdue' ? 'danger' : undefined, tasks: focusedOpenTasks.filter((task) => dateSection(task, todayKey) === key).sort(byDueThenPriority) }))
			.filter((section) => section.tasks.length)
		: [...new Map(focusedOpenTasks.map((task) => [task.column?.board?._id || 'none', task.column?.board])).entries()]
			.map(([key, boardInfo]) => ({ key, title: boardInfo?.name || '', boardId: boardInfo?._id, tasks: focusedOpenTasks.filter((task) => (task.column?.board?._id || 'none') === key).sort(byDueThenPriority) }))
			.sort((left, right) => left.title.localeCompare(right.title))

	const renderRows = (items, { showBoard = groupBy === 'date' } = {}) => (
		<ul className='mt-list'>
			{items.map((task) => {
				const done = isDone(task)
				return (
					<MyTaskRow
						key={task._id}
						task={task}
						done={done}
						showBoard={showBoard}
						canToggle={canToggle(task)}
						toggleHint={toggleHint(task)}
						userId={authUser?._id}
						onToggle={toggleDone}
						onOpen={openTask}
						onOpenBoard={openBoard}
						onDueChange={changeDueDate}
						onPriorityChange={changePriority}
					/>
				)
			})}
		</ul>
	)

	const emptyForFocus = {
		open: { icon: PartyPopper, title: t('myTasks.openEmpty') },
		overdue: { icon: PartyPopper, title: t('myTasks.overdueEmpty') },
		week: { icon: ClipboardList, title: t('myTasks.weekEmpty') },
		done: { icon: ClipboardList, title: t('myTasks.doneEmpty') },
	}[focus]

	let body
	if (isLoading) {
		body = <ul className='mt-list mt-card' role='status' aria-label={t('myTasks.loading')}>{[0, 1, 2, 3].map((index) => <RowSkeleton key={index} />)}</ul>
	} else if (loadError) {
		body = <EmptyState icon={RotateCcw} tone='danger' title={loadError} action={<Button variant='secondary' icon={RotateCcw} onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>{t('common.retry')}</Button>} />
	} else if (!tasks.length) {
		body = hasFilters ? (
			<EmptyState icon={SearchX} title={t('myTasks.noMatchTitle')} action={<Button variant='secondary' onClick={clearFilters}>{t('myTasks.reset')}</Button>} />
		) : (
			<EmptyState icon={ClipboardList} title={t('myTasks.emptyTitle')} description={t('myTasks.emptyText')} action={<Button as={Link} to='/workspaces' variant='secondary'>{t('myTasks.goBoards')}</Button>} />
		)
	} else {
		body = (
			<>
				{focus === 'done' ? (
					doneTasks.length ? (
						<section className='mt-section'>
							<h2 className='mt-section__title'>{t('myTasks.sections.done')} <span>{doneTasks.length}</span></h2>
							<div className='mt-card'>{renderRows(doneTasks, { showBoard: true })}</div>
						</section>
					) : <EmptyState icon={emptyForFocus.icon} title={emptyForFocus.title} />
				) : sections.length ? (
					sections.map((section) => (
						<section key={section.key} className={cx('mt-section', section.tone && `mt-section--${section.tone}`)} aria-labelledby={`mt-section-${section.key}`}>
							<h2 className='mt-section__title' id={`mt-section-${section.key}`}>
								<span data-i18n-ignore={groupBy === 'board' || undefined}>{section.title}</span> <span className='mt-section__count'>{section.tasks.length}</span>
								{section.boardId && (
									<Button as={Link} to={`/workspaces/${section.boardId}`} variant='ghost' size='sm' className='mt-section__link'>{t('myTasks.openBoard')}</Button>
								)}
							</h2>
							<div className='mt-card'>{renderRows(section.tasks)}</div>
						</section>
					))
				) : (
					<EmptyState icon={emptyForFocus.icon} title={emptyForFocus.title} />
				)}
				{focus !== 'done' && doneTasks.length > 0 && (
					<section className='mt-section mt-section--done'>
						<button
							type='button'
							className='mt-done-toggle'
							aria-expanded={showDone}
							onClick={() => {
								setShowDone((value) => !value)
								saveSetting(SHOW_DONE_KEY, String(!showDone))
							}}
						>
							<ChevronDown size={16} aria-hidden='true' className={cx('mt-done-toggle__icon', showDone && 'is-open')} />
							{showDone ? t('myTasks.hideDone') : t('myTasks.showDone', { count: doneTasks.length })}
						</button>
						{showDone && <div className='mt-card'>{renderRows(doneTasks, { showBoard: true })}</div>}
					</section>
				)}
			</>
		)
	}

	const priorityOptions = [{ value: 'all', label: t('myTasks.allPriorities') }, ...['urgent', 'high', 'medium', 'low', 'none'].map((value) => ({ value, label: t(`myTasks.priority.${value}`) }))]
	const boardOptions = [{ value: 'all', label: t('myTasks.allBoards') }, ...boards.map((item) => ({ value: item._id, label: item.name }))]
	const sheetFiltersActive = priority !== 'all' || board !== 'all'
	const description = isLoading ? t('myTasks.loading') : [t('myTasks.open', { count: counts.open }), counts.overdue > 0 && t('boards.summaryOverdue', { count: counts.overdue })].filter(Boolean).join(' · ')

	return (
		<div className='workspace-shell'>
			<AppSidebar
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
				boards={boards}
				selectedBoardId={null}
				onBoardSelect={(item) => navigate(`/workspaces/${item._id}`)}
				onCreateBoard={() => navigate('/workspaces', { state: { createBoard: true } })}
				isCollapsed={isSidebarCollapsed}
			/>
			<main className='workspace-main'>
				<AppTopbar isSidebarCollapsed={isSidebarCollapsed} onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}>
					<span className='app-topbar__title'>{t('myTasks.title')}</span>
				</AppTopbar>
				<div className='app-page mt-page'>
					<PageHeader title={t('myTasks.title')} description={description} />
					<div className='mt-toolbar'>
						<div className='mt-toolbar__search'>
							<Input
								ref={searchRef}
								icon={Search}
								type='search'
								value={search}
								onChange={(event) => changeFilter(setSearch)(event.target.value)}
								placeholder={t('myTasks.searchPlaceholder')}
								aria-label={t('myTasks.searchLabel')}
								aria-keyshortcuts='/'
							/>
						</div>
						{/* Desktop: priority and board live in one Filters menu. */}
						<div className='mt-toolbar__selects'>
							<Menu
								align='start'
								label={t('myTasks.filters')}
								trigger={(props) => (
									<Button {...props} variant='secondary' icon={SlidersHorizontal} className={cx('mt-toolbar__filter', sheetFiltersActive && 'is-active')}>
										{t('myTasks.filters')}
										{sheetFiltersActive && <span className='mt-toolbar__filter-count'>{Number(priority !== 'all') + Number(board !== 'all')}</span>}
									</Button>
								)}
								items={[
									{
										group: {
											id: 'priority',
											label: t('myTasks.priorityLabel'),
											icon: Flag,
											value: priorityOptions.find((option) => option.value === priority)?.label,
											items: priorityOptions.map((option) => ({ label: option.label, checked: option.value === priority, mark: 'end', onSelect: () => changeFilter(setPriority)(option.value) })),
										},
									},
									{
										group: {
											id: 'board',
											label: t('myTasks.boardLabel'),
											icon: KanbanSquare,
											value: boardOptions.find((option) => option.value === board)?.label,
											items: boardOptions.map((option) => ({ label: option.label, checked: option.value === board, mark: 'end', onSelect: () => changeFilter(setBoard)(option.value) })),
										},
									},
									sheetFiltersActive && { separator: true },
									sheetFiltersActive && { label: t('myTasks.reset'), icon: RotateCcw, onSelect: () => { changeFilter(setPriority)('all'); changeFilter(setBoard)('all') } },
								]}
							/>
							{hasFilters && <IconButton icon={RotateCcw} label={t('myTasks.reset')} onClick={clearFilters} />}
						</div>
						<span className='mt-toolbar__sheet-trigger'>
							<IconButton
								icon={SlidersHorizontal}
								variant='outline'
								label={sheetFiltersActive ? t('myTasks.filtersActive') : t('myTasks.filters')}
								onClick={() => setIsFilterSheetOpen(true)}
							/>
							{sheetFiltersActive && <span className='mt-toolbar__dot' aria-hidden='true' />}
						</span>
						<SegmentedControl
							className='mt-toolbar__group'
							label={t('myTasks.groupBy')}
							value={groupBy}
							onChange={(value) => {
								setGroupBy(value)
								saveSetting(GROUP_KEY, value)
							}}
							options={[{ value: 'date', label: t('myTasks.byDate') }, { value: 'board', label: t('myTasks.byBoard') }]}
						/>
					</div>
					<div className='mt-chips' role='group' aria-label={t('myTasks.show')}>
						{['open', 'overdue', 'week', 'done'].map((key) => (
							(key !== 'overdue' || counts.overdue > 0) && (
								<Chip key={key} pressed={focus === key} onClick={() => setFocus(key)} className={cx(key === 'overdue' && 'mt-chip--danger')}>
									{t(`myTasks.chips.${key}`)}<span className='ui-segmented__count'>{counts[key]}</span>
								</Chip>
							)
						))}
					</div>
					{body}
				</div>
			</main>
			<Modal
				open={isFilterSheetOpen}
				onClose={() => setIsFilterSheetOpen(false)}
				title={t('myTasks.filters')}
				footer={
					<>
						{sheetFiltersActive && <Button variant='secondary' onClick={() => { changeFilter(setPriority)('all'); changeFilter(setBoard)('all') }}>{t('myTasks.reset')}</Button>}
						<Button onClick={() => setIsFilterSheetOpen(false)}>{t('myTasks.apply')}</Button>
					</>
				}
			>
				<div className='mt-sheet'>
					<label className='ui-field__label' htmlFor='mt-sheet-priority'>{t('myTasks.priorityLabel')}</label>
					<Select id='mt-sheet-priority' value={priority} onChange={(event) => changeFilter(setPriority)(event.target.value)} options={priorityOptions} />
					<label className='ui-field__label' htmlFor='mt-sheet-board'>{t('myTasks.boardLabel')}</label>
					<Select id='mt-sheet-board' value={board} onChange={(event) => changeFilter(setBoard)(event.target.value)} options={boardOptions} />
				</div>
			</Modal>
		</div>
	)
}

export default MyTasks
