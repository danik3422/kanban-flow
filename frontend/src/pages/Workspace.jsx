import {
	Archive,
	ArrowUpRight,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CirclePlus,
	ClipboardList,
	Clock3,
	ListChecks,
	LogOut,
	MessageSquare,
	MoreHorizontal,
			Pencil,
	Pin,
	Plus,
	Play,
	Sparkles,
	Square,
	Trash2,
	UserMinus,
	UserRound,
	X,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { toast } from 'sonner'
import InviteMemberModal from '../components/InviteMemberModal'
import WorkspaceOverview from '../components/WorkspaceOverview'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import RichTextEditor from '../components/RichTextEditor'
import Popover from '../components/Popover'
import { sanitizeDescription } from '../lib/richText'
import { axiosInstance } from '../lib/axios'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import { socketUrl } from '../lib/runtimeConfig'
import { sortTasks } from '../utils/taskSorting'
import { getColumnInsertionIndex, reorderColumns } from '../utils/columnOrdering'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'
import {
	devBoard,
	devBoardInvites,
	devBoardMembers,
	devColumns,
	isDevAuthBypass,
} from '../lib/devMode'
import { useAuthStore } from '../store/useAuthStore'

const getChecklistProgress = (checklist = []) => {
	const completed = checklist.filter((item) => item.completed).length
	return { completed, total: checklist.length }
}

const getDueDateState = (dueDate) => {
	if (!dueDate) return null
	const due = new Date(dueDate)
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	due.setHours(0, 0, 0, 0)
	return due < today ? 'overdue' : due.getTime() === today.getTime() ? 'today' : 'upcoming'
}

const getSortStorageKey = (boardId, userId = 'anonymous') =>
	`kanban-column-sorts:${userId}:${boardId}`

const readLocalSorts = (boardId, userId) => {
	try {
		return JSON.parse(
			localStorage.getItem(getSortStorageKey(boardId, userId)) || '{}',
		)
	} catch {
		localStorage.removeItem(getSortStorageKey(boardId, userId))
		return {}
	}
}

const saveLocalSorts = (boardId, userId, sorts) => {
	localStorage.setItem(getSortStorageKey(boardId, userId), JSON.stringify(sorts))
}


const setNativeDragImage = (event, element) => {
	const rect = element.getBoundingClientRect()
	const preview = element.cloneNode(true)
	preview.style.position = 'fixed'
	preview.style.top = '-10000px'
	preview.style.left = '-10000px'
	preview.style.width = `${rect.width}px`
	preview.style.maxWidth = `${rect.width}px`
	preview.style.pointerEvents = 'none'
	preview.style.opacity = '0.96'
	preview.style.transform = 'rotate(1deg) scale(0.99)'
	preview.style.boxShadow = '0 4px 8px rgba(44, 68, 59, 0.12), 0 18px 30px rgba(44, 68, 59, 0.2)'
	document.body.appendChild(preview)
	const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
	const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
	event.dataTransfer.setDragImage(preview, offsetX, offsetY)
	window.setTimeout(() => preview.remove(), 0)
}

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
	const {
		isSidebarOpen,
		setIsSidebarOpen,
		isSidebarCollapsed,
		setIsSidebarCollapsed,
	} = useWorkspaceNavigation()

	useEffect(() => {
		if (!isSidebarOpen) return undefined
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') setIsSidebarOpen(false)
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [isSidebarOpen, setIsSidebarOpen])
	const [boards, setBoards] = useState([])
	const [selectedBoard, setSelectedBoard] = useState(null)
	const [columns, setColumns] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isCreatingBoard, setIsCreatingBoard] = useState(false)
	const [isCreatingColumn, setIsCreatingColumn] = useState(false)
	const [activeTaskColumn, setActiveTaskColumn] = useState(null)
	const [newBoardName, setNewBoardName] = useState('')
	const [newBoardVisibility, setNewBoardVisibility] = useState('private')
	const [isPublicBoardConfirmOpen, setIsPublicBoardConfirmOpen] = useState(false)
	const [isVisibilityOpen, setIsVisibilityOpen] = useState(false)
	const [visibilityDraft, setVisibilityDraft] = useState('private')
	const [isPublicVisibilityConfirmOpen, setIsPublicVisibilityConfirmOpen] = useState(false)
	const [boardNameDraft, setBoardNameDraft] = useState('')
	const [isEditingBoardName, setIsEditingBoardName] = useState(false)
	const [newColumnTitle, setNewColumnTitle] = useState('')
	const [newTaskTitle, setNewTaskTitle] = useState('')
	const [boardMembers, setBoardMembers] = useState([])
	const [boardMemberRecords, setBoardMemberRecords] = useState([])
	const [boardInvites, setBoardInvites] = useState([])
	const [inviteLink, setInviteLink] = useState(null)
	const [publicBoardLink, setPublicBoardLink] = useState('')
	const [boardActivities, setBoardActivities] = useState([])
	const [isActivityLoading, setIsActivityLoading] = useState(false)
	const [presenceByUserId, setPresenceByUserId] = useState({})
	const [realtimeStatus, setRealtimeStatus] = useState(
		isDevAuthBypass ? 'connected' : 'connecting',
	)
	const [selectedAssignees, setSelectedAssignees] = useState([])
	const [editingTask, setEditingTask] = useState(null)
	const [editingTitle, setEditingTitle] = useState('')
	const [draggedTask, setDraggedTask] = useState(null)
	const [draggedColumn, setDraggedColumn] = useState(null)
	const [columnDropTarget, setColumnDropTarget] = useState(null)
	const [draggedTaskHeight, setDraggedTaskHeight] = useState(null)
	const columnDragSessionRef = useRef(null)
	const columnDragOverlayRef = useRef(null)
	const [dropIndicator, setDropIndicator] = useState(null)
	const [taskDetails, setTaskDetails] = useState(null)
	const [taskActivities, setTaskActivities] = useState([])
	const [taskComment, setTaskComment] = useState('')
	const [isTimerRunning, setIsTimerRunning] = useState(false)
	const [trackedSeconds, setTrackedSeconds] = useState(0)
	const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false)
	const [newChecklistItem, setNewChecklistItem] = useState('')
	const [taskDetailsForm, setTaskDetailsForm] = useState({
		title: '',
		description: '',
		dueDate: '',
		assignees: [],
		labels: [],
		checklist: [],
		columnId: '',
	})
	const [isInviteOpen, setIsInviteOpen] = useState(false)
	const [inviteEmail, setInviteEmail] = useState('')
	const [isDeleteBoardOpen, setIsDeleteBoardOpen] = useState(false)
	const [isDeleteBoardArmed, setIsDeleteBoardArmed] = useState(false)
	const [deleteConfirmation, setDeleteConfirmation] = useState('')
	const [isLeaveBoardOpen, setIsLeaveBoardOpen] = useState(false)
	const [isLeaveBoardArmed, setIsLeaveBoardArmed] = useState(false)
	const [leaveConfirmation, setLeaveConfirmation] = useState('')
	const [isLeavingBoard, setIsLeavingBoard] = useState(false)
	const [isRoomActionsOpen, setIsRoomActionsOpen] = useState(false)
	const [ownershipTransferTarget, setOwnershipTransferTarget] = useState(null)
	const [ownershipConfirmation, setOwnershipConfirmation] = useState('')
	const [removeMemberTarget, setRemoveMemberTarget] = useState(null)
	const [deleteColumnTarget, setDeleteColumnTarget] = useState(null)
	const [deleteTaskTarget, setDeleteTaskTarget] = useState(null)
	const [openColumnMenuId, setOpenColumnMenuId] = useState(null)
	const [editingColumn, setEditingColumn] = useState(null)
	const [editingColumnTitle, setEditingColumnTitle] = useState('')
	const [columnSortBy, setColumnSortBy] = useState({}) // { columnId: 'sortType' }
	const [sortSubmenuOpen, setSortSubmenuOpen] = useState(null) // null or columnId
	const isBoardContentLoading = isLoading || Boolean(
		selectedBoard && !isDevAuthBypass && isRefreshing && columns.length === 0,
	)

	const toggleColumnPin = async (columnId) => {
		const column = columns.find((item) => item._id === columnId)
		if (!column) return
		const nextPinned = !column.pinned
		try {
			const { data } = await axiosInstance.patch(
				`/board/columns/${columnId}`,
				{ pinned: nextPinned },
			)
			setColumns((current) =>
				current.map((item) =>
					item._id === columnId
						? { ...item, pinned: data.pinned }
						: item,
				),
			)
			toast.success(nextPinned ? 'List pinned' : 'List unpinned')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not update pinned list')
		}
	}

	const refreshBoard = async (board) => {
		if (!board) return
		setIsRefreshing(true)
		if (isDevAuthBypass) {
			setColumns(devColumns)
			setIsRefreshing(false)
			return
		}
		try {
			const loadedColumns = await fetchColumns(board._id)
			setColumns(
				loadedColumns.map((column) => ({
					...column,
					tasks: sortTasks(column.tasks, column.sortBy || 'custom'),
				})),
			)
			setColumnSortBy(
				Object.fromEntries(
					loadedColumns.map((column) => [column._id, column.sortBy || 'custom']),
				),
			)
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not load this board')
		} finally {
			setIsRefreshing(false)
		}
	}

	const moveColumn = useCallback(async (column, targetColumnOrId, requestedIndex = null) => {
		if (!column) {
			setDraggedColumn(null)
			return
		}
		const previousColumns = columns
		const sourceIndex = columns.findIndex((item) => item._id === column._id)
		if (sourceIndex < 0) return
		const remainingColumns = columns.filter((item) => item._id !== column._id)
		const targetId = typeof targetColumnOrId === 'string'
			? targetColumnOrId
			: targetColumnOrId?._id
		const targetIndex = remainingColumns.findIndex((item) => item._id === targetId)
		const insertionIndex = requestedIndex === null
			? Math.max(0, Math.min(targetIndex < 0 ? remainingColumns.length : targetIndex, remainingColumns.length))
			: Math.max(0, Math.min(requestedIndex, remainingColumns.length))
		const reorderedColumns = reorderColumns(columns, column._id, insertionIndex)
		setColumns(reorderedColumns.map((item, index) => ({ ...item, position: index })))
		setDraggedColumn(null)
		if (isDevAuthBypass) return
		try {
			const { data } = await axiosInstance.patch(`/board/columns/${column._id}/position`, {
				position: insertionIndex,
			})
			setColumns((current) =>
				data.map((updatedColumn) => ({
					...updatedColumn,
					tasks: current.find((item) => item._id === updatedColumn._id)?.tasks || [],
				})),
			)
		} catch (error) {
			setColumns(previousColumns)
			toast.error(error.response?.data?.message || 'Could not reorder column')
		}
	}, [columns])

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
				setIsActivityLoading(Boolean(activeBoard))
				setBoardNameDraft(activeBoard?.name || '')
				setIsEditingBoardName(false)
				setBoardMembers(devBoardMembers)
				setBoardMemberRecords(devBoardMembers)
				setBoardInvites(devBoardInvites)
				if (boardId === devBoard._id) setColumns(devColumns)
				setIsLoading(false)
				return
			}
			try {
				const data = await fetchBoardsWithCache()
				setBoards(data)
				const nextBoard = boardId
					? data.find((board) => board._id === boardId)
					: null
				setSelectedBoard(nextBoard)
				setIsActivityLoading(Boolean(nextBoard))
				setBoardNameDraft(nextBoard?.name || '')
				setIsEditingBoardName(false)
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
		if (!selectedBoard || isDevAuthBypass) return
		let isCurrent = true
		const loadSelectedBoard = async () => {
			setIsRefreshing(true)
			try {
				const nextColumns = await fetchColumns(selectedBoard._id)
					if (isCurrent) {
						setColumns(
							nextColumns.map((column) => ({
								...column,
								tasks: sortTasks(
									column.tasks,
									column.sortBy || 'custom',
								),
							})),
						)
						setColumnSortBy(
							Object.fromEntries(
								nextColumns.map((column) => [column._id, column.sortBy || 'custom']),
							),
						)
					}
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
	}, [selectedBoard, authUser?._id, navigate])

	useEffect(() => {
		if (!draggedTask) return undefined
		const handleDragOver = (event) => {
			event.dataTransfer.dropEffect = 'move'
			const targetElement =
				event.target instanceof Element
					? event.target
					: event.target.parentElement
			const columnElement = targetElement?.closest('.kanban-column')
			if (!columnElement) return

			document
				.querySelectorAll('.task-card.drop-before, .task-card.drop-after')
				.forEach((item) => item.classList.remove('drop-before', 'drop-after'))

			const targetColumn = columns.find(
				(column) => column._id === columnElement.dataset.columnId,
			)
			if (!targetColumn) return

			const taskList = columnElement.querySelector('.task-list')
			if (!taskList) return

			const taskListRect = taskList.getBoundingClientRect()
			const edgeDistance = 56
			if (event.clientY < taskListRect.top + edgeDistance) {
				taskList.scrollTop -= Math.max(6, (taskListRect.top + edgeDistance - event.clientY) / 3)
			} else if (event.clientY > taskListRect.bottom - edgeDistance) {
				taskList.scrollTop += Math.max(6, (event.clientY - taskListRect.bottom + edgeDistance) / 3)
			}

			const draggedId = draggedTask?._id
			const cards = Array.from(taskList.querySelectorAll('.task-card')).filter(
				(card) => card.dataset?.taskId !== draggedId,
			)
			const currentCard = targetElement?.closest('.task-card')
			const isSelfCard = currentCard?.dataset?.taskId === draggedId
			if (currentCard && !isSelfCard && currentCard.closest('.task-list') === taskList) {
				const taskIndex = cards.indexOf(currentCard)
				const rect = currentCard.getBoundingClientRect()
				const isBefore = event.clientY < rect.top + rect.height / 2
				currentCard.classList.add(isBefore ? 'drop-before' : 'drop-after')
				setDropIndicator({
					columnId: targetColumn._id,
					index: taskIndex + (isBefore ? 0 : 1),
				})
				return
			}

			if (cards.length === 0) {
				setDropIndicator({
					columnId: targetColumn._id,
					index: 0,
				})
				return
			}

			let insertionIndex = 0
			let beforeCard = null
			for (const listCard of cards) {
				const rect = listCard.getBoundingClientRect()
				if (event.clientY < rect.top + rect.height / 2) {
					beforeCard = listCard
					break
				}
				insertionIndex += 1
			}
			if (beforeCard) {
				beforeCard.classList.add('drop-before')
				setDropIndicator({
					columnId: targetColumn._id,
					index: insertionIndex,
				})
				return
			}

			setDropIndicator({
				columnId: targetColumn._id,
				index: cards.length,
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
		const handlePointerMove = (event) => {
			const session = columnDragSessionRef.current
			if (!session || event.pointerId !== session.pointerId) return
			const distance = Math.hypot(
				event.clientX - session.startX,
				event.clientY - session.startY,
			)
			if (!session.active && distance < 6) return
			if (!session.active) {
				session.active = true
				setDraggedColumn(session.column)
			}
			event.preventDefault()
			let preview = columnDragOverlayRef.current
			if (!preview) {
				preview = session.element.cloneNode(true)
				preview.classList.remove('is-dragging', 'column-drop-target')
				preview.classList.add('drag-preview', 'drag-preview-column', 'column-drag-dom-preview')
				preview.dataset.dragPreview = 'true'
				preview.setAttribute('aria-hidden', 'true')
				preview.style.pointerEvents = 'none'
				preview.style.opacity = '1'
				preview.style.zIndex = '100'
				preview.style.boxShadow = '0 8px 16px rgba(44, 68, 59, 0.14), 0 24px 42px rgba(44, 68, 59, 0.22)'
				document.body.appendChild(preview)
				columnDragOverlayRef.current = preview
			}
			Object.assign(preview.style, {
				width: `${session.width}px`,
				height: `${session.height}px`,
				left: `${event.clientX}px`,
				top: `${event.clientY}px`,
				transform: `translate(-${session.grabOffsetX}px, -${session.grabOffsetY}px) rotate(1deg)`,
			})
			if (!session.pinned) {
				const movableColumns = columns.filter((column) => !column.pinned)
				const centers = Object.fromEntries(
					movableColumns.map((column) => {
						const element = document.querySelector(
							`.kanban-column[data-column-id="${column._id}"]:not([data-drag-preview="true"])`,
						)
						const rect = element?.getBoundingClientRect()
						return [column._id, rect ? rect.left + rect.width / 2 : Number.POSITIVE_INFINITY]
					}),
				)
				const normalizedIndex = getColumnInsertionIndex(
					movableColumns,
					session.column._id,
					centers,
					event.clientX,
				)
				const remainingMovable = movableColumns.filter((column) => column._id !== session.column._id)
				const targetId = remainingMovable[normalizedIndex]?._id || null
				const remainingColumns = columns.filter((column) => column._id !== session.column._id)
				const sourceMovableIndex = movableColumns.findIndex(
					(column) => column._id === session.column._id,
				)
				const targetMovableIndex = movableColumns.findIndex(
					(column) => column._id === targetId,
				)
				const movingRight = targetId && sourceMovableIndex < targetMovableIndex
				const rawIndex = targetId
					? remainingColumns.findIndex((column) => column._id === targetId) + (movingRight ? 1 : 0)
					: remainingColumns.length
				if (session.targetIndex !== rawIndex) {
					session.targetIndex = rawIndex
					session.targetId = targetId
					setColumnDropTarget(targetId)
				}
			}
		}
		const handlePointerUp = () => {
			const session = columnDragSessionRef.current
			if (
				session?.active &&
				!session.pinned &&
				Number.isInteger(session.targetIndex)
			) {
				void moveColumn(session.column, session.targetId, session.targetIndex)
			}
			columnDragOverlayRef.current?.remove()
			columnDragOverlayRef.current = null
			document.querySelectorAll('.column-drag-dom-preview').forEach((node) => node.remove())
			columnDragSessionRef.current = null
			setDraggedColumn(null)
			setColumnDropTarget(null)
		}
		const handleLostPointerCapture = () => {
			if (columnDragSessionRef.current) handlePointerUp()
		}
		window.addEventListener('pointermove', handlePointerMove, { passive: false })
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerUp)
		window.addEventListener('blur', handlePointerUp)
		document.addEventListener('visibilitychange', handlePointerUp)
		document.addEventListener('lostpointercapture', handleLostPointerCapture)
		return () => {
			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerUp)
			window.removeEventListener('blur', handlePointerUp)
			document.removeEventListener('visibilitychange', handlePointerUp)
			document.removeEventListener('lostpointercapture', handleLostPointerCapture)
			columnDragOverlayRef.current?.remove()
			columnDragOverlayRef.current = null
			document.querySelectorAll('.column-drag-dom-preview').forEach((node) => node.remove())
			setColumnDropTarget(null)
		}
	}, [columns, moveColumn])

	useEffect(() => {
		if (!selectedBoard || isDevAuthBypass) return
		const socket = io(socketUrl, {
			withCredentials: true,
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 500,
			reconnectionDelayMax: 5000,
			timeout: 8000,
		})
		const heartbeat = () => socket.emit('presence-heartbeat')
		socket.on('connect', () => {
			setRealtimeStatus('connected')
			socket.emit('join-board', selectedBoard._id)
			heartbeat()
		})
		socket.on('disconnect', () => setRealtimeStatus('reconnecting'))
		socket.on('connect_error', () => setRealtimeStatus('reconnecting'))
		socket.io.on('reconnect_attempt', () => setRealtimeStatus('reconnecting'))
		socket.io.on('reconnect_failed', () => setRealtimeStatus('offline'))
		socket.on('board:presence', (presence) => {
			setPresenceByUserId(
				Object.fromEntries(presence.map((item) => [item.userId, item.status])),
			)
		})
		socket.on('board:access-revoked', ({ boardId: revokedBoardId }) => {
			if (revokedBoardId !== selectedBoard._id) return
			socket.io.opts.reconnection = false
			setRealtimeStatus('offline')
			setPresenceByUserId({})
			setColumns([])
			setBoardMembers([])
			setBoardMemberRecords([])
			setBoardInvites([])
			setBoardActivities([])
			setBoards((current) => current.filter((board) => board._id !== revokedBoardId))
			setSelectedBoard(null)
			navigate('/workspaces')
			toast.error('You no longer have access to this room')
			socket.disconnect()
		})
		socket.on('activity:new', (activity) => {
			setBoardActivities((current) => [
				activity,
				...current.filter((item) => item._id !== activity._id),
			].slice(0, 200))
		})
		socket.on('board:updated', (updatedBoard) => {
			if (updatedBoard._id !== selectedBoard._id) return
			setSelectedBoard((current) =>
				current ? { ...current, ...updatedBoard } : current,
			)
			setBoards((current) =>
				current.map((board) =>
					board._id === updatedBoard._id
						? { ...board, ...updatedBoard }
						: board,
				),
			)
			setBoardNameDraft(updatedBoard.name || '')
		})
		const heartbeatTimer = window.setInterval(heartbeat, 20_000)
		socket.on('task:created', (task) => {
			setColumns((current) =>
				current.map((column) =>
					column._id === task.column
						? {
								...column,
								tasks: sortTasks(
									column.tasks.some((item) => item._id === task._id)
										? column.tasks
										: [...column.tasks, task],
									column.sortBy || 'custom',
									),
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
								tasks: sortTasks(
									[...withoutTask, task],
									column.sortBy || 'custom',
								),
							}
						: { ...column, tasks: withoutTask }
				}),
			)
		})
		socket.on('task:deleted', ({ taskId }) => {
			setColumns((current) =>
				current.map((column) => ({
					...column,
					tasks: column.tasks.filter((task) => task._id !== taskId),
				})),
			)
			setTaskDetails((current) => (current?._id === taskId ? null : current))
			setDeleteTaskTarget((current) =>
				current?._id === taskId ? null : current,
			)
		})
		socket.on('column:tasks-reordered', ({ columnId, tasks }) => {
			setColumns((current) =>
				current.map((column) =>
					column._id === columnId
						? { ...column, tasks: sortTasks(tasks, column.sortBy || 'custom') }
						: column,
				),
			)
		})
		socket.on('column:updated', (updatedColumn) => {
			setColumns((current) =>
				current.map((column) =>
					column._id === updatedColumn._id
						? { ...column, ...updatedColumn }
						: column,
				),
			)
		})
		socket.on('column:sort-updated', (updatedColumn) => {
			const sortType = updatedColumn.sortBy || 'custom'
			setColumnSortBy((current) => ({ ...current, [updatedColumn._id]: sortType }))
			setColumns((current) =>
				current.map((column) =>
					column._id === updatedColumn._id
						? { ...column, ...updatedColumn, tasks: sortTasks(column.tasks, sortType) }
						: column,
				),
			)
		})
		socket.on('column:deleted', ({ columnId }) => {
			setColumns((current) => current.filter((column) => column._id !== columnId))
			setActiveTaskColumn((current) => (current === columnId ? null : current))
			setOpenColumnMenuId((current) => (current === columnId ? null : current))
			setEditingColumn((current) =>
				current?._id === columnId ? null : current,
			)
		})
		socket.on('columns:reordered', ({ columns: reorderedColumns }) => {
			setColumns((current) =>
				reorderedColumns.map((column) => ({
					...column,
					tasks: current.find((item) => item._id === column._id)?.tasks || [],
				})),
			)
		})
		return () => {
			setPresenceByUserId({})
			setRealtimeStatus('offline')
			window.clearInterval(heartbeatTimer)
			socket.disconnect()
		}
	}, [selectedBoard, authUser?._id, navigate])

	useEffect(() => {
		if (!selectedBoard) return
		if (isDevAuthBypass) return
		Promise.allSettled([
			axiosInstance.get(`/board/boards/${selectedBoard._id}/members`),
			axiosInstance.get(`/board/boards/${selectedBoard._id}/invites`),
			axiosInstance.get(`/board/boards/${selectedBoard._id}/activity`),
		])
			.then(([membersResult, invitesResult, activitiesResult]) => {
				if (membersResult.status === 'fulfilled') {
					setBoardMembers(membersResult.value.data.map((member) => member.user))
					setBoardMemberRecords(membersResult.value.data)
				}
				if (invitesResult.status === 'fulfilled') {
					setBoardInvites(invitesResult.value.data)
				}
				if (activitiesResult.status === 'fulfilled') {
					setBoardActivities(activitiesResult.value.data)
				}
			})
			.finally(() => setIsActivityLoading(false))
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
				visibility: newBoardVisibility,
			}
			setBoards((current) => {
				const nextBoards = [...current, board]
				localStorage.setItem('kanban-dev-boards', JSON.stringify(nextBoards.filter((item) => item._id !== devBoard._id)))
				return nextBoards
			})
			setSelectedBoard(board)
			setBoardNameDraft(board.name)
			setIsEditingBoardName(false)
			navigate(`/workspaces/${board._id}`)
			setColumns([])
			setNewBoardName('')
			setNewBoardVisibility('private')
			setIsCreatingBoard(false)
			toast.success('Demo board created locally')
			return
		}
		try {
			const { data } = await axiosInstance.post('/board/boards', {
				name: newBoardName.trim(),
				visibility: newBoardVisibility,
			})
			setBoards((current) => [data, ...current])
			setSelectedBoard(data)
			setIsActivityLoading(true)
			setBoardNameDraft(data.name)
			setIsEditingBoardName(false)
			navigate(`/workspaces/${data._id}`)
			setNewBoardName('')
			setNewBoardVisibility('private')
			setIsCreatingBoard(false)
			toast.success('Board created')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not create board')
		}
	}

	const handleBoardVisibilityChange = (event) => {
		if (event.target.value === 'public') {
			setIsPublicBoardConfirmOpen(true)
			return
		}
		setNewBoardVisibility(event.target.value)
	}

	const closePublicBoardConfirmation = () => setIsPublicBoardConfirmOpen(false)

	const confirmPublicBoard = () => {
		setNewBoardVisibility('public')
		setIsPublicBoardConfirmOpen(false)
	}

	const saveBoardVisibility = async (visibility) => {
		if (!selectedBoard) return
		if (isDevAuthBypass) {
			setSelectedBoard((current) => current ? { ...current, visibility } : current)
			setBoards((current) => current.map((board) => board._id === selectedBoard._id ? { ...board, visibility } : board))
			setBoardInvites([])
			setInviteLink(null)
			setVisibilityDraft(visibility)
			setIsVisibilityOpen(false)
			toast.success('Room visibility updated')
			return
		}
		try {
			const { data } = await axiosInstance.patch(`/board/boards/${selectedBoard._id}`, { visibility })
			setSelectedBoard((current) => current ? { ...current, ...data } : current)
			setBoards((current) => current.map((board) => board._id === selectedBoard._id ? { ...board, ...data } : board))
			setBoardInvites([])
			setInviteLink(null)
			setVisibilityDraft(visibility)
			if (visibility !== 'public') setPublicBoardLink('')
			setIsVisibilityOpen(false)
			toast.success('Room visibility updated')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not update room visibility')
		}
	}

	const requestVisibilityChange = (visibility) => {
		if (visibility === visibilityDraft) return
		if (visibility === 'public') {
			setIsPublicVisibilityConfirmOpen(true)
			return
		}
		void saveBoardVisibility(visibility)
	}

	const selectBoard = (board) => {
		setSelectedBoard(board)
		setColumns([])
		setInviteLink(null)
		setIsActivityLoading(true)
		setBoardActivities([])
		setBoardNameDraft(board.name || '')
		setIsEditingBoardName(false)
		setPublicBoardLink('')
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

	const loadInviteLink = async (board = selectedBoard) => {
		if (!board || isDevAuthBypass) return
		try {
			const { data } = await axiosInstance.get(`/board/boards/${board._id}/invites/link`)
			setInviteLink(data)
		} catch (error) {
			if (error.response?.status === 404) setInviteLink(null)
		}
	}

	const inviteMember = async (event, mode = 'email', role = 'member') => {
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
				{ email: mode === 'email' ? inviteEmail.trim() : '', role },
			)
			setInviteEmail('')
			if (mode === 'email') setIsInviteOpen(false)
			if (mode === 'link') await copyInviteUrl(data.inviteUrl)
			const { data: invites } = await axiosInstance.get(
				`/board/boards/${selectedBoard._id}/invites`,
			)
			setBoardInvites(invites)
			if (mode === 'link') {
				await loadInviteLink()
				setIsInviteOpen(true)
			}
			if (mode === 'email') {
				toast[data.emailSent ? 'success' : 'warning'](
					data.emailSent
						? 'Invite email sent'
						: 'Invitation created, but the email could not be sent',
				)
			} else {
				toast.success('Invite link created and copied')
			}
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not invite member')
		}
	}

	const revokeInviteLink = async () => {
		if (!selectedBoard || !inviteLink?.inviteId) return
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/invites/${inviteLink.inviteId}`)
			setInviteLink(null)
			setBoardInvites((current) => current.filter((invite) => invite._id !== inviteLink.inviteId))
			toast.success('Invite link revoked')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not revoke invite link')
		}
	}

	const revokeInvite = async (invite) => {
		if (!selectedBoard || !invite?._id) return
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/invites/${invite._id}`)
			setBoardInvites((current) => current.filter((item) => item._id !== invite._id))
			toast.success(`Invitation for ${invite.email} revoked`)
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not revoke invitation')
		}
	}

	useEffect(() => {
		if (!selectedBoard || isDevAuthBypass) return undefined
		const canManage = selectedBoard.access === 'owned' || selectedBoard.role === 'admin'
		if (!canManage) return undefined
		let isCurrent = true
		axiosInstance
			.get(`/board/boards/${selectedBoard._id}/invites/link`)
			.then(({ data }) => {
				if (isCurrent) setInviteLink(data)
			})
			.catch((error) => {
				if (isCurrent && error.response?.status === 404) setInviteLink(null)
			})
		return () => {
			isCurrent = false
		}
	}, [selectedBoard, authUser?._id])

	useEffect(() => {
		if (!selectedBoard || selectedBoard.visibility !== 'public' || isDevAuthBypass) {
			return undefined
		}
		const canManage = selectedBoard.access === 'owned' || selectedBoard.role === 'admin'
		if (!canManage) return undefined
		let isCurrent = true
		axiosInstance
			.get(`/board/boards/${selectedBoard._id}/public-link`)
			.then(({ data }) => {
				if (isCurrent) setPublicBoardLink(data.publicUrl)
			})
			.catch((error) => {
				if (isCurrent && error.response?.status === 404) setPublicBoardLink('')
			})
		return () => {
			isCurrent = false
		}
	}, [selectedBoard, authUser?._id])

	const createPublicBoardLink = async () => {
		if (!selectedBoard) return
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/public-link`)
			setPublicBoardLink(data.publicUrl)
			await copyInviteUrl(data.publicUrl)
			toast.success('Public view link copied')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not create public view link')
		}
	}

	const revokePublicBoardLink = async () => {
		if (!selectedBoard) return
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/public-link`)
			setPublicBoardLink('')
			toast.success('Public view link revoked')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not revoke public view link')
		}
	}

	const openDeleteBoardDialog = () => {
		if (!selectedBoard) return
		setDeleteConfirmation('')
		setIsDeleteBoardArmed(false)
		setIsDeleteBoardOpen(true)
	}

	const closeDeleteBoardDialog = () => {
		setIsDeleteBoardOpen(false)
		setIsDeleteBoardArmed(false)
		setDeleteConfirmation('')
	}

	const removeCurrentBoard = async () => {
		if (!selectedBoard) return
		if (deleteConfirmation.trim().toLowerCase() !== 'delete room') {
			toast.error('Enter the phrase “delete room”')
			return
		}

		if (isDevAuthBypass) {
			const remainingBoards = boards.filter(
				(board) => board._id !== selectedBoard._id,
			)
			setBoards(remainingBoards)
			setSelectedBoard(null)
			navigate('/workspaces')
			closeDeleteBoardDialog()
			toast.success('Demo board deleted')
			return
		}

		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}`)
			setBoards((current) =>
				current.filter((board) => board._id !== selectedBoard._id),
			)
			setSelectedBoard(null)
			setColumns([])
			navigate('/workspaces')
			closeDeleteBoardDialog()
			toast.success('Board deleted')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not delete board')
		}
	}

	const leaveCurrentBoard = async () => {
		if (!selectedBoard) return
		if (leaveConfirmation.trim().toLowerCase() !== 'leave room') {
			toast.error('Enter the phrase “leave room”')
			return
		}
		if (isLeavingBoard) return
		setIsLeavingBoard(true)

		if (isDevAuthBypass) {
			setBoards((current) =>
				current.filter((board) => board._id !== selectedBoard._id),
			)
			setSelectedBoard(null)
			navigate('/workspaces')
			setIsLeaveBoardOpen(false)
			setIsLeaveBoardArmed(false)
			setLeaveConfirmation('')
			setIsLeavingBoard(false)
			toast.success('You left the demo board')
			return
		}

		try {
			await axiosInstance.post(`/board/boards/${selectedBoard._id}/leave`)
			setBoards((current) =>
				current.filter((board) => board._id !== selectedBoard._id),
			)
			setSelectedBoard(null)
			setColumns([])
			navigate('/workspaces')
			setIsLeaveBoardOpen(false)
			setIsLeaveBoardArmed(false)
			setLeaveConfirmation('')
			setIsLeavingBoard(false)
			toast.success('You left the board')
		} catch (error) {
			setIsLeavingBoard(false)
			toast.error(error.response?.data?.message || 'Could not leave board')
		}
	}

	const updateMemberRole = async (memberId, role, skipOwnershipPrompt = false) => {
		if (role === 'owner' && !skipOwnershipPrompt) {
			const target = boardMemberRecords.find((member) => member._id === memberId)
			setOwnershipTransferTarget(target || null)
			setOwnershipConfirmation('')
			return
		}
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
			if (data.ownershipTransferred) {
				setBoardMemberRecords((current) =>
					current.map((member) =>
						member._id === memberId
							? data
							: member.user?._id === authUser?._id
								? { ...member, role: 'admin' }
								: member,
					),
				)
				setBoards((current) =>
					current.map((board) =>
						board._id === selectedBoard._id
							? { ...board, createdBy: data.boardOwnerId, access: 'invited', role: 'admin' }
							: board,
					),
				)
				setSelectedBoard((current) =>
					current
						? { ...current, createdBy: data.boardOwnerId, access: 'invited', role: 'admin' }
						: current,
				)
				toast.success('Ownership transferred')
			} else {
				setBoardMemberRecords((current) =>
					current.map((member) => (member._id === memberId ? data : member)),
				)
				toast.success('Member role updated')
			}
		} catch (error) {
			toast.error(
				error.response?.data?.message || 'Could not update member role',
			)
		}
	}

	const removeBoardMember = async (memberId) => {
		if (!selectedBoard || !isBoardOwner) return
		const member = boardMemberRecords.find((record) => record._id === memberId)
		if (!member?.user?._id || String(member.user._id) === String(authUser?._id)) return
		setRemoveMemberTarget(member)
	}

	const closeRemoveMemberDialog = () => setRemoveMemberTarget(null)

	const confirmRemoveMember = async () => {
		if (!selectedBoard || !removeMemberTarget || isDevAuthBypass) {
			if (isDevAuthBypass && removeMemberTarget) {
				setBoardMemberRecords((current) => current.filter((record) => record._id !== removeMemberTarget._id))
				setBoardMembers((current) => current.filter((user) => user._id !== removeMemberTarget.user._id))
				toast.success('Member removed from the demo room')
			}
			closeRemoveMemberDialog()
			return
		}
		const member = removeMemberTarget
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/members/${member._id}`)
			setBoardMemberRecords((current) => current.filter((record) => record._id !== member._id))
			setBoardMembers((current) => current.filter((user) => user._id !== member.user._id))
			toast.success('Member removed from the room')
			closeRemoveMemberDialog()
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not remove member')
		}
	}

	const closeOwnershipTransferDialog = () => {
		setOwnershipTransferTarget(null)
		setOwnershipConfirmation('')
	}

	const confirmOwnershipTransfer = async () => {
		if (!ownershipTransferTarget) return
		if (ownershipConfirmation.trim().toLowerCase() !== 'transfer ownership') {
			toast.error('Enter the phrase “transfer ownership”')
			return
		}
		const targetId = ownershipTransferTarget._id
		closeOwnershipTransferDialog()
		await updateMemberRole(targetId, 'owner', true)
	}

	const openOverviewBoard = (board) => selectBoard(board)

	const deleteColumn = async (columnId) => {
		if (!selectedBoard || isDevAuthBypass) {
			setColumns((current) => current.filter((col) => col._id !== columnId))
			setDeleteColumnTarget(null)
			toast.success('Demo column deleted')
			return
		}

		try {
			await axiosInstance.delete(`/board/columns/${columnId}`)
			setColumns((current) => current.filter((col) => col._id !== columnId))
			setDeleteColumnTarget(null)
			toast.success('Column deleted')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not delete column')
		}
	}

	const deleteTask = async (taskId) => {
		if (!selectedBoard || isDevAuthBypass) {
			setColumns((current) =>
				current.map((column) => ({
					...column,
					tasks: column.tasks.filter((task) => task._id !== taskId),
				})),
			)
			setTaskDetails(null)
			setDeleteTaskTarget(null)
			toast.success('Demo task deleted')
			return
		}

		try {
			await axiosInstance.delete(`/board/tasks/${taskId}`)
			setColumns((current) =>
				current.map((column) => ({
					...column,
					tasks: column.tasks.filter((task) => task._id !== taskId),
				})),
			)
			setTaskDetails(null)
			setDeleteTaskTarget(null)
			toast.success('Task deleted')
		} catch (error) {
			if (error.response?.status === 404) {
				setColumns((current) =>
					current.map((column) => ({
						...column,
						tasks: column.tasks.filter((task) => task._id !== taskId),
					})),
				)
				setTaskDetails(null)
				setDeleteTaskTarget(null)
				toast.info('Task was already deleted')
				return
			}
			toast.error(error.response?.data?.message || 'Could not delete task')
		}
	}

	const updateColumn = async (columnId) => {
		if (!editingColumnTitle.trim()) {
			setEditingColumn(null)
			return
		}

		if (editingColumnTitle === editingColumn.title) {
			setEditingColumn(null)
			return
		}

		if (isDevAuthBypass) {
			setColumns((current) =>
				current.map((col) =>
					col._id === columnId
						? { ...col, title: editingColumnTitle.trim() }
						: col,
				),
			)
			setEditingColumn(null)
			toast.success('Demo column renamed')
			return
		}

		try {
			const { data } = await axiosInstance.patch(
				`/board/columns/${columnId}`,
				{ title: editingColumnTitle.trim() },
			)
			setColumns((current) =>
				current.map((col) =>
					col._id === columnId ? { ...col, title: data.title } : col,
				),
			)
			setEditingColumn(null)
			toast.success('Column renamed')
		} catch (error) {
			setEditingColumn(null)
			toast.error(error.response?.data?.message || 'Could not rename column')
		}
	}

	const sortColumnTasks = async (columnId, sortType) => {
		const previousColumn = columns.find((column) => column._id === columnId)
		const previousSort = previousColumn?.sortBy || columnSortBy[columnId] || 'custom'
		setColumns((current) =>
			current.map((col) => {
				if (col._id !== columnId) return col
				return { ...col, sortBy: sortType, tasks: sortTasks(col.tasks, sortType) }
			}),
		)
		setColumnSortBy((prev) => ({ ...prev, [columnId]: sortType }))
		setOpenColumnMenuId(null)
		setSortSubmenuOpen(null)
		if (isDevAuthBypass) {
			saveLocalSorts(selectedBoard._id, authUser?._id, {
				...readLocalSorts(selectedBoard._id, authUser?._id),
				[columnId]: sortType,
			})
			toast.success('Tasks sorted')
			return
		}
		try {
			const { data } = await axiosInstance.patch(`/board/columns/${columnId}/sort`, {
				sortBy: sortType,
			})
			setColumns((current) =>
				current.map((column) =>
					column._id === columnId
						? { ...column, ...data, tasks: sortTasks(column.tasks, data.sortBy || 'custom') }
						: column,
				),
			)
		} catch (error) {
			setColumnSortBy((current) => ({ ...current, [columnId]: previousSort }))
			setColumns((current) =>
				current.map((column) =>
					column._id === columnId
						? { ...column, sortBy: previousSort, tasks: sortTasks(column.tasks, previousSort) }
						: column,
				),
			)
			toast.error(error.response?.data?.message || 'Could not save task sorting')
			return
		}
		toast.success('Tasks sorted')
	}

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
						? {
								...item,
								tasks: item.tasks.some((task) => task._id === data._id)
									? item.tasks
									: [...item.tasks, data],
							}
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
		const taskColumn = columns.find((column) =>
			column.tasks.some((item) => item._id === task._id),
		)
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
			columnId: taskColumn?._id || '',
		})
		setIsAssigneePickerOpen(false)
		setNewChecklistItem('')
		setTaskComment('')
		setTrackedSeconds(task.trackedSeconds || 0)
		setIsTimerRunning(Boolean(task.timerStartedAt))
		setIsActivityLoading(true)
		axiosInstance
			.get(`/board/tasks/${task._id}/activities`)
			.then(({ data }) => setTaskActivities(data))
			.catch(() => setTaskActivities([]))
			.finally(() => setIsActivityLoading(false))
	}

	const addTaskComment = async () => {
		const message = taskComment.trim()
		if (!taskDetails || !message) return
		try {
			const { data } = await axiosInstance.post(`/board/tasks/${taskDetails._id}/comments`, { message })
			setTaskActivities((current) => [data, ...current])
			setTaskComment('')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not add comment')
		}
	}

	const toggleTaskTimer = async () => {
		if (!taskDetails) return
		try {
			if (isTimerRunning) {
				const { data } = await axiosInstance.post(`/board/tasks/${taskDetails._id}/timer/stop`)
				setTrackedSeconds(data.trackedSeconds)
				setIsTimerRunning(false)
				setTaskActivities((current) => [data.activity, ...current])
			} else {
				const { data } = await axiosInstance.post(`/board/tasks/${taskDetails._id}/timer/start`)
				setTrackedSeconds(data.trackedSeconds)
				setIsTimerRunning(true)
			}
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not update task timer')
		}
	}

	const formatTrackedTime = (seconds) => {
		const minutes = Math.floor(seconds / 60)
		return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
	}

	const toggleTaskAssignee = (memberId) => {
		setTaskDetailsForm((current) => ({
			...current,
			assignees: current.assignees.includes(memberId)
				? current.assignees.filter((id) => id !== memberId)
				: [...current.assignees, memberId],
		}))
	}

	const addChecklistItem = (event) => {
		event.preventDefault()
		const text = newChecklistItem.trim()
		if (!text) return
		setTaskDetailsForm((current) => ({
			...current,
			checklist: [...current.checklist, { text, completed: false }],
		}))
		setNewChecklistItem('')
	}

	const updateChecklistItem = (index, changes) => {
		setTaskDetailsForm((current) => ({
			...current,
			checklist: current.checklist.map((item, itemIndex) =>
				itemIndex === index ? { ...item, ...changes } : item,
			),
		}))
	}

	const removeChecklistItem = (index) => {
		setTaskDetailsForm((current) => ({
			...current,
			checklist: current.checklist.filter((_, itemIndex) => itemIndex !== index),
		}))
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
			column: taskDetailsForm.columnId,
		}
		const sourceColumn = columns.find((column) =>
			column.tasks.some((task) => task._id === taskDetails._id),
		)
		const targetColumn = columns.find(
			(column) => column._id === taskDetailsForm.columnId,
		)
		const isMovingColumns = sourceColumn && targetColumn && sourceColumn._id !== targetColumn._id
		if (isMovingColumns) changes.position = targetColumn.tasks.length

		if (isDevAuthBypass) {
			setColumns((current) => {
				const updatedTask = { ...taskDetails, ...changes }
				const withoutTask = current.map((column) => ({
					...column,
					tasks: column.tasks.filter((task) => task._id !== taskDetails._id),
				}))
				return withoutTask.map((column) =>
					column._id === (targetColumn?._id || sourceColumn?._id)
						? { ...column, tasks: [...column.tasks, updatedTask] }
						: column,
				)
			})
			setTaskDetails(null)
			return
		}

		try {
			const { data } = await axiosInstance.patch(
				`/board/tasks/${taskDetails._id}`,
				changes,
			)
			setColumns((current) => {
				const withoutTask = current.map((column) => ({
					...column,
					tasks: column.tasks.filter((task) => task._id !== data._id),
				}))
				return withoutTask.map((column) =>
					column._id === (targetColumn?._id || sourceColumn?._id)
						? { ...column, tasks: [...column.tasks, data] }
						: column,
				)
			})
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
		const previousSortBy = columnSortBy
		const requestedIndex =
			dropIndicator?.columnId === targetColumn._id
				? dropIndicator.index
				: targetIndex
		const sourceIndex = sourceColumn.tasks.findIndex(
			(item) => item._id === task._id,
		)
		const hasDropIndicator = dropIndicator?.columnId === targetColumn._id
		const insertionIndex =
			sourceColumn._id === targetColumn._id && !hasDropIndicator && requestedIndex > sourceIndex
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
		const reorderedColumns = columns.map((column) => {
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
					// Set sortBy to 'custom' when user manually moves a task
					sortBy: 'custom',
					tasks: nextTasks.map((item, index) => ({ ...item, position: index })),
				}
		})
		setColumns(reorderedColumns)
		const affectedColumnIds = [targetColumn._id]
		if (sourceColumn._id !== targetColumn._id) affectedColumnIds.push(sourceColumn._id)
		setColumnSortBy((prev) => {
			const next = { ...prev }
			affectedColumnIds.forEach((columnId) => {
				next[columnId] = 'custom'
			})
			if (isDevAuthBypass) saveLocalSorts(selectedBoard._id, authUser?._id, next)
			return next
		})
		setDraggedTask(null)
		setDropIndicator(null)
		if (isDevAuthBypass) return
		try {
			await axiosInstance.patch(`/board/boards/${selectedBoard._id}/tasks/reorder`, {
				columns: affectedColumnIds.map((columnId) => ({
					columnId,
					taskIds: reorderedColumns.find((column) => column._id === columnId)
						?.tasks.map((item) => item._id) || [],
				})),
			})
		} catch (error) {
			setColumns(previousColumns)
			setColumnSortBy(previousSortBy)
			toast.error(error.response?.data?.message || 'Could not move task')
		}
	}

	const visibleColumns = columns
		.filter((column) => column.pinned)
		.concat(columns.filter((column) => !column.pinned))

	const isBoardOwner = selectedBoard?.createdBy === authUser?._id
	const canEditBoardName = isBoardOwner || selectedBoard?.role === 'admin'

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
				<WorkspaceTopbar
					isSidebarOpen={isSidebarOpen}
					onSidebarToggle={() => setIsSidebarOpen((value) => !value)}
					isSidebarCollapsed={isSidebarCollapsed}
					onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}
					realtimeStatus={selectedBoard?._id ? realtimeStatus : null}
					onInvite={selectedBoard ? () => setIsInviteOpen(true) : null}
					onVisibilityChange={
						selectedBoard && (isBoardOwner || selectedBoard.role === 'admin')
							? () => {
									setVisibilityDraft(selectedBoard.visibility || 'private')
									setIsVisibilityOpen(true)
							  }
							: null
					}
					boardVisibility={selectedBoard?.visibility}
					activities={boardActivities}
					activityLoading={isActivityLoading}
				>
							<div className='workspace-context-copy'>
										<div className='workspace-context-label'>Workspace</div>
								<div className='workspace-board-title-row'>
											<span
												className={`workspace-board-name ${canEditBoardName ? 'is-editable' : ''}`}
												title={selectedBoard?.name || 'Room'}
												onClick={() => canEditBoardName && setIsEditingBoardName(true)}
												onKeyDown={(event) => {
													if (canEditBoardName && (event.key === 'Enter' || event.key === ' ')) {
														event.preventDefault()
														setIsEditingBoardName(true)
													}
												}}
												tabIndex={canEditBoardName ? 0 : undefined}
												role={canEditBoardName ? 'button' : undefined}
											>
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
													<span className='workspace-board-name-text'>
														{selectedBoard?.name || 'Rooms'}
													</span>
										)}
									</span>
									{selectedBoard && !isEditingBoardName && (
										<Popover
											isOpen={isRoomActionsOpen}
											onClose={() => setIsRoomActionsOpen(false)}
											className='room-actions-menu'
										>
											<button
												type='button'
												className='workspace-board-actions-button'
												aria-label='Room actions'
												aria-expanded={isRoomActionsOpen}
												title='Room actions'
												onClick={() => setIsRoomActionsOpen((value) => !value)}
											>
												<MoreHorizontal size={16} />
											</button>
											{isRoomActionsOpen && (
												<div className='room-actions-popover' role='menu'>
													<button
														type='button'
														className='room-action-danger'
														onClick={() => {
															setIsRoomActionsOpen(false)
															if (isBoardOwner) openDeleteBoardDialog()
															else setIsLeaveBoardOpen(true)
														}}
													>
														{isBoardOwner ? <Trash2 size={15} /> : <LogOut size={15} />}
														{isBoardOwner ? 'Delete room' : 'Leave room'}
													</button>
												</div>
											)}
										</Popover>
									)}
								</div>
							</div>
				</WorkspaceTopbar>

				{!boardId ? (
					isLoading ? (
						<div className='workspace-content rooms-overview'>
							<div className='workspace-overview-loading' role='status' aria-live='polite'>
								<div className='workspace-overview-loading-heading'><div className='workspace-overview-loading-heading-copy'><p className='eyebrow workspace-overview-loading-eyebrow'>Your rooms</p><h1 className='workspace-overview-loading-title'>Everything in one place.</h1><p className='heading-copy workspace-overview-loading-copy'>Choose a room to jump into a board, or create a new one for the next project.</p></div><span className='workspace-overview-loading-button' /></div>
								<div className='workspace-overview-loading-summary'><span /><span /></div>
								{[1, 2].map((group) => <div className='workspace-overview-loading-group' key={group}><div className='workspace-overview-loading-group-heading'><div><span /><span /></div><i /></div><div className='workspace-overview-loading-grid'>{[1, 2, 3].map((card) => <div className='workspace-overview-loading-card' key={card}><b /><div><span /><span /></div><i /></div>)}</div></div>)}
							</div>
						</div>
					) : (
						<WorkspaceOverview
							boards={boards}
							onOpenBoard={openOverviewBoard}
							onCreateBoard={() => setIsCreatingBoard(true)}
						/>
					)
				) : (
					<div className='workspace-content'>
						{isBoardContentLoading ? (
							!selectedBoard && !boardId ? (
								<div className='workspace-overview-loading' role='status' aria-live='polite'>
									<div className='workspace-overview-loading-heading'><div className='workspace-overview-loading-heading-copy'><p className='eyebrow workspace-overview-loading-eyebrow'>Your rooms</p><h1 className='workspace-overview-loading-title'>Everything in one place.</h1><p className='heading-copy workspace-overview-loading-copy'>Choose a room to jump into a board, or create a new one for the next project.</p></div><span className='workspace-overview-loading-button' /></div>
									<div className='workspace-overview-loading-summary'><span /><span /></div>
									{[1, 2].map((group) => <div className='workspace-overview-loading-group' key={group}><div className='workspace-overview-loading-group-heading'><div><span /><span /></div><i /></div><div className='workspace-overview-loading-grid'>{[1, 2, 3].map((card) => <div className='workspace-overview-loading-card' key={card}><b /><div><span /><span /></div><i /></div>)}</div></div>)}
								</div>
							) : (
							<div className='workspace-board-loading' role='status' aria-live='polite'>
								<div className='workspace-board-loading-toolbar'><span /><div className='workspace-board-loading-actions'><span /></div></div>
								<div className='workspace-board-loading-columns'>
									{[
										['sparse', ['feature', 'short', 'compact']],
										['dense', ['compact', 'compact', 'medium', 'feature']],
										['active', ['feature', 'medium']],
										['review', ['medium', 'feature', 'short']],
										['empty', []],
									].map(([columnType, cards]) => (
										<div className={`workspace-board-loading-column is-${columnType}`} key={columnType}>
											<div className='workspace-board-loading-column-title'><span /><i /></div>
											{cards.map((cardType, index) => (
												<div className={`workspace-board-loading-card is-${cardType}`} key={`${columnType}-${index}`}>
													<span /><i /><b />
												</div>
											))}
										</div>
									))}
								</div>
							</div>
							)
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
								<div className='board-toolbar'>
									<div className='board-toolbar-actions'>
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
							{isLeaveBoardOpen && selectedBoard && (
								<div
									className='modal-backdrop'
									onMouseDown={() => setIsLeaveBoardOpen(false)}
									role='presentation'
								>
									<div
										className='modal-panel leave-board-panel'
										onMouseDown={(event) => event.stopPropagation()}
										role='dialog'
										aria-modal='true'
										aria-labelledby='leave-board-title'
									>
										<div className='modal-title'>
															<div className='column-heading'>
												<p className='eyebrow'>Leave room</p>
												<h2 id='leave-board-title'>Leave this room?</h2>
											</div>
											<button
												type='button'
												className='icon-button'
												onClick={() => setIsLeaveBoardOpen(false)}
												aria-label='Close'
												title='Close'
											>
												<X size={18} />
											</button>
										</div>
										<p className='delete-board-copy'>
											You will lose access to “{selectedBoard.name}” and need a new invitation
											to join again.
										</p>
										{!isLeaveBoardArmed ? (
										<div className='delete-board-actions'>
											<button
												type='button'
												className='quiet-button'
												onClick={() => {
													setIsLeaveBoardOpen(false)
													setIsLeaveBoardArmed(false)
												}}
											>
												Cancel
											</button>
											<button
												type='button'
												className='primary-button danger-button'
												onClick={() => setIsLeaveBoardArmed(true)}
											>
												Yes, leave room
											</button>
										</div>
										) : (
										<form
											className='delete-board-confirmation'
											onSubmit={(event) => {
												event.preventDefault()
												leaveCurrentBoard()
											}}
										>
											<label className='field-label' htmlFor='leave-board-confirmation'>
												Type “leave room” to confirm
											</label>
											<input
												id='leave-board-confirmation'
												autoFocus
												value={leaveConfirmation}
												onChange={(event) => setLeaveConfirmation(event.target.value)}
												placeholder='leave room'
												autoComplete='off'
											/>
											<div className='delete-board-actions'>
												<button
													type='button'
													className='quiet-button'
													onClick={() => setIsLeaveBoardArmed(false)}
												>
													Back
												</button>
												<button
													type='submit'
													className='primary-button danger-button'
													disabled={
														isLeavingBoard ||
														leaveConfirmation.trim().toLowerCase() !== 'leave room'
													}
												>
													{isLeavingBoard ? 'Leaving...' : 'Confirm leave'}
												</button>
											</div>
										</form>
										)}
									</div>
								</div>
							)}
								<div className='board-scroll'>
									<div className='kanban-grid' onClick={() => setOpenColumnMenuId(null)}>
										{visibleColumns.map((column) => (
											<Fragment key={column._id}>
											<section
																					className={`kanban-column ${column.pinned ? 'pinned-column' : ''} ${draggedTask ? 'drop-target-ready' : ''} ${draggedColumn?._id === column._id ? 'is-dragging' : ''} ${columnDropTarget === column._id ? 'column-drop-target' : ''}`}
												key={column._id}
												data-column-id={column._id}
												onDragOver={(event) => {
													event.preventDefault()
														event.dataTransfer.dropEffect = 'move'
												}}
												onDrop={() =>
													draggedColumn
														? moveColumn(draggedColumn, column)
														: moveTask(draggedTask, column)
											}
												onClick={(event) => event.stopPropagation()}
											>
												<div
													className='column-header'
												onPointerDown={(event) => {
													if (event.button !== 0) return
													if (editingColumn || event.target.closest('button, input, form')) return
													event.currentTarget.setPointerCapture?.(event.pointerId)
													setDraggedTask(null)
													setDraggedTaskHeight(null)
													columnDragSessionRef.current = {
														column,
														pointerId: event.pointerId,
														startX: event.clientX,
														startY: event.clientY,
														width: event.currentTarget.closest('.kanban-column').getBoundingClientRect().width,
														height: event.currentTarget.closest('.kanban-column').getBoundingClientRect().height,
														grabOffsetX: event.clientX - event.currentTarget.closest('.kanban-column').getBoundingClientRect().left,
														grabOffsetY: event.clientY - event.currentTarget.closest('.kanban-column').getBoundingClientRect().top,
														element: event.currentTarget.closest('.kanban-column'),
																active: false,
																targetId: null,
																pinned: Boolean(column.pinned),
													}
												document.querySelectorAll('.column-drag-dom-preview').forEach((node) => node.remove())
												}}
												>
															<div className='column-heading'>
														{editingColumn?._id === column._id ? (
															<form
																className='column-title-form'
																onClick={(event) => event.stopPropagation()}
																onSubmit={(event) => {
																	event.preventDefault()
																	updateColumn(column._id)
																}}
															>
																<input
																	autoFocus
																			maxLength={60}
																	value={editingColumnTitle}
																	onChange={(event) =>
																		setEditingColumnTitle(event.target.value)
																	}
																	onBlur={() => updateColumn(column._id)}
																	onKeyDown={(event) => {
																		if (event.key === 'Escape') {
																			setEditingColumn(null)
																		}
																	}}
																/>
															</form>
														) : (
															<h2
																onClick={() => {
																	setEditingColumn(column)
																	setEditingColumnTitle(column.title)
																}}
																style={{ cursor: 'pointer' }}
																		title={column.title}
																		aria-label={`Rename column ${column.title}`}
															>
																{column.title}
															</h2>
														)}
														<span>{column.tasks.length}</span>
													</div>
												<div className='column-menu-wrap' style={{ position: 'relative' }}>
													{column.pinned && (
														<button
															type='button'
															className='icon-button subtle active'
															onClick={(event) => {
																event.stopPropagation()
																toggleColumnPin(column._id)
															}}
															aria-label='Unpin list'
															title='Unpin list'
														>
															<Pin size={16} fill='currentColor' />
														</button>
													)}
													<button
														className='icon-button subtle'
														onClick={() => setOpenColumnMenuId(
															openColumnMenuId === column._id ? null : column._id
														)}
														aria-label={`More options for ${column.title}`}
														title='More options'
													>
														<MoreHorizontal size={18} />
													</button>
{openColumnMenuId === column._id && (
															<div
																className='column-menu-list'
																onMouseDown={(event) => event.stopPropagation()}
															>
																<div className='column-menu-item-group'>
																	<button
																		type='button'
																		onClick={() => setSortSubmenuOpen(
																			sortSubmenuOpen === column._id ? null : column._id
																		)}
																		className={`column-menu-item-with-submenu ${sortSubmenuOpen === column._id ? 'active' : ''}`}
																		aria-expanded={sortSubmenuOpen === column._id}
																	>
																		Sort by
																	</button>
																	{sortSubmenuOpen === column._id && (
																		<div className='column-menu-submenu'>
																			<button
																				type='button'
																				onClick={() => {
																					sortColumnTasks(column._id, 'date-newest')
																					setOpenColumnMenuId(null)
																					setSortSubmenuOpen(null)
																				}}
																				className={columnSortBy[column._id] === 'date-newest' ? 'active' : ''}
																			>
																				Creation date (newest)
																			</button>
																			<button
																				type='button'
																				onClick={() => {
																					sortColumnTasks(column._id, 'date-oldest')
																					setOpenColumnMenuId(null)
																					setSortSubmenuOpen(null)
																				}}
																				className={columnSortBy[column._id] === 'date-oldest' ? 'active' : ''}
																			>
																				Creation date (oldest)
																			</button>
																			<button
																				type='button'
																				onClick={() => {
																					sortColumnTasks(column._id, 'name-alpha')
																					setOpenColumnMenuId(null)
																					setSortSubmenuOpen(null)
																				}}
																				className={columnSortBy[column._id] === 'name-alpha' ? 'active' : ''}
																			>
																				Name (alphabetically)
																			</button>
																		</div>
																	)}
																</div>
																		<button
																			type='button'
																			className='column-menu-item'
																			onClick={() => {
																				setEditingColumn(column)
																				setEditingColumnTitle(column.title)
																				setOpenColumnMenuId(null)
																			}}
																		>
																			<Pencil size={14} /> Rename column
																		</button>
																<button
																type='button'
																onClick={() => {
																	toggleColumnPin(column._id)
																	setOpenColumnMenuId(null)
																}}
																className='column-menu-item'
																>
																<Pin size={14} /> {column.pinned ? 'Unpin list' : 'Pin list'}
																</button>
																<div className='column-menu-divider' />
																<button
																	type='button'
																	onClick={() => {
																		setDeleteColumnTarget(column)
																		setOpenColumnMenuId(null)
																	}}
																	className='column-menu-delete'
																>
																	<Trash2 size={14} /> Delete column
																</button>
															</div>
														)}
													</div>
												</div>
												<div className='task-list'>
													{column.tasks.length === 0 ? (
														<div className='column-empty'>
															Drop a task here.
														</div>
													) : (
														column.tasks.map((task, taskIndex) => (
															<Fragment key={task._id}>
																{draggedTask &&
																	dropIndicator?.columnId === column._id &&
																	dropIndicator.index === taskIndex && (
																		<div
																			className='task-drag-placeholder'
																			style={{ minHeight: draggedTaskHeight || undefined }}
																			aria-hidden='true'
																		/>
																	)}
															<article
															className={`task-card ${draggedTask?._id === task._id ? 'is-dragging' : ''}`}
													data-task-id={task._id}
																draggable={editingTask?._id !== task._id}
															onDragStart={(event) => {
																event.dataTransfer.effectAllowed = 'move'
																event.dataTransfer.setData('text/plain', task._id)
															setNativeDragImage(event, event.currentTarget)
															setDraggedColumn(null)
																setDropIndicator(null)
															setDraggedTask(task)
															setDraggedTaskHeight(event.currentTarget.getBoundingClientRect().height)
														}}
															onDragEnd={() => {
															setDraggedTask(null)
															setDraggedTaskHeight(null)
																setDropIndicator(null)
														}}
																key={task._id}
																onClick={() => openTaskDetails(task)}
																onDoubleClick={() => {
																	setEditingTask(task)
																	setEditingTitle(task.title)
																}}
															>
																<div className='task-label'>
																	<span>Task · drag to move</span>
																	<button
																		type='button'
																		className='icon-button subtle'
																		onClick={(event) => {
																			event.stopPropagation()
																			setDeleteTaskTarget(task)
																		}}
																		aria-label='Delete task'
																		title='Delete task'
																	>
																		<Trash2 size={16} />
																	</button>
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
																			<div
																				className='task-description-preview'
																				dangerouslySetInnerHTML={{
																					__html: sanitizeDescription(task.description),
																				}}
																			/>
																		)}
																		{task.labels?.length > 0 && (
																			<div className='task-labels' aria-label='Task labels'>
																				{task.labels.slice(0, 3).map((label) => (
																					<span key={label}>{label}</span>
																				))}
																				{task.labels.length > 3 && <small>+{task.labels.length - 3}</small>}
																			</div>
																		)}
																		{getChecklistProgress(task.checklist).total > 0 && (
																			<div className='task-checklist-summary'>
																				<ListChecks size={14} />
																				{getChecklistProgress(task.checklist).completed}/{getChecklistProgress(task.checklist).total} checklist items
																			</div>
																		)}
																		<div className='task-footer'>
																			<span>
																				{task.dueDate ? (
																					<>
																						<CalendarDays className={`task-due-icon ${getDueDateState(task.dueDate)}`} size={14} />{' '}
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
														</Fragment>
														))
													)}
												{draggedTask &&
													dropIndicator?.columnId === column._id &&
													dropIndicator.index >= column.tasks.length && (
													<div
														className='task-drag-placeholder'
														style={{ minHeight: draggedTaskHeight || undefined }}
														aria-hidden='true'
													/>
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
											</Fragment>
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
																													maxLength={60}
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
				boardOwnerId={selectedBoard?.createdBy}
				presenceByUserId={presenceByUserId}
				showPresence={Boolean(selectedBoard?._id)}
				roomVisibility={selectedBoard?.visibility}
				inviteLink={inviteLink}
				publicLink={publicBoardLink}
				onCreatePublicLink={createPublicBoardLink}
				onRevokePublicLink={revokePublicBoardLink}
				onRevokeInviteLink={revokeInviteLink}
				onRevokeInvite={revokeInvite}
				canManageMembers={
					selectedBoard?.access === 'owned' || selectedBoard?.role === 'admin'
				}
				onChange={(event) => setInviteEmail(event.target.value)}
				onClose={() => setIsInviteOpen(false)}
				onSubmit={inviteMember}
				onRoleChange={updateMemberRole}
				onRemoveMember={removeBoardMember}
			/>
			{removeMemberTarget && selectedBoard && (
				<div className='modal-backdrop' onMouseDown={closeRemoveMemberDialog} role='presentation'>
					<div
						className='modal-panel remove-member-panel'
						onMouseDown={(event) => event.stopPropagation()}
						role='dialog'
						aria-modal='true'
						aria-labelledby='remove-member-title'
					>
						<div className='remove-member-icon'><UserMinus size={22} /></div>
						<div className='modal-title'>
							<div>
								<p className='eyebrow remove-member-eyebrow'>Access change</p>
								<h2 id='remove-member-title'>Remove from room?</h2>
							</div>
							<button type='button' className='icon-button' onClick={closeRemoveMemberDialog} aria-label='Close' title='Close'>
								<X size={18} />
							</button>
						</div>
						<div className='remove-member-person'>
							<div className='remove-member-avatar'><UserRound size={20} /></div>
							<div>
								<strong>{removeMemberTarget.user?.name || removeMemberTarget.user?.email}</strong>
								<span>{removeMemberTarget.user?.email}</span>
							</div>
						</div>
						<p className='delete-board-copy'>They will lose access to this room, its tasks, activity, and live updates immediately.</p>
						<div className='delete-board-actions'>
							<button type='button' className='quiet-button' onClick={closeRemoveMemberDialog}>Cancel</button>
							<button type='button' className='primary-button danger-button' onClick={confirmRemoveMember}><UserMinus size={15} /> Remove member</button>
						</div>
					</div>
				</div>
			)}
			{isDeleteBoardOpen && selectedBoard && (
				<div
					className='modal-backdrop'
					onMouseDown={closeDeleteBoardDialog}
					role='presentation'
				>
					<div
						className='modal-panel delete-board-panel'
						onMouseDown={(event) => event.stopPropagation()}
						role='dialog'
						aria-modal='true'
						aria-labelledby='delete-board-title'
					>
						<div className='modal-title'>
							<div>
								<p className='eyebrow'>Permanent action</p>
								<h2 id='delete-board-title'>Delete room?</h2>
							</div>
							<button
								type='button'
								className='icon-button'
								onClick={closeDeleteBoardDialog}
								aria-label='Close'
								title='Close'
							>
								<X size={18} />
							</button>
						</div>
						<p className='delete-board-copy'>
							Room “{selectedBoard.name}”, all tasks, columns, and invitations will be
							permanently deleted.
						</p>
						{!isDeleteBoardArmed ? (
							<div className='delete-board-actions'>
								<button
									type='button'
									className='quiet-button'
									onClick={closeDeleteBoardDialog}
								>
									No, keep it
								</button>
								<button
									type='button'
									className='primary-button danger-button'
									onClick={() => setIsDeleteBoardArmed(true)}
								>
									Yes, delete
								</button>
							</div>
						) : (
							<form
								className='delete-board-confirmation'
								onSubmit={(event) => {
									event.preventDefault()
									removeCurrentBoard()
								}}
							>
								<label className='field-label' htmlFor='delete-board-confirmation'>
									Type “delete room” to confirm
								</label>
								<input
									id='delete-board-confirmation'
									autoFocus
									value={deleteConfirmation}
									onChange={(event) => setDeleteConfirmation(event.target.value)}
									placeholder='delete room'
									autoComplete='off'
								/>
								<div className='delete-board-actions'>
									<button
										type='button'
										className='quiet-button'
										onClick={() => setIsDeleteBoardArmed(false)}
									>
										Back
									</button>
									<button
										type='submit'
										className='primary-button danger-button'
										disabled={deleteConfirmation.trim().toLowerCase() !== 'delete room'}
									>
										Confirm deletion
									</button>
								</div>
							</form>
						)}
					</div>
				</div>
			)}
			{ownershipTransferTarget && selectedBoard && (
				<div
					className='modal-backdrop'
					onMouseDown={closeOwnershipTransferDialog}
					role='presentation'
				>
					<form
						className='modal-panel delete-board-panel'
						onSubmit={(event) => {
							event.preventDefault()
							confirmOwnershipTransfer()
						}}
						onMouseDown={(event) => event.stopPropagation()}
						role='dialog'
						aria-modal='true'
						aria-labelledby='transfer-ownership-title'
					>
						<div className='modal-title'>
							<div>
								<p className='eyebrow'>Permanent change</p>
								<h2 id='transfer-ownership-title'>Transfer ownership?</h2>
							</div>
							<button
								type='button'
								className='icon-button'
								onClick={closeOwnershipTransferDialog}
								aria-label='Close'
								title='Close'
							>
								<X size={18} />
							</button>
						</div>
						<p className='delete-board-copy'>
							<strong>
								{ownershipTransferTarget.user?.name ||
									ownershipTransferTarget.user?.email ||
									ownershipTransferTarget.name ||
									ownershipTransferTarget.email}
							</strong>{' '}
							will become the owner of “{selectedBoard.name}”. You will become an
							admin.
						</p>
						<label className='field-label' htmlFor='ownership-confirmation'>
							Type “transfer ownership” to confirm
						</label>
						<input
							id='ownership-confirmation'
							autoFocus
							value={ownershipConfirmation}
							onChange={(event) => setOwnershipConfirmation(event.target.value)}
							placeholder='transfer ownership'
							autoComplete='off'
						/>
						<div className='delete-board-actions'>
							<button
								type='button'
								className='quiet-button'
								onClick={closeOwnershipTransferDialog}
							>
								Cancel
							</button>
							<button
								type='submit'
								className='primary-button danger-button'
								disabled={ownershipConfirmation.trim().toLowerCase() !== 'transfer ownership'}
							>
								Transfer ownership
							</button>
						</div>
					</form>
				</div>
			)}
			{deleteColumnTarget && (
				<div
					className='modal-backdrop'
					onMouseDown={() => setDeleteColumnTarget(null)}
					role='presentation'
				>
					<div
						className='modal-panel delete-board-panel'
						onMouseDown={(event) => event.stopPropagation()}
						role='dialog'
						aria-modal='true'
						aria-labelledby='delete-column-title'
					>
						<div className='modal-title'>
							<div>
								<p className='eyebrow'>Permanent action</p>
								<h2 id='delete-column-title'>Delete column?</h2>
							</div>
							<button
								type='button'
								className='icon-button'
								onClick={() => setDeleteColumnTarget(null)}
								aria-label='Close'
								title='Close'
							>
								<X size={18} />
							</button>
						</div>
						<p className='delete-board-copy'>
							Column "{deleteColumnTarget.title}" and all tasks in it will be permanently deleted.
						</p>
						<div className='delete-board-actions'>
							<button
								type='button'
								className='quiet-button'
								onClick={() => setDeleteColumnTarget(null)}
							>
								Keep it
							</button>
							<button
								type='button'
								className='primary-button danger-button'
								onClick={() => deleteColumn(deleteColumnTarget._id)}
							>
								Delete column
							</button>
						</div>
					</div>
				</div>
			)}
			{deleteTaskTarget && (
				<div
					className='modal-backdrop'
					onMouseDown={() => setDeleteTaskTarget(null)}
					role='presentation'
				>
					<div
						className='modal-panel delete-board-panel'
						onMouseDown={(event) => event.stopPropagation()}
						role='dialog'
						aria-modal='true'
						aria-labelledby='delete-task-title'
					>
						<div className='modal-title'>
							<div>
								<p className='eyebrow'>Permanent action</p>
								<h2 id='delete-task-title'>Delete task?</h2>
							</div>
							<button
								type='button'
								className='icon-button'
								onClick={() => setDeleteTaskTarget(null)}
								aria-label='Close'
								title='Close'
							>
								<X size={18} />
							</button>
						</div>
						<p className='delete-board-copy'>
							Task "{deleteTaskTarget.title}" and all its details will be permanently deleted.
						</p>
						<div className='delete-board-actions'>
							<button
								type='button'
								className='quiet-button'
								onClick={() => setDeleteTaskTarget(null)}
							>
								Keep it
							</button>
							<button
								type='button'
								className='primary-button danger-button'
								onClick={() => deleteTask(deleteTaskTarget._id)}
							>
								Delete task
							</button>
						</div>
					</div>
				</div>
			)}
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
								<div className='task-breadcrumb' aria-label='Task location'>
										<span>Workspace</span>
									<ChevronRight size={16} />
									<span>{selectedBoard?.name || 'Room'}</span>
									<ChevronRight size={16} />
									<strong>{taskDetailsForm.title || 'Untitled task'}</strong>
								</div>
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
										<div className='task-details-layout'>
											<div className='task-details-main'>
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
						<RichTextEditor
							value={taskDetailsForm.description}
							onChange={(description) =>
								setTaskDetailsForm((current) => ({
									...current,
									description,
								}))
							}
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
								<div className='assignee-picker' id='task-assignees'>
									<div className='assignee-picker-control'>
										<div className='assignee-chips'>
											{taskDetailsForm.assignees.length === 0 && (
												<span className='assignee-placeholder'>Assign people</span>
											)}
											{taskDetailsForm.assignees.map((memberId) => {
												const member = boardMembers.find((item) => item._id === memberId)
												if (!member) return null
												const name = member.name || member.email
												return (
													<span className='assignee-chip' key={memberId}>
														<span className='assignee-avatar'>{name.slice(0, 1).toUpperCase()}</span>
														{name}
														<button type='button' onClick={() => toggleTaskAssignee(memberId)} aria-label={`Remove ${name}`}><X size={13} /></button>
													</span>
												)
											})}
										</div>
										<button type='button' className='assignee-picker-toggle' onClick={() => setIsAssigneePickerOpen((value) => !value)} aria-expanded={isAssigneePickerOpen} aria-label='Choose assignees'><ChevronDown size={17} /></button>
									</div>
									{isAssigneePickerOpen && (
										<div className='assignee-picker-menu'>
											{boardMembers.map((member) => {
												const name = member.name || member.email
												const isSelected = taskDetailsForm.assignees.includes(member._id)
												return <button type='button' className={`assignee-option ${isSelected ? 'is-selected' : ''}`} key={member._id} onClick={() => toggleTaskAssignee(member._id)}><span className='assignee-avatar'>{name.slice(0, 1).toUpperCase()}</span><span>{name}</span><span className='assignee-option-check'>{isSelected ? '✓' : ''}</span></button>
											})}
										</div>
									)}
								</div>
							</>
						)}
						<label className='field-label' htmlFor='task-checklist'>
							Checklist
						</label>
						<div className='checklist-editor' id='task-checklist'>
							<div className='checklist-items'>
								{taskDetailsForm.checklist.length === 0 && (
									<p className='checklist-empty'>No checklist items yet.</p>
								)}
								{taskDetailsForm.checklist.map((item, index) => (
									<div className={`checklist-item ${item.completed ? 'is-completed' : ''}`} key={`${item.text}-${index}`}>
										<input
											type='checkbox'
											checked={item.completed}
											onChange={(event) => updateChecklistItem(index, { completed: event.target.checked })}
											aria-label={`Mark ${item.text} complete`}
										/>
										<input
											value={item.text}
											onChange={(event) => updateChecklistItem(index, { text: event.target.value })}
											aria-label={`Checklist item ${index + 1}`}
										/>
										<button type='button' className='checklist-remove' onClick={() => removeChecklistItem(index)} aria-label={`Remove ${item.text}`}><X size={15} /></button>
									</div>
								))}
							</div>
							<div className='checklist-add'>
								<input value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} placeholder='Add checklist item' aria-label='New checklist item' />
								<button type='button' className='checklist-add-button' onClick={addChecklistItem} aria-label='Add checklist item' title='Add checklist item'><Plus size={17} /></button>
							</div>
						</div>
										</div>
										<aside className='task-details-summary'>
											<div className='task-summary-block'>
												<span className='task-summary-label'>Status</span>
												<select
													className='task-status-select'
													value={taskDetailsForm.columnId}
													onChange={(event) =>
														setTaskDetailsForm((current) => ({
															...current,
															columnId: event.target.value,
														}))
													}
												>
													{columns.map((column) => (
														<option key={column._id} value={column._id}>
															{column.title}
														</option>
													))}
												</select>
											</div>
											<div className='task-summary-block'>
												<span className='task-summary-label'>Checklist</span>
												<strong>{getChecklistProgress(taskDetailsForm.checklist).completed} / {getChecklistProgress(taskDetailsForm.checklist).total} complete</strong>
											</div>
											<div className='task-summary-block'>
												<span className='task-summary-label'>Assignees</span>
												<strong>{taskDetailsForm.assignees.length || 'Unassigned'}</strong>
											</div>
											<div className='task-summary-block'>
												<span className='task-summary-label'>Deadline</span>
												<strong>{taskDetailsForm.dueDate || 'No deadline'}</strong>
											</div>
										</aside>
									</div>
									<section className='task-activity-panel' aria-label='Comments and activity'>
										<div className='task-activity-heading'>
											<div><MessageSquare size={18} /><strong>Comments and activity</strong></div>
											<button type='button' className='task-timer-button' onClick={toggleTaskTimer}>
												{isTimerRunning ? <Square size={14} /> : <Play size={14} />}
												{isTimerRunning ? 'Stop timer' : 'Start timer'}
											</button>
										</div>
										<div className='task-time-summary'><Clock3 size={15} /> Tracked {formatTrackedTime(trackedSeconds)}</div>
										<div className='task-comment-composer'>
											<input value={taskComment} onChange={(event) => setTaskComment(event.target.value)} placeholder='Write a comment...' aria-label='Write a comment' />
											<button type='button' className='mini-primary' onClick={addTaskComment} disabled={!taskComment.trim()}>Comment</button>
										</div>
										<div className='task-activity-list'>
											{isActivityLoading ? <p className='task-activity-empty'>Loading activity...</p> : taskActivities.length === 0 ? <p className='task-activity-empty'>No activity yet.</p> : taskActivities.map((activity) => (
												<article className='task-activity-item' key={activity._id}>
													<span className='task-activity-avatar'>{(activity.user?.name || activity.user?.email || 'U').slice(0, 2).toUpperCase()}</span>
													<div><p><strong>{activity.user?.name || activity.user?.email || 'User'}</strong> {activity.message || activity.type}</p><time>{new Date(activity.createdAt).toLocaleString()}</time></div>
												</article>
											))}
										</div>
									</section>
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
													<p className='eyebrow'>New room</p>
													<h2>Create a room</h2>
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
						<fieldset className='board-visibility-options'>
							<legend>Who can access this room?</legend>
							<label className={`board-visibility-option ${newBoardVisibility === 'private' ? 'is-selected' : ''}`}>
								<input
									type='radio'
									name='board-visibility'
									value='private'
									checked={newBoardVisibility === 'private'}
									onChange={handleBoardVisibilityChange}
								/>
								<span><strong>Private</strong><small>Only invited members can view and edit this room.</small></span>
							</label>
							<label className={`board-visibility-option ${newBoardVisibility === 'workspace' ? 'is-selected' : ''}`}>
								<input
									type='radio'
									name='board-visibility'
									value='workspace'
									checked={newBoardVisibility === 'workspace'}
									onChange={handleBoardVisibilityChange}
								/>
								<span><strong>Workspace</strong><small>Workspace members can view and edit this room.</small></span>
							</label>
							<label className={`board-visibility-option ${newBoardVisibility === 'public' ? 'is-selected' : ''}`}>
								<input
									type='radio'
									name='board-visibility'
									value='public'
									checked={newBoardVisibility === 'public'}
									onChange={handleBoardVisibilityChange}
								/>
								<span><strong>Public</strong><small>Anyone with access to the room can view it.</small></span>
							</label>
						</fieldset>
						<button className='primary-button full-button' type='submit'>
							<Plus size={18} /> Create board
						</button>
					</form>
				</div>
			)}
			{isPublicBoardConfirmOpen && (
				<div className='modal-backdrop public-board-confirm-backdrop' onMouseDown={closePublicBoardConfirmation}>
					<div className='modal-panel public-board-confirmation' onMouseDown={(event) => event.stopPropagation()}>
						<div className='modal-title'>
							<div>
								<p className='eyebrow'>Visibility</p>
														<h2>Make this room public?</h2>
							</div>
							<button type='button' className='icon-button' onClick={closePublicBoardConfirmation} aria-label='Close' title='Close'>
								<X size={18} />
							</button>
						</div>
						<p>Public rooms are available to everyone on the internet.</p>
						<div className='public-board-confirm-actions'>
							<button type='button' className='quiet-button' onClick={closePublicBoardConfirmation}>Cancel</button>
							<button type='button' className='primary-button' onClick={confirmPublicBoard}>Make public</button>
						</div>
					</div>
				</div>
			)}
			{isVisibilityOpen && selectedBoard && (
				<Popover isOpen={isVisibilityOpen} onClose={() => setIsVisibilityOpen(false)} className='popover-shell room-visibility-dropdown' role='dialog' aria-label='Room visibility settings'>
						<div className='popover-header room-visibility-dropdown-header'>
							<div>
								<p className='eyebrow'>Room settings</p>
								<h2>Change visibility</h2>
							</div>
							<button type='button' className='icon-button' onClick={() => setIsVisibilityOpen(false)} aria-label='Close visibility settings' title='Close'><X size={16} /></button>
						</div>
						<div className='room-visibility-list'>
							{[
								['private', 'Private', 'Only invited members can view and edit this room.'],
								['workspace', 'Workspace', 'Workspace members can view this room; members can collaborate.'],
								['public', 'Public', 'Anyone with the public link can view this room.'],
							].map(([value, title, description]) => (
																								<button type='button' className={`room-visibility-choice ${visibilityDraft === value ? 'is-selected' : ''}`} key={value} onClick={() => requestVisibilityChange(value)} disabled={visibilityDraft === value} aria-pressed={visibilityDraft === value}>
									<span><strong>{title}</strong><small>{description}</small></span>
									{visibilityDraft === value && <span className='room-visibility-check'>✓</span>}
								</button>
							))}
						</div>
				</Popover>
			)}
			{isPublicVisibilityConfirmOpen && (
				<div className='modal-backdrop public-board-confirm-backdrop' onMouseDown={() => setIsPublicVisibilityConfirmOpen(false)}>
					<div className='modal-panel public-board-confirmation' onMouseDown={(event) => event.stopPropagation()}>
						<div className='modal-title'>
							<div><p className='eyebrow'>Visibility</p><h2>Make this room public?</h2></div>
							<button type='button' className='icon-button' onClick={() => setIsPublicVisibilityConfirmOpen(false)} aria-label='Close' title='Close'><X size={18} /></button>
						</div>
						<p>Anyone with the public link will be able to view this room without joining it.</p>
						<div className='public-board-confirm-actions'>
							<button type='button' className='quiet-button' onClick={() => setIsPublicVisibilityConfirmOpen(false)}>Cancel</button>
							<button type='button' className='primary-button' onClick={() => { setIsPublicVisibilityConfirmOpen(false); void saveBoardVisibility('public') }}>Make public</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default Workspace
