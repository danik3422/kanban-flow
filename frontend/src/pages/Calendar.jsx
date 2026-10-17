import { CalendarDays, ChevronLeft, ChevronRight, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import MyTaskRow from '../components/app/MyTaskRow'
import '../components/app/my-tasks.css'
import '../components/calendar/calendar.css'
import MonthGrid from '../components/calendar/MonthGrid'
import QuickCreateTask from '../components/calendar/QuickCreateTask'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import useTaskActions from '../hooks/useTaskActions'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'
import { useI18n } from '../i18n'
import { translateServerMessageCurrent } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import { useAuthStore } from '../store/useAuthStore'
import { Alert, Badge, Button, EmptyState, IconButton, SegmentedControl, Skeleton } from '../ui'
import { cx } from '../ui/utils'
import { dayTitle, monthGrid, monthTitle, shiftMonth, weekdayNames, weekStartFor, dateFromKey } from '../utils/calendar'
import { getDueDateKey, getLocalDateKey } from '../utils/dueDate'

const SCOPE_KEY = 'kh:calendar-scope'
const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 }

const readScope = () => {
	try {
		return localStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'mine'
	} catch {
		return 'mine'
	}
}

// Open work first, then by priority, then by name.
const byImportance = (left, right) => Number(Boolean(left.isDone)) - Number(Boolean(right.isDone))
	|| (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0)
	|| left.title.localeCompare(right.title)

