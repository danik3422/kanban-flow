import {
	AlertTriangle,
	ArrowUpRight,
	CalendarDays,
	CheckCircle2,
	ChevronRight,
	ClipboardList,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import { axiosInstance } from '../lib/axios'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'

const MyTasks = () => {
	const navigate = useNavigate()
	const [boards, setBoards] = useState([])
	const [tasks, setTasks] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const {
		isSidebarOpen,
		setIsSidebarOpen,
		isSidebarCollapsed,
		setIsSidebarCollapsed,
	} = useWorkspaceNavigation()

	useEffect(() => {
		Promise.all([axiosInstance.get('/board/boards'), axiosInstance.get('/board/my-tasks')])
			.then(([boardsResponse, tasksResponse]) => {
				setBoards(boardsResponse.data)
				setTasks(tasksResponse.data)
			})
			.catch((error) => toast.error(error.response?.data?.message || 'Could not load your tasks'))
			.finally(() => setIsLoading(false))
	}, [])

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
			<main className='workspace-main flex-1 overflow-auto'>
				<WorkspaceTopbar
					isSidebarOpen={isSidebarOpen}
					onSidebarToggle={() => setIsSidebarOpen((value) => !value)}
					isSidebarCollapsed={isSidebarCollapsed}
					onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}
				>
					<div className='workspace-context-copy'>
						<div className='workspace-context-label'>My workspace</div>
						<div className='workspace-board-title-row'>
							<span className='workspace-board-name'>
								<ChevronRight size={13} /> My tasks
							</span>
						</div>
					</div>
				</WorkspaceTopbar>
				<div className='workspace-content my-tasks-page'>
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
					{isLoading ? (
						<div className='my-tasks-empty my-tasks-loading'>
							<div className='loading-orbit' aria-hidden='true'><span /><span /><span /></div>
							<p className='loading-label'>Loading your tasks<span className='loading-dots'>...</span></p>
						</div>
					) : tasks.length ? (
						<div className='my-tasks-list'>
							{tasks.map((task) => (
								<button
									className='my-task-card'
									key={task._id}
									onClick={() => navigate(`/workspaces/${task.column?.board?._id}`)}
								>
									<span className='my-task-icon'><ClipboardList size={18} /></span>
									<span className='my-task-copy'>
										<strong>{task.title}</strong>
										<small>{task.column?.board?.name || 'Room'} · {task.column?.title || 'Column'}</small>
										{task.dueDate && <em><CalendarDays size={13} /> Due {new Date(task.dueDate).toLocaleDateString()}</em>}
									</span>
									<span className='my-task-arrow'><ArrowUpRight size={17} /></span>
								</button>
							))}
						</div>
					) : (
						<div className='my-tasks-empty'>
							<CheckCircle2 size={26} />
							<strong>No tasks assigned yet</strong>
							<span>When someone assigns a task to you, it will appear here.</span>
						</div>
					)}
				</div>
			</main>
		</div>
	)
}

export default MyTasks