import {
	Archive,
	ArrowUpRight,
	CheckCircle2,
	ChevronDown,
	CirclePlus,
	ClipboardList,
	LayoutDashboard,
	Menu,
	MoreHorizontal,
	Plus,
	Search,
	Sparkles,
	UsersRound,
	X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { axiosInstance } from '../lib/axios'
import { devBoard, devColumns, isDevAuthBypass } from '../lib/devMode'
import { useAuthStore } from '../store/useAuthStore'

const fetchColumns = async (boardId) => {
	const { data: columns } = await axiosInstance.get(
		`/board/boards/${boardId}/columns`
	)
	return Promise.all(
		columns.map(async (column) => {
			const { data: tasks } = await axiosInstance.get(
				`/board/columns/${column._id}/tasks`
			)
			return { ...column, tasks }
		})
	)
}

const Workspace = () => {
	const { authUser } = useAuthStore()
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [boards, setBoards] = useState([])
	const [selectedBoard, setSelectedBoard] = useState(null)
	const [columns, setColumns] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isCreatingBoard, setIsCreatingBoard] = useState(false)
	const [isCreatingColumn, setIsCreatingColumn] = useState(false)
	const [activeTaskColumn, setActiveTaskColumn] = useState(null)
	const [newBoardName, setNewBoardName] = useState('')
	const [newColumnTitle, setNewColumnTitle] = useState('')
	const [newTaskTitle, setNewTaskTitle] = useState('')
	const [search, setSearch] = useState('')

	const refreshBoard = async (board) => {
		if (!board) return
		setIsRefreshing(true)
		if (isDevAuthBypass) {
			setColumns(devColumns)
			setIsRefreshing(false)
			return
		}
		try {
			setColumns(await fetchColumns(board._id))
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not load this board')
		} finally {
			setIsRefreshing(false)
		}
	}

	useEffect(() => {
		const loadBoards = async () => {
			if (isDevAuthBypass) {
				setBoards([devBoard])
				setSelectedBoard(devBoard)
				setColumns(devColumns)
				setIsLoading(false)
				return
			}
			try {
				const { data } = await axiosInstance.get('/board/boards')
				setBoards(data)
				setSelectedBoard(data[0] || null)
			} catch (error) {
				if (error.response?.status !== 404) {
					toast.error(error.response?.data?.message || 'Could not load boards')
				}
			} finally {
				setIsLoading(false)
			}
		}
		loadBoards()
	}, [])

	useEffect(() => {
		if (!selectedBoard || isDevAuthBypass) return
		let isCurrent = true
		const loadSelectedBoard = async () => {
			setIsRefreshing(true)
			try {
				const nextColumns = await fetchColumns(selectedBoard._id)
				if (isCurrent) setColumns(nextColumns)
			} catch (error) {
				if (isCurrent) {
					toast.error(error.response?.data?.message || 'Could not load this board')
				}
			} finally {
				if (isCurrent) setIsRefreshing(false)
			}
		}
		loadSelectedBoard()
		return () => {
			isCurrent = false
		}
	}, [selectedBoard])

	const createBoard = async (event) => {
		event.preventDefault()
		if (!newBoardName.trim()) return
		if (isDevAuthBypass) {
			const board = { ...devBoard, _id: `dev-board-${Date.now()}`, name: newBoardName.trim() }
			setBoards((current) => [board, ...current])
			setSelectedBoard(board)
			setColumns([])
			setNewBoardName('')
			setIsCreatingBoard(false)
			toast.success('Demo board created locally')
			return
		}
		try {
			const { data } = await axiosInstance.post('/board/boards', {
				name: newBoardName.trim(),
			})
			setBoards((current) => [data, ...current])
			setSelectedBoard(data)
			setNewBoardName('')
			setIsCreatingBoard(false)
			toast.success('Board created')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not create board')
		}
	}

	const createColumn = async (event) => {
		event.preventDefault()
		if (!newColumnTitle.trim() || !selectedBoard) return
		if (isDevAuthBypass) {
			setColumns((current) => [...current, { _id: `dev-column-${Date.now()}`, title: newColumnTitle.trim(), position: current.length, tasks: [] }])
			setNewColumnTitle('')
			setIsCreatingColumn(false)
			toast.success('Demo column added locally')
			return
		}
		try {
			const { data } = await axiosInstance.post(
				`/board/boards/${selectedBoard._id}/columns`,
				{ title: newColumnTitle.trim(), position: columns.length }
			)
			setColumns((current) => [...current, { ...data, tasks: [] }])
			setNewColumnTitle('')
			setIsCreatingColumn(false)
			toast.success('Column added')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not create column')
		}
	}

	const createTask = async (event, column) => {
		event.preventDefault()
		if (!newTaskTitle.trim()) return
		if (isDevAuthBypass) {
			setColumns((current) => current.map((item) => item._id === column._id ? { ...item, tasks: [...item.tasks, { _id: `dev-task-${Date.now()}`, title: newTaskTitle.trim(), position: item.tasks.length }] } : item))
			setNewTaskTitle('')
			setActiveTaskColumn(null)
			toast.success('Demo task added locally')
			return
		}
		try {
			const { data } = await axiosInstance.post(
				`/board/columns/${column._id}/task`,
				{ title: newTaskTitle.trim(), position: column.tasks.length }
			)
			setColumns((current) =>
				current.map((item) =>
					item._id === column._id
						? { ...item, tasks: [...item.tasks, data] }
						: item
				)
			)
			setNewTaskTitle('')
			setActiveTaskColumn(null)
			toast.success('Task added')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not create task')
		}
	}

	const totalTasks = columns.reduce((total, column) => total + column.tasks.length, 0)
	const visibleColumns = columns.map((column) => ({
		...column,
		tasks: column.tasks.filter((task) =>
			task.title.toLowerCase().includes(search.toLowerCase())
		),
	}))

	return (
		<div className='workspace-shell flex h-screen'>
			<WorkspaceSidebar
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
			/>

			<main className='workspace-main flex-1 overflow-auto'>
				<header className='workspace-topbar'>
					<button className='icon-button md:hidden' onClick={() => setIsSidebarOpen(true)} aria-label='Open navigation' title='Open navigation'><Menu size={20} /></button>
					<div className='breadcrumb'>Workspace <span>/</span> Boards</div>
					<div className='topbar-actions'>
						<label className='search-field'><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Search tasks' aria-label='Search tasks' /></label>
						<div className='topbar-avatar'><img src={authUser?.avatar || '/avatar.png'} alt='' /></div>
					</div>
				</header>

				<div className='workspace-content'>
					<div className='workspace-heading'>
						<div><p className='eyebrow'>Your command center</p><h1>Good morning, {authUser?.name?.split(' ')[0] || 'there'}.</h1><p className='heading-copy'>Keep the important work moving, one clear step at a time.</p></div>
						<button className='primary-button' onClick={() => setIsCreatingBoard(true)}><Plus size={18} /> New board</button>
					</div>

					{isLoading ? <div className='empty-state'><div className='loading-spinner' /><p>Setting up your workspace...</p></div> : !selectedBoard ? <div className='empty-state empty-state-accent'><div className='empty-icon'><Sparkles size={26} /></div><h2>Start with a board</h2><p>Boards give every project a home. Create one and turn loose ideas into visible progress.</p><button className='primary-button' onClick={() => setIsCreatingBoard(true)}><Plus size={18} /> Create your first board</button></div> : <>
						<section className='board-overview'>
							<div className='board-picker'><div className='board-mark'><LayoutDashboard size={20} /></div><div><p className='eyebrow'>Active board</p><select value={selectedBoard._id} onChange={(event) => setSelectedBoard(boards.find((board) => board._id === event.target.value))}>{boards.map((board) => <option key={board._id} value={board._id}>{board.name}</option>)}</select></div><ChevronDown size={17} className='select-chevron' /></div>
							<div className='board-stats'><span><strong>{columns.length}</strong> columns</span><span><strong>{totalTasks}</strong> tasks</span><span><UsersRound size={16} /> Private board</span></div>
						</section>
						<div className='board-toolbar'><div className='toolbar-note'><CheckCircle2 size={17} /> Small steps add up.</div><button className='quiet-button' onClick={() => refreshBoard(selectedBoard)} disabled={isRefreshing}><Archive size={16} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}</button></div>
						<div className='board-scroll'><div className='kanban-grid'>
							{visibleColumns.map((column) => <section className='kanban-column' key={column._id}><div className='column-header'><div><h2>{column.title}</h2><span>{column.tasks.length}</span></div><button className='icon-button subtle' aria-label={`More options for ${column.title}`} title='More options'><MoreHorizontal size={18} /></button></div><div className='task-list'>{column.tasks.length === 0 ? <div className='column-empty'>No tasks here yet.</div> : column.tasks.map((task) => <article className='task-card' key={task._id}><div className='task-label'>Task</div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<div className='task-footer'><span><ClipboardList size={14} /> Work item</span><ArrowUpRight size={15} /></div></article>)}</div>{activeTaskColumn === column._id ? <form className='inline-form' onSubmit={(event) => createTask(event, column)}><input autoFocus value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder='What needs doing?' /><div><button type='submit' className='mini-primary'>Add task</button><button type='button' className='icon-button subtle' onClick={() => setActiveTaskColumn(null)} aria-label='Cancel' title='Cancel'><X size={16} /></button></div></form> : <button className='add-task-button' onClick={() => setActiveTaskColumn(column._id)}><Plus size={16} /> Add task</button>}</section>)}
							{isCreatingColumn ? <form className='kanban-column add-column-form' onSubmit={createColumn}><input autoFocus value={newColumnTitle} onChange={(event) => setNewColumnTitle(event.target.value)} placeholder='Column name' /><div><button type='submit' className='mini-primary'>Add column</button><button type='button' className='icon-button subtle' onClick={() => setIsCreatingColumn(false)} aria-label='Cancel' title='Cancel'><X size={16} /></button></div></form> : <button className='new-column-button' onClick={() => setIsCreatingColumn(true)}><CirclePlus size={18} /> Add column</button>}
						</div></div>
					</>}
				</div>
			</main>

			{isCreatingBoard && <div className='modal-backdrop' onMouseDown={() => setIsCreatingBoard(false)}><form className='modal-panel' onSubmit={createBoard} onMouseDown={(event) => event.stopPropagation()}><div className='modal-title'><div><p className='eyebrow'>New workspace</p><h2>Create a board</h2></div><button type='button' className='icon-button' onClick={() => setIsCreatingBoard(false)} aria-label='Close' title='Close'><X size={18} /></button></div><p>Give this project a clear home. You can add columns and tasks right away.</p><label className='field-label' htmlFor='board-name'>Board name</label><input id='board-name' autoFocus value={newBoardName} onChange={(event) => setNewBoardName(event.target.value)} placeholder='e.g. Product launch' /><button className='primary-button full-button' type='submit'><Plus size={18} /> Create board</button></form></div>}
		</div>
	)
}

export default Workspace