/** Due dates across boards: a month at a glance, the chosen day's tasks beside it. */
const Calendar = () => {
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const authUser = useAuthStore((state) => state.authUser)
	const todayKey = getLocalDateKey()
	const [boards, setBoards] = useState([])
	const [boardsLoaded, setBoardsLoaded] = useState(false)
	const [tasks, setTasks] = useState([])
	const [cursor, setCursor] = useState(() => {
		const now = new Date()
		return new Date(now.getFullYear(), now.getMonth(), 1)
	})
	const [selectedKey, setSelectedKey] = useState(todayKey)
	const [scope, setScope] = useState(readScope)
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [reloadKey, setReloadKey] = useState(0)
	const [createDate, setCreateDate] = useState(null)
	const { isSidebarCollapsed, setIsSidebarCollapsed } = useWorkspaceNavigation()
	const { toggleDone, setDueDate, setPriority, canToggle, toggleHint, openTask, openBoard } = useTaskActions({
		setTasks,
		onChanged: () => setReloadKey((key) => key + 1),
	})

	const weekStart = weekStartFor(language)
	const days = useMemo(() => monthGrid(cursor, weekStart), [cursor, weekStart])
	const weekdays = useMemo(() => weekdayNames(language, weekStart), [language, weekStart])
	const rangeFrom = days[0].key
	const rangeTo = days[days.length - 1].key

	useEffect(() => {
		fetchBoardsWithCache(authUser?._id)
			.then((nextBoards) => setBoards(Array.isArray(nextBoards) ? nextBoards : []))
			.catch(() => setBoards([]))
			.finally(() => setBoardsLoaded(true))
	}, [authUser?._id])

	// The previous month stays on screen (dimmed) while the next one loads.
	useEffect(() => {
		let ignore = false
		axiosInstance.get('/board/calendar', { params: { from: rangeFrom, to: rangeTo, scope } })
			.then(({ data }) => {
				if (ignore) return
				setTasks(Array.isArray(data) ? data : [])
				setLoadError('')
			})
			.catch((error) => {
				if (!ignore) setLoadError(translateServerMessageCurrent(error.response?.data?.message, 'calendar.loadError'))
			})
			.finally(() => {
				if (!ignore) setIsLoading(false)
			})
		return () => {
			ignore = true
		}
	}, [rangeFrom, rangeTo, scope, reloadKey])

	const tasksByKey = useMemo(() => {
		const map = new Map()
		for (const task of tasks) {
			const key = getDueDateKey(task.dueDate)
			if (!key) continue
			map.set(key, [...(map.get(key) || []), task])
		}
		for (const list of map.values()) list.sort(byImportance)
		return map
	}, [tasks])

	const isOverdue = (task) => !task.isDone && getDueDateKey(task.dueDate) < todayKey
	const monthTasks = tasks.filter((task) => {
		const key = getDueDateKey(task.dueDate)
		return key && dateFromKey(key).getMonth() === cursor.getMonth() && dateFromKey(key).getFullYear() === cursor.getFullYear()
	})
	const overdueCount = monthTasks.filter(isOverdue).length
	const selectedTasks = tasksByKey.get(selectedKey) || []

	const goToMonth = (months) => {
		setIsLoading(true)
		const next = shiftMonth(cursor, months)
		setCursor(next)
		setSelectedKey(next.getMonth() === new Date().getMonth() && next.getFullYear() === new Date().getFullYear() ? todayKey : getLocalDateKey(next))
	}
	const goToday = () => {
		const now = new Date()
		if (now.getMonth() !== cursor.getMonth() || now.getFullYear() !== cursor.getFullYear()) {
			setIsLoading(true)
			setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
		}
		setSelectedKey(todayKey)
	}
	const selectDay = (key) => {
		setSelectedKey(key)
		const date = dateFromKey(key)
		if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) {
			setIsLoading(true)
			setCursor(new Date(date.getFullYear(), date.getMonth(), 1))
		}
	}
	const changeScope = (value) => {
		setIsLoading(true)
		setScope(value)
		try {
			localStorage.setItem(SCOPE_KEY, value)
		} catch {
			// The choice still applies for this visit.
		}
	}

	const moveTask = async (task, key) => {
		const previous = getDueDateKey(task.dueDate)
		if (previous === key) return
		if (await setDueDate(task, key)) {
			toast.success(t('calendar.moved', { task: task.title, day: dayTitle(key, language) }), {
				action: { label: t('myTasks.undo'), onClick: () => setDueDate({ ...task, dueDate: `${key}T00:00:00.000Z` }, previous || null) },
			})
		}
	}

	const openCreate = (key) => setCreateDate(key || selectedKey)

	const noBoards = boardsLoaded && !boards.length
	const header = (
		<div className='cal-header'>
			<div className='cal-header__title'>
				<h1 className='cal-title'>{monthTitle(cursor, language)}</h1>
				{!isLoading && monthTasks.length > 0 && <Badge>{t('calendar.count', { count: monthTasks.length })}</Badge>}
				{!isLoading && overdueCount > 0 && <Badge tone='danger'>{t('calendar.overdue', { count: overdueCount })}</Badge>}
			</div>
			<div className='cal-header__controls'>
				<SegmentedControl label={t('calendar.scope')} value={scope} onChange={changeScope} options={[{ value: 'mine', label: t('calendar.mine') }, { value: 'all', label: t('calendar.all') }]} />
				<span className='cal-header__nav'>
					<IconButton icon={ChevronLeft} label={t('calendar.previous')} onClick={() => goToMonth(-1)} />
					<Button variant='secondary' size='sm' onClick={goToday}>{t('calendar.today')}</Button>
					<IconButton icon={ChevronRight} label={t('calendar.next')} onClick={() => goToMonth(1)} />
				</span>
			</div>
		</div>
	)

	const dayPanel = (
		<section className='cal-day' aria-labelledby='cal-day-title'>
			<div className='cal-day__head'>
				<h2 className='cal-day__title' id='cal-day-title'>{dayTitle(selectedKey, language)}</h2>
				{!noBoards && <IconButton icon={Plus} label={t('calendar.addTaskOn', { day: dayTitle(selectedKey, language) })} variant='secondary' onClick={() => openCreate(selectedKey)} />}
			</div>
			{isLoading && !tasks.length ? (
				<ul className='mt-list mt-card' aria-hidden='true'>
					{[0, 1].map((index) => <li key={index} className='mt-row is-loading'><span className='mt-row__main'><Skeleton width='60%' height={15} /><Skeleton width='40%' height={12} /></span></li>)}
				</ul>
			) : selectedTasks.length ? (
				<ul className='mt-list mt-card'>
					{selectedTasks.map((task) => (
						<MyTaskRow
							key={task._id}
							task={task}
							done={Boolean(task.isDone)}
							showBoard
							canToggle={canToggle(task)}
							toggleHint={toggleHint(task)}
							userId={authUser?._id}
							onToggle={toggleDone}
							onOpen={openTask}
							onOpenBoard={openBoard}
							onDueChange={setDueDate}
							onPriorityChange={setPriority}
						/>
					))}
				</ul>
			) : (
				<div className='cal-day__empty'>
					<p>{t('calendar.emptyDay')}</p>
					{!noBoards && <Button variant='ghost' size='sm' icon={Plus} onClick={() => openCreate(selectedKey)}>{t('calendar.addTask')}</Button>}
				</div>
			)}
			{selectedTasks.some((task) => !task.isDone) && <p className='cal-day__hint'>{t('calendar.dragHint')}</p>}
		</section>
	)

	return (
		<div className='workspace-shell flex h-dvh'>
			<WorkspaceSidebar
				boards={boards}
				selectedBoardId={null}
				onBoardSelect={(board) => navigate(`/workspaces/${board._id}`)}
				onCreateBoard={() => navigate('/workspaces', { state: { createBoard: true } })}
				isCollapsed={isSidebarCollapsed}
				primaryAction={noBoards ? undefined : { label: t('calendar.addTaskOn', { day: dayTitle(selectedKey, language) }), onClick: () => openCreate(selectedKey) }}
			/>
			<main className='workspace-main flex-1 overflow-auto'>
				<WorkspaceTopbar isSidebarCollapsed={isSidebarCollapsed} onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}>
					<span className='app-topbar__title'>{t('calendar.title')}</span>
				</WorkspaceTopbar>
				<div className='app-page cal-page'>
					{header}
					{loadError && (
						<Alert tone='danger'>
							<span className='cal-error'>
								{loadError}
								<Button variant='secondary' size='sm' icon={RotateCcw} onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>{t('common.retry')}</Button>
							</span>
						</Alert>
					)}
					{noBoards ? (
						<EmptyState
							icon={CalendarDays}
							title={t('calendar.noBoardsTitle')}
							description={t('calendar.noBoardsText')}
							action={<Button icon={Plus} onClick={() => navigate('/workspaces', { state: { createBoard: true } })}>{t('calendar.createBoard')}</Button>}
						/>
					) : (
						<>
							{!isLoading && !loadError && !monthTasks.length && (
								<p className='cal-empty-month'>
									{t('calendar.emptyMonth')}
									{scope === 'mine' && <Button variant='ghost' size='sm' onClick={() => changeScope('all')}>{t('calendar.showAll')}</Button>}
								</p>
							)}
							<div className={cx('cal-layout', isLoading && 'is-loading')}>
								<MonthGrid
									days={days}
									weekdays={weekdays}
									tasksByKey={tasksByKey}
									todayKey={todayKey}
									selectedKey={selectedKey}
									onSelect={selectDay}
									onOpenTask={openTask}
									onMoveTask={moveTask}
									onCreate={openCreate}
									onShiftMonth={goToMonth}
									isOverdue={isOverdue}
								/>
								{dayPanel}
							</div>
						</>
					)}
				</div>
			</main>
			<QuickCreateTask
				open={Boolean(createDate)}
				onClose={() => setCreateDate(null)}
				date={createDate}
				boards={boards}
				userId={authUser?._id}
				assignMeByDefault
				onCreated={() => {
					toast.success(t('calendar.create.created'))
					if (createDate) selectDay(createDate)
					setReloadKey((key) => key + 1)
				}}
			/>
		</div>
	)
}

export default Calendar
