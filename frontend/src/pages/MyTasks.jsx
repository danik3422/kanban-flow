import {
	AlertTriangle,
	ArrowUpRight,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	ClipboardList,
	RotateCcw,
	Layers3,
	Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import { axiosInstance } from '../lib/axios'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'

const MyTasks = () => {
	const navigate = useNavigate()
	const [boards, setBoards] = useState([])
	const [tasks, setTasks] = useState([])
	const [search, setSearch] = useState('')
	const [priority, setPriority] = useState('all')
	const [board, setBoard] = useState('all')
	const [isLoading, setIsLoading] = useState(true)
	const {
		isSidebarOpen,
		setIsSidebarOpen,
		isSidebarCollapsed,
		setIsSidebarCollapsed,
	} = useWorkspaceNavigation()

	const getTaskStatus = (task) => {
		if (!task.checklist?.length) return 'Todo'
		if (task.checklist.every((item) => item.completed)) return 'Completed'
		if (task.checklist.some((item) => item.completed)) return 'In progress'
		return 'Todo'
	}

	const formatPriority = (value = 'none') =>
		value === 'none' ? 'No priority' : `${value[0].toUpperCase()}${value.slice(1)}`

	const getDueDateState = (task) => {
		if (!task.dueDate) return 'none'
		if (getTaskStatus(task) === 'Completed') return 'completed'
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const dueDate = new Date(task.dueDate)
		dueDate.setHours(0, 0, 0, 0)
		return dueDate < today ? 'overdue' : 'upcoming'
	}

	useEffect(() => {
		fetchBoardsWithCache()
			.then((nextBoards) => setBoards(nextBoards))
			.catch((error) => {
				if ([404, 204].includes(error.response?.status)) {
					setBoards([])
					return
				}
				toast.error(error.response?.data?.message || 'Could not load boards')
			})
	}, [])

	useEffect(() => {
		let isCurrent = true
		const requestTimer = window.setTimeout(() => {
			axiosInstance.get('/board/my-tasks', {
				params: { search, priority, board },
			})
				.then((tasksResponse) => {
					if (isCurrent) setTasks(tasksResponse.data)
				})
				.catch((error) => {
					if (!isCurrent) return
					if ([404, 204].includes(error.response?.status)) {
						setTasks([])
						return
					}
					toast.error(error.response?.data?.message || 'Could not load your tasks')
				})
				.finally(() => {
					if (isCurrent) setIsLoading(false)
				})
		}, 220)
		return () => {
			isCurrent = false
			window.clearTimeout(requestTimer)
		}
	}, [search, priority, board])

	const handleSearchChange = (event) => {
		setIsLoading(true)
		setSearch(event.target.value)
	}

	const handlePriorityChange = (event) => {
		setIsLoading(true)
		setPriority(event.target.value)
	}

	const handleBoardChange = (event) => {
		setIsLoading(true)
		setBoard(event.target.value)
	}

	const hasFilters = Boolean(search || priority !== 'all' || board !== 'all')

	const clearFilters = () => {
		setIsLoading(true)
		setSearch('')
		setPriority('all')
		setBoard('all')
	}

	const stats = useMemo(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const endOfWeek = new Date(today)
		endOfWeek.setDate(today.getDate() + 7)

		const assignedCount = tasks.length
		const overdueCount = tasks.filter((task) => {
			if (!task.dueDate) return false
			const dueDate = new Date(task.dueDate)
			dueDate.setHours(0, 0, 0, 0)
			return dueDate < today && !task.checklist?.every((item) => item.completed)
		}).length
		const dueThisWeekCount = tasks.filter((task) => {
			if (!task.dueDate) return false
			const dueDate = new Date(task.dueDate)
			dueDate.setHours(0, 0, 0, 0)
			return dueDate >= today && dueDate <= endOfWeek
		}).length
		const completedCount = tasks.filter((task) => {
			if (!task.checklist || task.checklist.length === 0) return false
			return task.checklist.every((item) => item.completed)
		}).length

		return {
			assignedCount,
			overdueCount,
			dueThisWeekCount,
			completedCount,
		}
	}, [tasks])

	const taskGroups = useMemo(() => {
		const boardNames = new Map(boards.map((item) => [item._id, item.name]))
		const groups = new Map()

		tasks.forEach((task) => {
			const boardData = task.column?.board
			const boardId = boardData?._id || boardData || 'unknown-board'
			const boardName = boardData?.name || boardNames.get(String(boardId)) || 'Room'
			if (!groups.has(String(boardId))) {
				groups.set(String(boardId), {
					id: String(boardId),
					name: boardName,
					tasks: [],
				})
			}
			groups.get(String(boardId)).tasks.push(task)
		})

		return Array.from(groups.values())
	}, [boards, tasks])

	return (
		<div className='workspace-shell flex h-screen'>
			<WorkspaceSidebar
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
				boards={boards}
				selectedBoardId={null}
				onBoardSelect={(board) => navigate(`/workspaces/${board._id}`)}
				onCreateBoard={() => navigate('/workspaces')}
				isCollapsed={isSidebarCollapsed}
			/>
			<main className='workspace-main my-tasks-main flex-1 overflow-auto'>
				<WorkspaceTopbar
					isSidebarOpen={isSidebarOpen}
					onSidebarToggle={() => setIsSidebarOpen((value) => !value)}
					isSidebarCollapsed={isSidebarCollapsed}
					onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}
				>
					<div className='workspace-context-copy'>
						<div className='workspace-context-label'>Workspace</div>
						<div className='workspace-board-title-row'>
							<span className='workspace-board-name'>
								<ChevronRight size={13} /> My tasks
							</span>
						</div>
					</div>
				</WorkspaceTopbar>
				<div className='workspace-content my-tasks-page'>
					{!isLoading && <>
					<div className='my-tasks-stats-grid'>
						<div className='my-tasks-stat-card'>
							<div className='my-tasks-stat-top'>
								<span className='my-tasks-stat-title'>Assigned to you</span>
								<span className='my-tasks-stat-icon my-tasks-stat-icon-assigned'><ClipboardList size={22} /></span>
							</div>
							<span className='my-tasks-stat-value'>{stats.assignedCount}</span>
						</div>
						<div className='my-tasks-stat-card'>
							<div className='my-tasks-stat-top'>
								<span className='my-tasks-stat-title'>Overdue</span>
								<span className='my-tasks-stat-icon my-tasks-stat-icon-overdue'><AlertTriangle size={22} /></span>
							</div>
							<span className='my-tasks-stat-value'>{stats.overdueCount}</span>
						</div>
						<div className='my-tasks-stat-card'>
							<div className='my-tasks-stat-top'>
								<span className='my-tasks-stat-title'>Due this week</span>
								<span className='my-tasks-stat-icon my-tasks-stat-icon-thisweek'><CalendarDays size={22} /></span>
							</div>
							<span className='my-tasks-stat-value'>{stats.dueThisWeekCount}</span>
						</div>
						<div className='my-tasks-stat-card'>
							<div className='my-tasks-stat-top'>
								<span className='my-tasks-stat-title'>Completed</span>
								<span className='my-tasks-stat-icon my-tasks-stat-icon-completed'><CheckCircle2 size={22} /></span>
							</div>
							<span className='my-tasks-stat-value'>{stats.completedCount}</span>
						</div>
					</div>
					<div className='my-tasks-toolbar'>
						<div className='my-tasks-search-wrap'>
							<Search size={14} className='my-tasks-search-icon' />
							<input
								className='my-tasks-search-input'
								placeholder='Search your tasks'
								value={search}
								onChange={handleSearchChange}
							/>
						</div>
						<div className='my-tasks-filter-wrap'>
							<select className='my-tasks-select' value={priority} onChange={handlePriorityChange}>
								<option value='all'>All priorities</option>
								<option value='none'>No priority</option>
								<option value='low'>Low</option>
								<option value='medium'>Medium</option>
								<option value='high'>High</option>
								<option value='urgent'>Urgent</option>
							</select>
							<ChevronDown size={14} className='my-tasks-select-icon' />
						</div>
						{hasFilters && <button type='button' className='my-tasks-clear-button' onClick={clearFilters}><RotateCcw size={14} /> Clear</button>}
						<div className='my-tasks-filter-wrap'>
							<select className='my-tasks-select' value={board} onChange={handleBoardChange}>
								<option value='all'>All boards</option>
								{boards.map((item) => (
									<option key={item._id} value={item._id}>{item.name}</option>
								))}
							</select>
							<ChevronDown size={14} className='my-tasks-select-icon' />
						</div>
					</div>
					</>}
					{isLoading ? (
						<div className='my-tasks-loading' role='status' aria-live='polite'>
							<div className='my-tasks-loading-stats'>{[1, 2, 3, 4].map((item) => <div className='my-tasks-loading-stat-card' key={item}><div><span /><i /></div><b /></div>)}</div>
							<div className='my-tasks-loading-toolbar'><span className='search' /><span className='filter' /><span className='filter' /></div>
							<div className='my-tasks-loading-group'>
								<div className='my-tasks-loading-group-heading'><span /><div><b /><i /></div><em /></div>
								{[1, 2, 3].map((item) => <div className='my-tasks-loading-row' key={item}><i /><span /><b /><em /></div>)}
							</div>
						</div>
					) : tasks.length ? (
						<div className='my-tasks-groups'>
							{taskGroups.map((group) => (
								<section className='my-tasks-group' key={group.id}>
									<div className='my-tasks-group-heading'>
										<div className='my-tasks-group-title'>
											<span className='my-tasks-group-icon'><Layers3 size={16} /></span>
											<div>
												<strong>{group.name}</strong>
												<small>{group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'} assigned to you</small>
											</div>
										</div>
										<button
											type='button'
											className='my-tasks-group-open'
											onClick={() => navigate(`/workspaces/${group.id}`)}
											aria-label={`Open ${group.name}`}
											title={`Open ${group.name}`}
										>
											Open room <ArrowUpRight size={15} />
										</button>
									</div>
									<div className='my-tasks-list'>
										{group.tasks.map((task) => (
											<button
												className='my-task-card'
												key={task._id}
												onClick={() => navigate(`/workspaces/${group.id}`)}
											>
												<span className='my-task-icon'><ClipboardList size={18} /></span>
												<span className='my-task-copy'>
													<strong>{task.title}</strong>
																											<span className='my-task-meta'>
																												<span className={`my-task-status is-${getTaskStatus(task).toLowerCase().replace(' ', '-')}`}>
																													{getTaskStatus(task)}
																												</span>
																												<span>{task.column?.title || 'Column'}</span>
																											</span>
												</span>
																						<span className='my-task-actions'>
																							{task.dueDate && (
																								<span className={`my-task-due is-${getDueDateState(task)}`}>
																									<CalendarDays size={13} />
																									<span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
																										</span>
																									)}
																							<span className={`my-task-priority is-${task.priority || 'none'}`}>{formatPriority(task.priority)}</span>
																							</span>
												<span className='my-task-arrow'><ArrowUpRight size={17} /></span>
											</button>
										))}
									</div>
								</section>
							))}
						</div>
					) : (
						<div className='my-tasks-empty'>
							<CheckCircle2 size={26} />
							<strong>{hasFilters ? 'No tasks match these filters' : 'No tasks assigned yet'}</strong>
							<span>{hasFilters ? 'Try a different search or clear the filters.' : 'When someone assigns a task to you, it will appear here.'}</span>
							{hasFilters && <button type='button' className='my-tasks-empty-action' onClick={clearFilters}>Clear filters</button>}
						</div>
					)}
				</div>
			</main>
		</div>
	)
}

export default MyTasks