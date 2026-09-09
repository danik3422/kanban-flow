import {
	Archive,
	ArrowUpRight,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CirclePlus,
	ClipboardList,
	LayoutDashboard,
	Mail,
	Menu,
	MoreHorizontal,
	PanelLeftClose,
	PanelLeftOpen,
	PencilLine,
	Plus,
	Search,
	Sparkles,
	UserRound,
	UsersRound,
	X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { toast } from 'sonner'
import AccountDropdown from '../components/AccountDropdown'
import InviteMemberModal from '../components/InviteMemberModal'
import WorkspaceOverview from '../components/WorkspaceOverview'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { axiosInstance } from '../lib/axios'
import {
	devBoard,
	devBoardInvites,
	devBoardMembers,
	devColumns,
	isDevAuthBypass,
} from '../lib/devMode'
import { useAuthStore } from '../store/useAuthStore'

const fetchColumns = async (boardId) => {
	const { data: columns } = await axiosInstance.get(
		`/board/boards/${boardId}/columns`,
	)
	return Promise.all(
		columns.map(async (column) => {
			const { data: tasks } = await axiosInstance.get(
				`/board/columns/${column._id}/tasks`,
			)
			return { ...column, tasks }
		}),
	)
}

const Workspace = () => {
	const { authUser } = useAuthStore()
	const navigate = useNavigate()
	const { boardId } = useParams()
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
	const [boards, setBoards] = useState([])
	const [selectedBoard, setSelectedBoard] = useState(null)
	const [columns, setColumns] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isCreatingBoard, setIsCreatingBoard] = useState(false)
	const [isCreatingColumn, setIsCreatingColumn] = useState(false)
	const [activeTaskColumn, setActiveTaskColumn] = useState(null)
	const [newBoardName, setNewBoardName] = useState('')
	const [boardNameDraft, setBoardNameDraft] = useState('')
	const [isEditingBoardName, setIsEditingBoardName] = useState(false)
	const [newColumnTitle, setNewColumnTitle] = useState('')
	const [newTaskTitle, setNewTaskTitle] = useState('')
	const [search, setSearch] = useState('')
	const [boardMembers, setBoardMembers] = useState([])
	const [boardMemberRecords, setBoardMemberRecords] = useState([])
	const [boardInvites, setBoardInvites] = useState([])
	const [selectedAssignees, setSelectedAssignees] = useState([])
	const [editingTask, setEditingTask] = useState(null)
	const [editingTitle, setEditingTitle] = useState('')
	const [draggedTask, setDraggedTask] = useState(null)
	const [dropIndicator, setDropIndicator] = useState(null)
	const [taskDetails, setTaskDetails] = useState(null)
	const [taskDetailsForm, setTaskDetailsForm] = useState({
		title: '',
		description: '',
		dueDate: '',
		assignees: [],
		labels: [],
		checklist: [],
	})
	const [isInviteOpen, setIsInviteOpen] = useState(false)
	const [inviteEmail, setInviteEmail] = useState('')

	const visibleBoardInvites = boardInvites.filter(
		(invite) => invite.status !== 'accepted',
	)

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
				let storedBoards = []
				try {
					storedBoards = JSON.parse(
						localStorage.getItem('kanban-dev-boards') || '[]',
					)
				} catch {
					localStorage.removeItem('kanban-dev-boards')
				}
				const availableBoards = [devBoard, ...storedBoards]
				const activeBoard =
					availableBoards.find((board) => board._id === boardId) || null
				setBoards(availableBoards)
				setSelectedBoard(activeBoard)
				setBoardMembers(devBoardMembers)
				setBoardMemberRecords(devBoardMembers)
				setBoardInvites(devBoardInvites)
				if (boardId === devBoard._id) setColumns(devColumns)
				setIsLoading(false)
				return
			}
			try {
				const { data } = await axiosInstance.get('/board/boards')
				setBoards(data)
				const nextBoard = boardId
					? data.find((board) => board._id === boardId)
					: null
				setSelectedBoard(nextBoard)
				if (boardId && !nextBoard) navigate('/workspaces', { replace: true })
			} catch (error) {
				if (error.response?.status !== 404) {
					toast.error(error.response?.data?.message || 'Could not load boards')
				}
			} finally {
				setIsLoading(false)
			}
		}
		loadBoards()
	}, [boardId, navigate])

	useEffect(() => {
		setBoardNameDraft(selectedBoard?.name || '')
		setIsEditingBoardName(false)
	}, [selectedBoard])

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
					toast.error(
						error.response?.data?.message || 'Could not load this board',
					)
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

	useEffect(() => {
		if (!draggedTask) return undefined
		const handleDragOver = (event) => {
			const targetElement =
				event.target instanceof Element
					? event.target
					: event.target.parentElement
			const card = targetElement?.closest('.task-card')
			const taskList = card?.closest('.task-list')
			if (!card || !taskList) return
			document
				.querySelectorAll('.task-card.drop-before, .task-card.drop-after')
				.forEach((item) => item.classList.remove('drop-before', 'drop-after'))
			const column = card.closest('.kanban-column')
			const columnIndex = Array.from(
				document.querySelectorAll('.kanban-column'),
			).indexOf(column)
			const targetColumn = columns[columnIndex]
			const taskIndex = Array.from(taskList.children).indexOf(card)
			const isBefore =
				event.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2
			card.classList.add(isBefore ? 'drop-before' : 'drop-after')
			setDropIndicator({
				columnId: targetColumn?._id,
				index: taskIndex + (isBefore ? 0 : 1),
			})
		}
		document.addEventListener('dragover', handleDragOver)
		return () => {
			document.removeEventListener('dragover', handleDragOver)
			document
				.querySelectorAll('.task-card.drop-before, .task-card.drop-after')
				.forEach((item) => item.classList.remove('drop-before', 'drop-after'))
		}
	}, [columns, draggedTask])

	useEffect(() => {
		if (!selectedBoard || isDevAuthBypass) return
		const socket = io('http://localhost:5001', { withCredentials: true })
		socket.on('connect', () => socket.emit('join-board', selectedBoard._id))
		socket.on('task:created', (task) => {
			setColumns((current) =>
				current.map((column) =>
					column._id === task.column
						? {
								...column,
								tasks: column.tasks.some((item) => item._id === task._id)
									? column.tasks
									: [...column.tasks, task],
							}
						: column,
				),
			)
		})
		socket.on('task:updated', (task) => {
			setColumns((current) =>
				current.map((column) => {
					const withoutTask = column.tasks.filter(
						(item) => item._id !== task._id,
					)
					return column._id === task.column
						? {
								...column,
								tasks: [...withoutTask, task].sort(
									(left, right) => left.position - right.position,
								),
							}
						: { ...column, tasks: withoutTask }
				}),
			)
		})
		return () => socket.disconnect()
	}, [selectedBoard])

	useEffect(() => {
		if (!selectedBoard || isDevAuthBypass) return
		Promise.all([
			axiosInstance.get(`/board/boards/${selectedBoard._id}/members`),
			axiosInstance.get(`/board/boards/${selectedBoard._id}/invites`),
		])
			.then(([membersResponse, invitesResponse]) => {
				setBoardMembers(membersResponse.data.map((member) => member.user))
				setBoardMemberRecords(membersResponse.data)
				setBoardInvites(invitesResponse.data)
			})
			.catch(() => {})
	}, [selectedBoard])

	const renameBoard = async () => {
		if (!selectedBoard || !boardNameDraft.trim()) {
			toast.error('Board name is required')
			return
		}
		if (isDevAuthBypass) {
			const trimmedName = boardNameDraft.trim()
			setBoards((current) =>
				current.map((board) =>
					board._id === selectedBoard._id ? { ...board, name: trimmedName } : board,
				),
			)
			setSelectedBoard((current) =>
				current ? { ...current, name: trimmedName } : current,
			)
			setIsEditingBoardName(false)
			toast.success('Board renamed')
			return
		}
		try {
			const { data } = await axiosInstance.patch(
				`/board/boards/${selectedBoard._id}`,
				{ name: boardNameDraft.trim() },
			)
			setBoards((current) =>
				current.map((board) =>
					board._id === selectedBoard._id ? { ...board, ...data } : board,
				),
			)
			setSelectedBoard((current) =>
				current ? { ...current, ...data } : current,
			)
			setIsEditingBoardName(false)
			toast.success('Board renamed')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not rename board')
		}
	}

	const createBoard = async (event) => {
		event.preventDefault()
		if (!newBoardName.trim()) return
		if (isDevAuthBypass) {
			const board = {
				...devBoard,
				_id: `dev-board-${Date.now()}`,
				name: newBoardName.trim(),
			}
			setBoards((current) => {
				const nextBoards = [...current, board]
				localStorage.setItem(
					'kanban-dev-boards',
					JSON.stringify(
						nextBoards.filter((item) => item._id !== devBoard._id),
					),
				)
				return nextBoards
			})
			setSelectedBoard(board)
			navigate(`/workspaces/${board._id}`)
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
			navigate(`/workspaces/${data._id}`)
			setNewBoardName('')
			setIsCreatingBoard(false)
			toast.success('Board created')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not create board')
		}
	}

	const selectBoard = (board) => {
		setSelectedBoard(board)
		setIsSidebarOpen(false)
		navigate(`/workspaces/${board._id}`)
	}

	const copyInviteUrl = async (url) => {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(url)
			return
		}
		const textArea = document.createElement('textarea')
		textArea.value = url
		textArea.style.position = 'fixed'
		textArea.style.opacity = '0'
		document.body.appendChild(textArea)
		textArea.select()
		document.execCommand('copy')
		textArea.remove()
	}

	const copyPendingInvite = async (inviteId) => {
		if (!selectedBoard) return
		try {
			const { data } = await axiosInstance.post(
				`/board/boards/${selectedBoard._id}/invites/${inviteId}/copy`,
			)
			await copyInviteUrl(data.inviteUrl)
			toast.success('Invite link copied again')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not copy invite link')
		}
	}

	const inviteMember = async (event, mode = 'email') => {
		event.preventDefault()
		if (!selectedBoard) return
		if (isDevAuthBypass) {
			const email = mode === 'email' ? inviteEmail.trim() : ''
			const invite = {
				_id: `dev-invite-${Date.now()}`,
				email,
				createdAt: new Date().toISOString(),
				status: 'pending',
			}
			setBoardInvites((current) => [invite, ...current])
			setInviteEmail('')
			setIsInviteOpen(false)
			await copyInviteUrl(`${window.location.origin}/invite/demo-${invite._id}`)
			toast.success(
				mode === 'email'
					? 'Demo invitation created and link copied'
					: 'Demo link copied',
			)
			return
		}
		try {
			const { data } = await axiosInstance.post(
				`/board/boards/${selectedBoard._id}/invites`,
				{ email: mode === 'email' ? inviteEmail.trim() : '' },
			)
			setInviteEmail('')
			setIsInviteOpen(false)
			await copyInviteUrl(data.inviteUrl)
			const { data: invites } = await axiosInstance.get(
				`/board/boards/${selectedBoard._id}/invites`,
			)
			setBoardInvites(invites)
			toast.success(
				mode === 'email' && data.emailSent
					? 'Invite email sent and link copied'
					: 'Invite link created and copied',
			)
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not invite member')
		}
	}

	const revokeInvite = async (inviteId) => {
		if (isDevAuthBypass) {
			setBoardInvites((current) =>
				current.filter((invite) => invite._id !== inviteId),
			)
			toast.success('Demo invite revoked')
			return
		}
		try {
			await axiosInstance.delete(
				`/board/boards/${selectedBoard._id}/invites/${inviteId}`,
			)
			setBoardInvites((current) =>
				current.filter((invite) => invite._id !== inviteId),
			)
			toast.success('Invite revoked')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not revoke invite')
		}
	}

	const updateMemberRole = async (memberId, role) => {
		if (isDevAuthBypass) {
			setBoardMemberRecords((current) =>
				current.map((member) =>
					member._id === memberId ? { ...member, role } : member,
				),
			)
			toast.success('Demo member role updated')
			return
		}
		try {
			const { data } = await axiosInstance.patch(
				`/board/boards/${selectedBoard._id}/members/${memberId}`,
				{ role },
			)
			setBoardMemberRecords((current) =>
				current.map((member) => (member._id === memberId ? data : member)),
			)
			toast.success('Member role updated')
		} catch (error) {
			toast.error(
				error.response?.data?.message || 'Could not update member role',
			)
		}
	}

	const openOverviewBoard = (board) => selectBoard(board)

	const createColumn = async (event) => {
		event.preventDefault()
		if (!newColumnTitle.trim() || !selectedBoard) return
		if (isDevAuthBypass) {
			setColumns((current) => [
				...current,
				{
					_id: `dev-column-${Date.now()}`,
					title: newColumnTitle.trim(),
					position: current.length,
					tasks: [],
				},
			])
			setNewColumnTitle('')
			setIsCreatingColumn(false)
			toast.success('Demo column added locally')
			return
		}
		try {
			const { data } = await axiosInstance.post(
				`/board/boards/${selectedBoard._id}/columns`,
				{ title: newColumnTitle.trim(), position: columns.length },
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
			setColumns((current) =>
				current.map((item) =>
					item._id === column._id
						? {
								...item,
								tasks: [
									...item.tasks,
									{
										_id: `dev-task-${Date.now()}`,
										title: newTaskTitle.trim(),
										position: item.tasks.length,
									},
								],
							}
						: item,
				),
			)
			setNewTaskTitle('')
			setActiveTaskColumn(null)
			toast.success('Demo task added locally')
			return
		}
		try {
			const { data } = await axiosInstance.post(
				`/board/columns/${column._id}/task`,
				{
					title: newTaskTitle.trim(),
					position: column.tasks.length,
					assignees: selectedAssignees,
				},
			)
			setColumns((current) =>
				current.map((item) =>
					item._id === column._id
						? { ...item, tasks: [...item.tasks, data] }
						: item,
				),
			)
			setNewTaskTitle('')
			setSelectedAssignees([])
			setActiveTaskColumn(null)
			toast.success('Task added')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not create task')
		}
	}

	const updateTask = async (task) => {
		if (!editingTitle.trim() || isDevAuthBypass) {
			setEditingTask(null)
			return
		}
		try {
			await axiosInstance.patch(`/board/tasks/${task._id}`, {
				title: editingTitle.trim(),
			})
			setEditingTask(null)
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not update task')
		}
	}

	const openTaskDetails = (task) => {
		setTaskDetails(task)
		setTaskDetailsForm({
			title: task.title || '',
			description: task.description || '',
			dueDate: task.dueDate
				? new Date(task.dueDate).toISOString().slice(0, 10)
				: '',
			assignees: (task.assignees || []).map(
				(assignee) => assignee._id || assignee,
			),
			labels: task.labels || [],
			checklist: task.checklist || [],
		})
	}

	const saveTaskDetails = async (event) => {
		event.preventDefault()
		if (!taskDetails || !taskDetailsForm.title.trim()) return

		const changes = {
			title: taskDetailsForm.title.trim(),
			description: taskDetailsForm.description,
			dueDate: taskDetailsForm.dueDate || null,
			assignees: taskDetailsForm.assignees,
			labels: taskDetailsForm.labels,
			checklist: taskDetailsForm.checklist,
		}

		if (isDevAuthBypass) {
			setColumns((current) =>
				current.map((column) => ({
					...column,
					tasks: column.tasks.map((task) =>
						task._id === taskDetails._id ? { ...task, ...changes } : task,
					),
				})),
			)
			setTaskDetails(null)
			return
		}

		try {
			const { data } = await axiosInstance.patch(
				`/board/tasks/${taskDetails._id}`,
				changes,
			)
			setColumns((current) =>
				current.map((column) => ({
					...column,
					tasks: column.tasks.map((task) =>
						task._id === data._id ? data : task,
					),
				})),
			)
			setTaskDetails(null)
			toast.success('Task updated')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not update task')
		}
	}

	const moveTask = async (
		task,
		targetColumn,
		targetIndex = targetColumn.tasks.length,
	) => {
		if (!task) {
			setDraggedTask(null)
			return
		}
		const sourceColumn = columns.find((column) =>
			column.tasks.some((item) => item._id === task._id),
		)
		if (!sourceColumn) {
			setDraggedTask(null)
			return
		}
		const previousColumns = columns
		const requestedIndex =
			dropIndicator?.columnId === targetColumn._id
				? dropIndicator.index
				: targetIndex
		const sourceIndex = sourceColumn.tasks.findIndex(
			(item) => item._id === task._id,
		)
		const insertionIndex =
			sourceColumn._id === targetColumn._id && requestedIndex > sourceIndex
				? requestedIndex - 1
				: requestedIndex
		if (
			sourceColumn._id === targetColumn._id &&
			insertionIndex === sourceIndex
		) {
			setDraggedTask(null)
			setDropIndicator(null)
			return
		}
		const nextPosition = Math.max(
			0,
			Math.min(
				insertionIndex,
				targetColumn.tasks.length -
					(sourceColumn._id === targetColumn._id ? 1 : 0),
			),
		)
		setColumns((current) =>
			current.map((column) => {
				if (column._id !== sourceColumn._id && column._id !== targetColumn._id)
					return column
				const nextTasks = column.tasks.filter((item) => item._id !== task._id)
				if (column._id === targetColumn._id) {
					nextTasks.splice(nextPosition, 0, {
						...task,
						column: targetColumn._id,
						position: nextPosition,
					})
				}
				return {
					...column,
					tasks: nextTasks.map((item, index) => ({ ...item, position: index })),
				}
			}),
		)
		setDraggedTask(null)
		setDropIndicator(null)
		if (isDevAuthBypass) return
		try {
			await axiosInstance.patch(`/board/tasks/${task._id}`, {
				column: targetColumn._id,
				position: nextPosition,
			})
		} catch (error) {
			setColumns(previousColumns)
			toast.error(error.response?.data?.message || 'Could not move task')
		}
	}

	const totalTasks = columns.reduce(
		(total, column) => total + column.tasks.length,
		0,
	)
	const visibleColumns = columns.map((column) => ({
		...column,
		tasks: column.tasks.filter((task) =>
			task.title.toLowerCase().includes(search.toLowerCase()),
		),
	}))

	return (
		<div className='workspace-shell flex h-screen'>
			<WorkspaceSidebar
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
				boards={boards}
				selectedBoardId={selectedBoard?._id}
				onBoardSelect={selectBoard}
				onCreateBoard={() => setIsCreatingBoard(true)}
				isCollapsed={isSidebarCollapsed}
			/>

			<main className='workspace-main flex-1 overflow-auto'>
				<header className='workspace-topbar'>
					<div className='workspace-topbar-leading'>
						<button
							className='workspace-mobile-menu'
							onClick={() => setIsSidebarOpen((value) => !value)}
							aria-expanded={isSidebarOpen}
							aria-label={
								isSidebarOpen ? 'Close navigation' : 'Open navigation'
							}
							title={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
						>
							<Menu size={20} />
						</button>
						<button
							className='icon-button workspace-collapse-toggle hidden md:grid'
							onClick={() => setIsSidebarCollapsed((value) => !value)}
							aria-label={
								isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
							}
							title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						>
							{isSidebarCollapsed ? (
								<PanelLeftOpen size={18} />
							) : (
								<PanelLeftClose size={18} />
							)}
						</button>
						<div className='workspace-context'>
							<span className='workspace-context-icon'>
								<LayoutDashboard size={16} />
							</span>
							<div className='workspace-context-copy'>
								<div className='workspace-context-label'>My workspace</div>
								<div className='workspace-board-title-row'>
									<span className='workspace-board-name'>
										<ChevronRight size={13} />
										{isEditingBoardName ? (
											<input
												value={boardNameDraft}
												onChange={(event) => setBoardNameDraft(event.target.value)}
												onBlur={renameBoard}
												onKeyDown={(event) => {
													if (event.key === 'Enter') renameBoard()
													if (event.key === 'Escape') {
														setIsEditingBoardName(false)
														setBoardNameDraft(selectedBoard?.name || '')
													}
												}}
												autoFocus
												className='workspace-board-name-input'
											/>
										) : (
											selectedBoard?.name || 'Rooms'
										)}
									</span>
									{selectedBoard && !isEditingBoardName && (
										<button
											className='workspace-board-edit-button'
											onClick={() => setIsEditingBoardName(true)}
											type='button'
											aria-label={`Rename board ${selectedBoard.name}`}
										>
											<PencilLine size={12} />
											<span>Edit name</span>
										</button>
									)}
								</div>
							</div>
						</div>
					</div>
					<div className='topbar-actions'>
						<label className='search-field'>
							<Search size={16} />
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder='Search tasks'
								aria-label='Search tasks'
							/>
						</label>
						<AccountDropdown />
					</div>
				</header>

				{!boardId ? (
					<WorkspaceOverview
						boards={boards}
						onOpenBoard={openOverviewBoard}
						onCreateBoard={() => setIsCreatingBoard(true)}
					/>
				) : (
					<div className='workspace-content'>
						<div className='workspace-heading'>
							<div>
								<p className='eyebrow'>Your command center</p>
								<h1>
									Good morning, {authUser?.name?.split(' ')[0] || 'there'}.
								</h1>
								<p className='heading-copy'>
									Keep the important work moving, one clear step at a time.
								</p>
							</div>
							<button
								className='primary-button'
								onClick={() => setIsCreatingBoard(true)}
							>
								<Plus size={18} /> New board
							</button>
						</div>

						{isLoading ? (
							<div className='empty-state'>
								<div className='loading-spinner' />
								<p>Setting up your workspace...</p>
							</div>
						) : !selectedBoard ? (
							<div className='empty-state empty-state-accent'>
								<div className='empty-icon'>
									<Sparkles size={26} />
								</div>
								<h2>Start with a board</h2>
								<p>
									Boards give every project a home. Create one and turn loose
									ideas into visible progress.
								</p>
								<button
									className='primary-button'
									onClick={() => setIsCreatingBoard(true)}
								>
									<Plus size={18} /> Create your first board
								</button>
							</div>
						) : (
							<>
								<section className='board-overview'>
									<div className='board-picker'>
										<div className='board-mark'>
											<LayoutDashboard size={20} />
										</div>
										<div>
											<p className='eyebrow'>Current room</p>
											<select
												value={selectedBoard._id}
												onChange={(event) =>
													selectBoard(
														boards.find(
															(board) => board._id === event.target.value,
														),
													)
												}
											>
												{boards.map((board) => (
													<option key={board._id} value={board._id}>
														{board.name}
													</option>
												))}
											</select>
										</div>
										<ChevronDown size={17} className='select-chevron' />
									</div>
									<div className='board-stats'>
										<span>
											<strong>{columns.length}</strong> columns
										</span>
										<span>
											<strong>{totalTasks}</strong> tasks
										</span>
										<span>
											<UsersRound size={16} /> Private board
										</span>
									</div>
								</section>
								{visibleBoardInvites.length > 0 && (
									<section className='board-invites'>
										<div className='board-invites-heading'>
											<div>
												<p className='eyebrow'>Invitations</p>
												<h2>People invited to this room</h2>
											</div>
											<span>{visibleBoardInvites.length}</span>
										</div>
										<div className='board-invite-list'>
											{visibleBoardInvites.map((invite) => (
												<div className='board-invite-row' key={invite._id}>
													<div className='board-invite-person'>
														<span className='board-invite-icon'>
															<Mail size={15} />
														</span>
														<div>
															<strong>
																{invite.email || 'Link invitation'}
															</strong>
															<small>
																Sent{' '}
																{new Date(invite.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
															</small>
														</div>
													</div>
													<div className='board-invite-actions'>
														<span
															className={`board-invite-status ${invite.status}`}
														>
															{invite.status === 'accepted'
																? 'Accepted'
																: invite.status === 'expired'
																	? 'Expired'
																	: 'Pending'}
														</span>
														{invite.status === 'pending' && (
															<>
																<button
																	type='button'
																	className='board-invite-copy'
																	onClick={() => copyPendingInvite(invite._id)}
																>
																	Copy link
																</button>
																<button
																	type='button'
																	className='board-invite-revoke'
																	onClick={() => revokeInvite(invite._id)}
																>
																	Cancel
																</button>
															</>
														)}
													</div>
												</div>
											))}
										</div>
									</section>
								)}
								<div className='board-toolbar'>
									<div className='toolbar-note'>
										<CheckCircle2 size={17} /> Small steps add up.
									</div>
									<div className='board-toolbar-actions'>
										<button
											className='quiet-button'
											onClick={() => setIsInviteOpen(true)}
										>
											<Mail size={16} /> Invite
										</button>
										<button
											className='quiet-button'
											onClick={() => refreshBoard(selectedBoard)}
											disabled={isRefreshing}
										>
											<Archive size={16} />{' '}
											{isRefreshing ? 'Refreshing...' : 'Refresh'}
										</button>
									</div>
								</div>
								<div className='board-scroll'>
									<div className='kanban-grid'>
										{visibleColumns.map((column) => (
											<section
												className={`kanban-column ${draggedTask ? 'drop-target-ready' : ''}`}
												key={column._id}
												onDragOver={(event) => event.preventDefault()}
												onDrop={() => moveTask(draggedTask, column)}
											>
												<div className='column-header'>
													<div>
														<h2>{column.title}</h2>
														<span>{column.tasks.length}</span>
													</div>
													<button
														className='icon-button subtle'
														aria-label={`More options for ${column.title}`}
														title='More options'
													>
														<MoreHorizontal size={18} />
													</button>
												</div>
												<div className='task-list'>
													{column.tasks.length === 0 ? (
														<div className='column-empty'>
															Drop a task here.
														</div>
													) : (
														column.tasks.map((task) => (
															<article
																className='task-card'
																draggable={editingTask?._id !== task._id}
																onDragStart={() => setDraggedTask(task)}
																onDragEnd={() => setDraggedTask(null)}
																key={task._id}
																onClick={() => openTaskDetails(task)}
																onDoubleClick={() => {
																	setEditingTask(task)
																	setEditingTitle(task.title)
																}}
															>
																<div className='task-label'>
																	Task · drag to move
																</div>
																{editingTask?._id === task._id ? (
																	<form
																		className='inline-form'
																		onClick={(event) => event.stopPropagation()}
																		onSubmit={(event) => {
																			event.preventDefault()
																			updateTask(task)
																		}}
																	>
																		<input
																			autoFocus
																			value={editingTitle}
																			onChange={(event) =>
																				setEditingTitle(event.target.value)
																			}
																		/>
																		<button
																			type='submit'
																			className='mini-primary'
																		>
																			Save
																		</button>
																	</form>
																) : (
																	<>
																		<h3>{task.title}</h3>
																		{task.description && (
																			<p>{task.description}</p>
																		)}
																		<div className='task-footer'>
																			<span>
																				{task.dueDate ? (
																					<>
																						<CalendarDays size={14} />{' '}
																						{new Date(
																							task.dueDate,
																						).toLocaleDateString()}
																					</>
																				) : (
																					<>
																						<ClipboardList size={14} /> Work
																						item
																					</>
																				)}
																				{task.assignees?.length > 0 && (
																					<>
																						<UserRound size={14} />{' '}
																						{task.assignees.length}
																					</>
																				)}
																			</span>
																			<ArrowUpRight size={15} />
																		</div>
																	</>
																)}
															</article>
														))
													)}
												</div>
												{activeTaskColumn === column._id ? (
													<form
														className='inline-form'
														onSubmit={(event) => createTask(event, column)}
													>
														<input
															autoFocus
															value={newTaskTitle}
															onChange={(event) =>
																setNewTaskTitle(event.target.value)
															}
															placeholder='What needs doing?'
														/>
														{boardMembers.length > 0 && (
															<select
																multiple
																value={selectedAssignees}
																onChange={(event) =>
																	setSelectedAssignees(
																		Array.from(
																			event.target.selectedOptions,
																			(option) => option.value,
																		),
																	)
																}
																aria-label='Assign people'
															>
																<option value='' disabled>
																	Assign people
																</option>
																{boardMembers.map((member) => (
																	<option key={member._id} value={member._id}>
																		{member.name || member.email}
																	</option>
																))}
															</select>
														)}
														<div>
															<button type='submit' className='mini-primary'>
																Add task
															</button>
															<button
																type='button'
																className='icon-button subtle'
																onClick={() => setActiveTaskColumn(null)}
																aria-label='Cancel'
																title='Cancel'
															>
																<X size={16} />
															</button>
														</div>
													</form>
												) : (
													<button
														className='add-task-button'
														onClick={() => setActiveTaskColumn(column._id)}
													>
														<Plus size={16} /> Add task
													</button>
												)}
											</section>
										))}
										{isCreatingColumn ? (
											<form
												className='kanban-column add-column-form'
												onSubmit={createColumn}
											>
												<input
													autoFocus
													value={newColumnTitle}
													onChange={(event) =>
														setNewColumnTitle(event.target.value)
													}
													placeholder='Column name'
												/>
												<div>
													<button type='submit' className='mini-primary'>
														Add column
													</button>
													<button
														type='button'
														className='icon-button subtle'
														onClick={() => setIsCreatingColumn(false)}
														aria-label='Cancel'
														title='Cancel'
													>
														<X size={16} />
													</button>
												</div>
											</form>
										) : (
											<button
												className='new-column-button'
												onClick={() => setIsCreatingColumn(true)}
											>
												<CirclePlus size={18} /> Add column
											</button>
										)}
									</div>
								</div>
							</>
						)}
					</div>
				)}
			</main>

			<InviteMemberModal
				isOpen={isInviteOpen}
				email={inviteEmail}
				members={boardMemberRecords}
				invites={boardInvites}
				currentUserId={authUser?._id}
				onChange={(event) => setInviteEmail(event.target.value)}
				onClose={() => setIsInviteOpen(false)}
				onSubmit={inviteMember}
				onRevoke={revokeInvite}
				onRoleChange={updateMemberRole}
			/>
			{taskDetails && (
				<div
					className='modal-backdrop'
					onMouseDown={() => setTaskDetails(null)}
				>
					<form
						className='modal-panel task-details-panel'
						onSubmit={saveTaskDetails}
						onMouseDown={(event) => event.stopPropagation()}
					>
						<div className='modal-title'>
							<div>
								<p className='eyebrow'>Task details</p>
								<h2>Edit task</h2>
							</div>
							<button
								type='button'
								className='icon-button'
								onClick={() => setTaskDetails(null)}
								aria-label='Close'
								title='Close'
							>
								<X size={18} />
							</button>
						</div>
						<label className='field-label' htmlFor='task-title'>
							Title
						</label>
						<input
							id='task-title'
							autoFocus
							value={taskDetailsForm.title}
							onChange={(event) =>
								setTaskDetailsForm((current) => ({
									...current,
									title: event.target.value,
								}))
							}
						/>
						<label className='field-label' htmlFor='task-description'>
							Description
						</label>
						<textarea
							id='task-description'
							value={taskDetailsForm.description}
							onChange={(event) =>
								setTaskDetailsForm((current) => ({
									...current,
									description: event.target.value,
								}))
							}
							placeholder='Add a description'
						/>
						<label className='field-label' htmlFor='task-due-date'>
							Deadline
						</label>
						<input
							id='task-due-date'
							type='date'
							value={taskDetailsForm.dueDate}
							onChange={(event) =>
								setTaskDetailsForm((current) => ({
									...current,
									dueDate: event.target.value,
								}))
							}
						/>
						<label className='field-label' htmlFor='task-labels'>
							Labels
						</label>
						<input
							id='task-labels'
							value={taskDetailsForm.labels.join(', ')}
							onChange={(event) =>
								setTaskDetailsForm((current) => ({
									...current,
									labels: event.target.value
										.split(',')
										.map((label) => label.trim())
										.filter(Boolean),
								}))
							}
							placeholder='design, urgent, research'
						/>
						{boardMembers.length > 0 && (
							<>
								<label className='field-label' htmlFor='task-assignees'>
									Assignees
								</label>
								<select
									id='task-assignees'
									multiple
									value={taskDetailsForm.assignees}
									onChange={(event) =>
										setTaskDetailsForm((current) => ({
											...current,
											assignees: Array.from(
												event.target.selectedOptions,
												(option) => option.value,
											),
										}))
									}
								>
									{boardMembers.map((member) => (
										<option key={member._id} value={member._id}>
											{member.name || member.email}
										</option>
									))}
								</select>
							</>
						)}
						<label className='field-label' htmlFor='task-checklist'>
							Checklist
						</label>
						<textarea
							id='task-checklist'
							value={taskDetailsForm.checklist
								.map((item) => `${item.completed ? '[x] ' : ''}${item.text}`)
								.join('\n')}
							onChange={(event) =>
								setTaskDetailsForm((current) => ({
									...current,
									checklist: event.target.value
										.split('\n')
										.map((text) => text.replace(/^\[x\] /, '').trim())
										.filter(Boolean)
										.map((text, index) => ({
											text,
											completed: current.checklist[index]?.completed || false,
										})),
								}))
							}
							placeholder='One checklist item per line'
						/>
						<button className='primary-button full-button' type='submit'>
							Save changes
						</button>
					</form>
				</div>
			)}
			{isCreatingBoard && (
				<div
					className='modal-backdrop'
					onMouseDown={() => setIsCreatingBoard(false)}
				>
					<form
						className='modal-panel'
						onSubmit={createBoard}
						onMouseDown={(event) => event.stopPropagation()}
					>
						<div className='modal-title'>
							<div>
								<p className='eyebrow'>New workspace</p>
								<h2>Create a board</h2>
							</div>
							<button
								type='button'
								className='icon-button'
								onClick={() => setIsCreatingBoard(false)}
								aria-label='Close'
								title='Close'
							>
								<X size={18} />
							</button>
						</div>
						<p>
							Give this project a clear home. You can add columns and tasks
							right away.
						</p>
						<label className='field-label' htmlFor='board-name'>
							Board name
						</label>
						<input
							id='board-name'
							autoFocus
							value={newBoardName}
							onChange={(event) => setNewBoardName(event.target.value)}
							placeholder='e.g. Product launch'
						/>
						<button className='primary-button full-button' type='submit'>
							<Plus size={18} /> Create board
						</button>
					</form>
				</div>
			)}
		</div>
	)
}

export default Workspace
