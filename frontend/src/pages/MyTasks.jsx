import { ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
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
					<div className='workspace-heading my-tasks-heading'>
						<div>
							<p className='eyebrow'>Your focus</p>
							<h1>My tasks</h1>
							<p className='heading-copy'>Everything assigned to you, across your rooms.</p>
						</div>
						<span className='my-tasks-count'>{tasks.length}</span>
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