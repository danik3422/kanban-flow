import {
	Plus,
	Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { translateCurrent, translateServerMessageCurrent } from '../i18n/translate'
import { useI18n } from '../i18n'
import CreateBoardModal from '../features/boards/CreateBoardModal'
import BoardBackgroundDialog from '../features/boards/backgrounds/BoardBackgroundDialog'
import BoardColumn, { ListComposer } from '../features/board/columns/BoardColumn'
import ColumnActions from '../features/board/columns/ColumnActions'
import BoardDock from '../features/board/dock/BoardDock'
import BoardSkeleton from '../features/board/BoardSkeleton'
import BoardSwitcher from '../features/board/dock/BoardSwitcher'
import '../features/board/columns/board-columns.css'
import useIsPhone from '../hooks/useIsPhone'
import useFlipColumns from '../features/board/hooks/useFlipColumns'
import { Button, ConfirmDialog, EmptyState } from '../ui'
import { backdropStyle, backgroundPayload } from '../features/boards/backgrounds/boardBackground'
import { useBoardPrefs } from '../store/useBoardPrefs'
import { useBoardStats } from '../store/useBoardStats'
import { toast } from 'sonner'
import { BoardActions, BoardTitle } from '../features/board/header/BoardHeader'
import BoardFilter from '../features/board/header/BoardFilter'
import BoardMenu from '../features/board/header/BoardMenu'
import ShareDialog from '../features/board/header/ShareDialog'
import { activeFilterCount, boardLabels, EMPTY_FILTER, isFilterActive, matchesCardFilter } from '../features/board/model/cardFilter'
import CardModal from '../features/board/cards/CardModal'
import CardTile from '../features/board/cards/CardTile'
import useCardDrag from '../features/board/hooks/useCardDrag'
import useFlipCards from '../features/board/hooks/useFlipCards'
import { allLabels } from '../features/board/model/cardDisplay'
import { isSamePlace, moveCardInColumns } from '../features/board/model/cardOrdering'
import BoardsOverview from '../features/boards/BoardsOverview'
import AppSidebar from '../app/shell/AppSidebar'
import AppTopbar from '../app/shell/AppTopbar'
import { axiosInstance } from '../lib/axios'
import { peekCache } from '../lib/apiCache'
import { fetchBoardsWithCache, getCachedBoards, setCachedBoards } from '../lib/boardsCache'
import { sortTasks } from '../features/board/model/taskSorting'
import { getColumnDropIndex, reorderColumns } from '../features/board/model/columnOrdering'
import useWorkspaceNavigation from '../app/shell/useWorkspaceNavigation'
import useBoardRealtime from '../features/board/hooks/useBoardRealtime'
import {
	addColumn,
	addTask,
	applyColumnOrder,
	applyColumnSort,
	mergeColumn,
	removeColumn,
	removeTask,
	replaceTask,
	setTaskCommentCount,
	setColumnTasks,
} from '../features/board/model/boardColumns'
import {
	devBoard,
	devBoardInvites,
	devBoardMembers,
	devColumns,
	isDevAuthBypass,
} from '../lib/devMode'
import { useAuthStore } from '../store/useAuthStore'

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



const fetchColumns = async (boardId) => {
	const { data } = await axiosInstance.get(`/board/boards/${boardId}/content`)
	return data
}

// Lists of boards opened during this visit, so going back to one shows it at once
// while a fresh copy loads behind it. Keyed by user and board.
const columnsCache = new Map()
const sortByOf = (columns) => Object.fromEntries(columns.map((column) => [column._id, column.sortBy || 'custom']))

const Workspace = () => {
	const { authUser } = useAuthStore()
	const { t: tr } = useI18n()
	const markBoardOpened = useBoardPrefs((state) => state.markOpened)
	const loadBoardPrefs = useBoardPrefs((state) => state.load)
	const starredBoardIds = useBoardPrefs((state) => state.starred)
	const toggleBoardStar = useBoardPrefs((state) => state.toggleStar)
	// Board top bar: the menu, the card filter and its panel.
	const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false)
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const [cardFilter, setCardFilter] = useState(EMPTY_FILTER)
	const [pendingVisibility, setPendingVisibility] = useState(null)
	const navigate = useNavigate()
	const location = useLocation()
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
	const [isCreatingBoard, setIsCreatingBoard] = useState(false)
	const [activeTaskColumn, setActiveTaskColumn] = useState(null)
	const [newBoardName, setNewBoardName] = useState('')
	const [newBoardVisibility, setNewBoardVisibility] = useState('private')
	// undefined until chosen: the create dialog then preselects its first photo.
	const [newBoardBackground, setNewBoardBackground] = useState(undefined)
	const [isBackgroundOpen, setIsBackgroundOpen] = useState(false)
	const [isSubmittingBoard, setIsSubmittingBoard] = useState(false)
	const [createBoardError, setCreateBoardError] = useState('')
	const [boardMemberRecords, setBoardMemberRecords] = useState([])
	const [boardInvites, setBoardInvites] = useState([])
	const [inviteLink, setInviteLink] = useState(null)
	const [publicBoardLink, setPublicBoardLink] = useState('')
	const [boardActivities, setBoardActivities] = useState([])
	const [isActivityLoading, setIsActivityLoading] = useState(false)
	const [draggedColumn, setDraggedColumn] = useState(null)
	const columnDragSessionRef = useRef(null)
	const columnDragOverlayRef = useRef(null)
	const [taskDetails, setTaskDetails] = useState(null)
	// Bumped when comments change elsewhere, so an open card reloads them.
	const [commentsVersion, setCommentsVersion] = useState(0)
	const hasRevalidatedBoardsRef = useRef(false)
	const [isInviteOpen, setIsInviteOpen] = useState(false)
	const [isDeleteBoardOpen, setIsDeleteBoardOpen] = useState(false)
	const [isLeaveBoardOpen, setIsLeaveBoardOpen] = useState(false)
	const [deleteColumnTarget, setDeleteColumnTarget] = useState(null)
	const [columnSortBy, setColumnSortBy] = useState({}) // { columnId: 'sortType' }
	const [columnMenu, setColumnMenu] = useState(null) // { columnId, anchor }
	// While a list is dragged: where it would land (index among the other lists),
	// and which list is still settling after the drop.
	const [columnPreviewIndex, setColumnPreviewIndex] = useState(null)
	const [landingColumnId, setLandingColumnId] = useState(null)
	const boardListRef = useRef(null)
	const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)
	const [collapsedColumnIds, setCollapsedColumnIds] = useState([])
	const isPhone = useIsPhone()
	// The board whose lists are on screen (from the server or this visit's cache).
	const [loadedBoardId, setLoadedBoardId] = useState(null)
	const isBoardContentLoading = isLoading || Boolean(
		selectedBoard && !isDevAuthBypass && loadedBoardId !== selectedBoard._id,
	)


	const applyLoadedColumns = useCallback((loadedColumns) => {
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
	}, [])


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
		if (insertionIndex === sourceIndex) {
			setDraggedColumn(null)
			return
		}
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
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'workspace.reorderColumnError'))
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
				setBoardMemberRecords(devBoardMembers)
				setBoardInvites(devBoardInvites)
				if (boardId === devBoard._id) setColumns(devColumns)
				setIsLoading(false)
				return
			}
			try {
				const usedCache = Boolean(getCachedBoards(authUser?._id))
				let data = await fetchBoardsWithCache(authUser?._id)
				// A board created, joined or shared since the list was cached is missing from it.
				if (boardId && !data.some((board) => board._id === boardId)) {
					data = await fetchBoardsWithCache(authUser?._id, { fresh: true })
				}
				setBoards(data)
				const nextBoard = boardId
					? data.find((board) => board._id === boardId)
					: null
				setSelectedBoard(nextBoard)
				setIsActivityLoading(Boolean(nextBoard))
				if (boardId && !nextBoard) {
					// A mistyped, deleted or no-longer-shared board: say so instead of silently switching pages.
					toast.error(translateCurrent('notFound.boardMissing'), { id: 'board-missing' })
					navigate('/workspaces', { replace: true })
				}
				// The cache survives reloads; refresh it once per visit so boards created or
				// shared elsewhere show up without waiting for the cache to expire.
				if (usedCache && !hasRevalidatedBoardsRef.current) {
					hasRevalidatedBoardsRef.current = true
					fetchBoardsWithCache(authUser?._id, { fresh: true })
						.then((freshBoards) => {
							setBoards(freshBoards)
							setSelectedBoard((current) => {
								if (!current) return current
								const freshBoard = freshBoards.find((board) => board._id === current._id)
								return freshBoard ? { ...current, ...freshBoard } : current
							})
						})
						.catch(() => {})
				}
			} catch (error) {
				if (error.response?.status !== 404) {
					toast.error(translateServerMessageCurrent(error.response?.data?.message, 'workspace.loadBoardsError'))
				}
			} finally {
				setIsLoading(false)
			}
		}
		loadBoards()
	}, [authUser?._id, boardId, navigate])

	// Keyed by id: renames and realtime board updates replace the object but not the content.
	// Creating, renaming, leaving or deleting boards edits this list; keep other pages' cache in step.
	useEffect(() => {
		if (isLoading || isDevAuthBypass || !authUser?._id) return
		setCachedBoards(authUser._id, boards)
	}, [boards, isLoading, authUser?._id])

	// A new board id in the URL (search, notification link, back button) switches the
	// selected board straight away, from the loaded list when it is there; the reset below
	// then clears the old board before it can paint under the new address.
	const [routedBoardId, setRoutedBoardId] = useState(boardId)
	if (routedBoardId !== boardId) {
		setRoutedBoardId(boardId)
		if (boardId && selectedBoard?._id !== boardId) {
			const nextBoard = boards.find((board) => board._id === boardId) || null
			setSelectedBoard(nextBoard)
		}
	}

	const selectedBoardId = selectedBoard?._id
	const selectedBoardRole = selectedBoard?.role
	// Every way of switching boards (sidebar, back button, notification link) lands here.
	// Reset during render (not in an effect) so the old board never paints under the new one.
	const [renderedBoardId, setRenderedBoardId] = useState(selectedBoardId)
	if (renderedBoardId !== selectedBoardId) {
		setRenderedBoardId(selectedBoardId)
		setCardFilter(EMPTY_FILTER)
		setIsFilterOpen(false)
		setIsBoardMenuOpen(false)
		// Opened during this visit, or saved on the device earlier: shown at once, refreshed below.
		const cachedColumns = selectedBoardId ? columnsCache.get(`${authUser?._id}:${selectedBoardId}`) || peekCache(`/board/boards/${selectedBoardId}/content`) || null : null
		if (!isDevAuthBypass) setColumns(cachedColumns || [])
		setColumnSortBy(cachedColumns ? sortByOf(cachedColumns) : {})
		setLoadedBoardId(cachedColumns ? selectedBoardId : null)
		setBoardMemberRecords([])
		setBoardInvites([])
		setBoardActivities([])
		setInviteLink(null)
		setPublicBoardLink('')
		setTaskDetails(null)
		setActiveTaskColumn(null)
		setColumnMenu(null)
		setDeleteColumnTarget(null)
		setIsInviteOpen(false)
		setIsDeleteBoardOpen(false)
		setIsLeaveBoardOpen(false)
	}

	useEffect(() => {
		if (!selectedBoardId || isDevAuthBypass) return
		let isCurrent = true
		const loadSelectedBoard = async () => {
			try {
				const nextColumns = await fetchColumns(selectedBoardId)
				if (isCurrent) applyLoadedColumns(nextColumns)
			} catch (error) {
				if (isCurrent) {
					toast.error(translateServerMessageCurrent(error.response?.data?.message, 'workspace.loadBoardError'))
				}
			} finally {
				if (isCurrent) {
					setLoadedBoardId(selectedBoardId)
				}
			}
		}
		loadSelectedBoard()
		return () => {
			isCurrent = false
		}
	}, [selectedBoardId, applyLoadedColumns])

	// Whatever the board shows (loaded, edited, updated live) is what a return visit starts from.
	useEffect(() => {
		if (!selectedBoardId || isDevAuthBypass || loadedBoardId !== selectedBoardId) return
		columnsCache.set(`${authUser?._id}:${selectedBoardId}`, columns)
	}, [columns, selectedBoardId, loadedBoardId, authUser?._id])


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
				// Measure once: the other lists slide while dragging, so live positions would jitter.
				session.scroller = session.element.closest('.bc-scroll')
				session.scrollStart = session.scroller?.scrollLeft || 0
				session.centers = Object.fromEntries(columns.map((column) => {
					const rect = document.querySelector(`.bc-board > .bc-column[data-column-id="${column._id}"]`)?.getBoundingClientRect()
					return [column._id, rect ? rect.left + rect.width / 2 : Number.POSITIVE_INFINITY]
				}))
				// Until the pointer says otherwise, the list stays where it was.
				session.targetIndex = columns.findIndex((column) => column._id === session.column._id)
				session.targetId = columns[session.targetIndex + 1]?._id || null
				setColumnPreviewIndex(session.targetIndex)
				setDraggedColumn(session.column)
				document.body.classList.add('is-dragging-list')
				window.getSelection()?.removeAllRanges()
			}
			event.preventDefault()
			let preview = columnDragOverlayRef.current
			if (!preview) {
				preview = session.element.cloneNode(true)
				preview.classList.remove('is-dragging', 'is-drop-target', 'is-placeholder')
				preview.classList.add('bc-ghost', 'column-drag-dom-preview')
				preview.dataset.dragPreview = 'true'
				preview.setAttribute('aria-hidden', 'true')
				// The ghost leaves the board, so it carries the board's theme variables with it.
				if (session.element.closest('.has-board-background')) preview.classList.add('on-board-background')
				document.body.appendChild(preview)
				columnDragOverlayRef.current = preview
				requestAnimationFrame(() => preview.classList.add('is-lifted'))
			}
			Object.assign(preview.style, {
				width: `${session.width}px`,
				height: `${session.height}px`,
				left: `${event.clientX - session.grabOffsetX}px`,
				top: `${event.clientY - session.grabOffsetY}px`,
			})
			// Near an edge, the board scrolls by itself so far lists can be reached.
			const scroller = session.scroller
			if (scroller) {
				const bounds = scroller.getBoundingClientRect()
				const edge = 72
				if (event.clientX < bounds.left + edge) scroller.scrollLeft -= Math.ceil((bounds.left + edge - event.clientX) / 4)
				else if (event.clientX > bounds.right - edge) scroller.scrollLeft += Math.ceil((event.clientX - bounds.right + edge) / 4)
			}
			if (!session.pinned) {
				const centers = session.centers
				const pointerX = event.clientX + ((scroller?.scrollLeft || 0) - session.scrollStart)
				// The dragged list's own centre decides, so where it was grabbed does not matter.
				const draggedCenter = pointerX - session.grabOffsetX + session.width / 2
				const rawIndex = getColumnDropIndex(columns, session.column._id, centers, draggedCenter)
				const targetId = columns.filter((column) => column._id !== session.column._id)[rawIndex]?._id || null
				if (session.targetIndex !== rawIndex) {
					session.targetIndex = rawIndex
					session.targetId = targetId
					setColumnPreviewIndex(rawIndex)
				}
			}
		}
		const handlePointerUp = () => {
			const session = columnDragSessionRef.current
			// A real drag ends with a click on the title; it must not start renaming.
			if (session?.active) {
				const swallow = (event) => {
					event.stopPropagation()
					event.preventDefault()
				}
				window.addEventListener('click', swallow, { capture: true, once: true })
				window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
			}
			if (
				session?.active &&
				!session.pinned &&
				Number.isInteger(session.targetIndex)
			) {
				void moveColumn(session.column, session.targetId, session.targetIndex)
			}
			document.body.classList.remove('is-dragging-list')
			const ghost = columnDragOverlayRef.current
			columnDragOverlayRef.current = null
			columnDragSessionRef.current = null
			setDraggedColumn(null)
			setColumnPreviewIndex(null)
			// The ghost settles into the list's new place before it disappears.
			const slot = session?.active && session.element?.isConnected ? session.element.getBoundingClientRect() : null
			const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
			if (ghost && slot && !reduceMotion) {
				setLandingColumnId(session.column._id)
				ghost.classList.add('is-landing')
				ghost.classList.remove('is-lifted')
				Object.assign(ghost.style, { left: `${slot.left}px`, top: `${slot.top}px` })
				window.setTimeout(() => {
					ghost.remove()
					setLandingColumnId(null)
				}, 200)
			} else {
				ghost?.remove()
			}
			document.querySelectorAll('.column-drag-dom-preview').forEach((node) => node !== ghost && node.remove())
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
			document.body.classList.remove('is-dragging-list')
		}
	}, [columns, moveColumn])

	const { status: realtimeStatus, presence: presenceByUserId } = useBoardRealtime(selectedBoardId, {
		onResync: () => {
			fetchColumns(selectedBoardId).then(applyLoadedColumns).catch(() => {})
		},
		'board:access-revoked': ({ boardId: revokedBoardId, reason, boardName }) => {
			setBoards((current) => current.filter((board) => board._id !== revokedBoardId))
			if (revokedBoardId !== selectedBoardId) return
			setColumns([])
			setBoardMemberRecords([])
			setBoardInvites([])
			setBoardActivities([])
			setSelectedBoard(null)
			navigate('/workspaces')
			toast.error(
				reason === 'board-deleted'
					? boardName ? translateCurrent('workspace.boardDeleted', { name: boardName }) : translateCurrent('workspace.boardDeletedUnnamed')
					: translateCurrent('workspace.accessLost'),
			)
		},
		'activity:new': (activity) => {
			setBoardActivities((current) => [
				activity,
				...current.filter((item) => item._id !== activity._id),
			].slice(0, 200))
		},
		'board:updated': (updatedBoard) => {
			if (updatedBoard._id !== selectedBoardId) return
			setSelectedBoard((current) => (current ? { ...current, ...updatedBoard } : current))
			setBoards((current) =>
				current.map((board) => (board._id === updatedBoard._id ? { ...board, ...updatedBoard } : board)),
			)
		},
		'task:created': (task) => setColumns((current) => addTask(current, task)),
		'task:updated': (task) => setColumns((current) => replaceTask(current, task)),
		'task:comments-changed': ({ taskId, commentCount }) => {
			setColumns((current) => setTaskCommentCount(current, taskId, commentCount))
			setCommentsVersion((version) => version + 1)
		},
		'task:deleted': ({ taskId }) => {
			setColumns((current) => removeTask(current, taskId))
			setTaskDetails((current) => (current?._id === taskId ? null : current))
		},
		'column:tasks-reordered': ({ columnId, tasks }) =>
			setColumns((current) => setColumnTasks(current, columnId, tasks)),
		'column:updated': (updatedColumn) => setColumns((current) => mergeColumn(current, updatedColumn)),
		'column:sort-updated': (updatedColumn) => {
			setColumnSortBy((current) => ({ ...current, [updatedColumn._id]: updatedColumn.sortBy || 'custom' }))
			setColumns((current) => applyColumnSort(current, updatedColumn))
		},
		'column:created': (createdColumn) => setColumns((current) => addColumn(current, createdColumn)),
		'column:deleted': ({ columnId }) => {
			setColumns((current) => removeColumn(current, columnId))
			setActiveTaskColumn((current) => (current === columnId ? null : current))
			setColumnMenu((current) => (current?.columnId === columnId ? null : current))
			// A card that was open in the deleted column no longer exists.
			setTaskDetails((current) => (current?.column === columnId ? null : current))
		},
		'columns:reordered': ({ columns: reorderedColumns }) =>
			setColumns((current) => applyColumnOrder(current, reorderedColumns)),
		// Copying a list or moving all its cards changes many cards at once: reload them.
		'board:content-changed': () => {
			fetchColumns(selectedBoardId).then(applyLoadedColumns).catch(() => {})
		},
	})

	useEffect(() => {
		if (!selectedBoardId) return
		if (isDevAuthBypass) return
		// Plain members cannot list invites; skip a request that can only be refused.
		const canSeeInvites = selectedBoardRole !== 'member'
		Promise.allSettled([
			axiosInstance.get(`/board/boards/${selectedBoardId}/members`),
			canSeeInvites
				? axiosInstance.get(`/board/boards/${selectedBoardId}/invites`)
				: Promise.resolve({ data: [] }),
			axiosInstance.get(`/board/boards/${selectedBoardId}/activity`),
		])
			.then(([membersResult, invitesResult, activitiesResult]) => {
				if (membersResult.status === 'fulfilled') {
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
	}, [selectedBoardId, selectedBoardRole])

	const createBoard = async (event) => {
		event?.preventDefault()
		if (!newBoardName.trim() || isSubmittingBoard) return
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
			navigate(`/workspaces/${board._id}`)
			setColumns([])
			setNewBoardName('')
			setNewBoardVisibility('private')
			setIsCreatingBoard(false)
			toast.success(translateCurrent('workspace.boardCreated'))
			return
		}
		setIsSubmittingBoard(true)
		setCreateBoardError('')
		// A photo from the device can only be stored once the board exists.
		const ownPhoto = newBoardBackground?.pending ? newBoardBackground : null
		try {
			let { data } = await axiosInstance.post('/board/boards', {
				name: newBoardName.trim(),
				visibility: newBoardVisibility,
				background: ownPhoto ? null : backgroundPayload(newBoardBackground),
			})
			if (ownPhoto) {
				try {
					const { url: image, thumb, color, adjust } = ownPhoto
					const uploaded = await axiosInstance.post(`/board/boards/${data._id}/background/upload`, { image, thumb, color, ...(adjust ? { adjust } : {}) }, { timeout: 90_000 })
					data = { ...data, background: uploaded.data.background || null }
				} catch (error) {
					toast.error(translateServerMessageCurrent(error.response?.data?.message, 'backgrounds.own.errors.upload'))
				}
			}
			setBoards((current) => [data, ...current])
			setSelectedBoard(data)
			setIsActivityLoading(true)
			navigate(`/workspaces/${data._id}`)
			setNewBoardName('')
			setNewBoardVisibility('private')
			setNewBoardBackground(undefined)
			setIsCreatingBoard(false)
			useBoardStats.getState().load({ force: true })
			toast.success(tr('boards.create.created'))
		} catch (error) {
			setCreateBoardError(translateServerMessageCurrent(error.response?.data?.message, 'boards.create.error'))
		} finally {
			setIsSubmittingBoard(false)
		}
	}

	// Applies at once and rolls back if the server refuses.
	const changeBoardBackground = async (background) => {
		if (!selectedBoard) return
		const boardId = selectedBoard._id
		const previous = selectedBoard.background || null
		const apply = (value) => {
			setSelectedBoard((current) => (current?._id === boardId ? { ...current, background: value } : current))
			setBoards((current) => current.map((board) => (board._id === boardId ? { ...board, background: value } : board)))
		}
		apply(background)
		try {
			const { data } = await axiosInstance.patch(`/board/boards/${boardId}`, { background: backgroundPayload(background) })
			apply(data.background || null)
		} catch (error) {
			apply(previous)
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'backgrounds.saveError'))
		}
	}

	// A photo of the board's own, already resized in the browser; true when it is in place.
	const uploadBoardBackground = async ({ image, thumb, color }) => {
		if (!selectedBoard) return false
		const boardId = selectedBoard._id
		const { data } = await axiosInstance.post(`/board/boards/${boardId}/background/upload`, { image, thumb, color }, { timeout: 90_000 })
		const background = data.background || null
		setSelectedBoard((current) => (current?._id === boardId ? { ...current, background } : current))
		setBoards((current) => current.map((board) => (board._id === boardId ? { ...board, background } : board)))
		return true
	}

	const closeCreateBoard = () => {
		setIsCreatingBoard(false)
		setCreateBoardError('')
	}

	const selectBoard = (board) => {
		setIsSidebarOpen(false)
		// The board already open: keep what is on screen, there is nothing to reload.
		if (board._id === selectedBoard?._id) {
			if (boardId !== board._id) navigate(`/workspaces/${board._id}`)
			return
		}
		// The rest (lists, members, links) is cleared when the new board renders.
		setSelectedBoard(board)
		setIsActivityLoading(true)
		navigate(`/workspaces/${board._id}`)
	}

	// Remember opened boards for "Recent" in the sidebar and the switcher.
	useEffect(() => {
		loadBoardPrefs(authUser?._id)
	}, [authUser?._id, loadBoardPrefs])
	useEffect(() => {
		if (selectedBoard?._id) markBoardOpened(selectedBoard._id)
	}, [selectedBoard?._id, markBoardOpened])

	// "New board" chosen on another page lands here with the dialog already open.
	useEffect(() => {
		if (!location.state?.createBoard) return
		queueMicrotask(() => {
			setIsCreatingBoard(true)
			navigate(location.pathname, { replace: true, state: null })
		})
	}, [location.state, location.pathname, navigate])

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

	// Becoming owner is confirmed in the share dialog before this runs.
	const updateMemberRole = async (memberId, role) => {
		if (isDevAuthBypass) {
			setBoardMemberRecords((current) =>
				current.map((member) =>
					member._id === memberId ? { ...member, role } : member,
				),
			)
			toast.success(translateCurrent('workspace.memberRoleUpdated'))
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
				toast.success(tr('boardHeader.transferred'))
			} else {
				setBoardMemberRecords((current) =>
					current.map((member) => (member._id === memberId ? data : member)),
				)
				toast.success(tr('boardHeader.roleChanged'))
			}
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'auth.errors.generic'))
		}
	}

	const openOverviewBoard = (board) => selectBoard(board)

	const deleteColumn = async (columnId) => {
		if (!selectedBoard || isDevAuthBypass) {
			setColumns((current) => current.filter((col) => col._id !== columnId))
			setDeleteColumnTarget(null)
			toast.success(translateCurrent('workspace.columnDeleted'))
			return
		}

		try {
			await axiosInstance.delete(`/board/columns/${columnId}`)
			setColumns((current) => current.filter((col) => col._id !== columnId))
			setDeleteColumnTarget(null)
			toast.success(translateCurrent('workspace.columnDeleted'))
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'workspace.deleteColumnError'))
		}
	}

	const deleteTask = async (taskId) => {
		const drop = () => {
			setColumns((current) => removeTask(current, taskId))
			setTaskDetails(null)
		}
		if (!selectedBoard || isDevAuthBypass) {
			drop()
			return
		}
		try {
			await axiosInstance.delete(`/board/tasks/${taskId}`)
			drop()
			toast.success(tr('card.deleted'))
		} catch (error) {
			if (error.response?.status === 404) {
				drop()
				return
			}
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'card.saveError'))
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
		if (isDevAuthBypass) {
			saveLocalSorts(selectedBoard._id, authUser?._id, {
				...readLocalSorts(selectedBoard._id, authUser?._id),
				[columnId]: sortType,
			})
			toast.success(translateCurrent('workspace.tasksSorted'))
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
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'workspace.sortSaveError'))
			return
		}
		toast.success(translateCurrent('workspace.tasksSorted'))
	}

	// Folded lists are remembered per person and board on this device.
	const collapsedKey = selectedBoard?._id && authUser?._id ? `kh:collapsed:${authUser._id}:${selectedBoard._id}` : ''
	useEffect(() => {
		if (!collapsedKey) return
		let stored = []
		try {
			stored = JSON.parse(localStorage.getItem(collapsedKey) || '[]')
		} catch {
			stored = []
		}
		queueMicrotask(() => setCollapsedColumnIds(Array.isArray(stored) ? stored : []))
	}, [collapsedKey])
	const toggleCollapsed = (columnId) => {
		setCollapsedColumnIds((current) => {
			const next = current.includes(columnId) ? current.filter((id) => id !== columnId) : [...current, columnId]
			try {
				if (collapsedKey) localStorage.setItem(collapsedKey, JSON.stringify(next))
			} catch {
				// Folding still works for this visit.
			}
			return next
		})
	}

	const columnError = (error, fallbackKey) => toast.error(translateServerMessageCurrent(error.response?.data?.message, fallbackKey))

	const renameColumn = async (columnId, title) => {
		const previous = columns.find((column) => column._id === columnId)?.title
		setColumns((current) => current.map((column) => (column._id === columnId ? { ...column, title } : column)))
		try {
			const { data } = await axiosInstance.patch(`/board/columns/${columnId}`, { title })
			setColumns((current) => mergeColumn(current, { _id: data._id, title: data.title }))
		} catch (error) {
			setColumns((current) => current.map((column) => (column._id === columnId ? { ...column, title: previous } : column)))
			columnError(error, 'columns.errors.rename')
		}
	}

	const addList = async (title) => {
		if (!selectedBoard) return false
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/columns`, { title, position: columns.length })
			setColumns((current) => (current.some((column) => column._id === data._id) ? current : [...current, { ...data, tasks: [] }]))
			requestAnimationFrame(() => {
				const scroller = document.querySelector('.bc-scroll')
				scroller?.scrollTo({ left: scroller.scrollWidth, behavior: 'smooth' })
			})
			return true
		} catch (error) {
			columnError(error, 'columns.errors.create')
			return false
		}
	}

	const addCard = async (column, title) => {
		try {
			const { data } = await axiosInstance.post(`/board/columns/${column._id}/task`, { title })
			setColumns((current) => addTask(current, { ...data, column: data.column || column._id }))
			requestAnimationFrame(() => {
				const list = document.querySelector(`.bc-column[data-column-id="${column._id}"] .bc-tasks`)
				list?.scrollTo({ top: list.scrollHeight })
			})
			return true
		} catch (error) {
			columnError(error, 'columns.errors.addCard')
			return false
		}
	}

	const updateColumnFields = async (column, fields, fallbackKey) => {
		const previous = { color: column.color ?? null, pinned: Boolean(column.pinned) }
		setColumns((current) => mergeColumn(current, { _id: column._id, ...fields }))
		try {
			const { data } = await axiosInstance.patch(`/board/columns/${column._id}`, fields)
			setColumns((current) => mergeColumn(current, { _id: data._id, color: data.color ?? null, pinned: data.pinned }))
		} catch (error) {
			setColumns((current) => mergeColumn(current, { _id: column._id, ...previous }))
			columnError(error, fallbackKey)
		}
	}

	const runColumnAction = async (column, type, payload) => {
		if (type === 'addCard') {
			if (collapsedColumnIds.includes(column._id)) toggleCollapsed(column._id)
			setActiveTaskColumn(column._id)
		} else if (type === 'collapse') {
			toggleCollapsed(column._id)
		} else if (type === 'sort') {
			sortColumnTasks(column._id, payload)
		} else if (type === 'color') {
			updateColumnFields(column, { color: payload }, 'columns.errors.update')
		} else if (type === 'pin') {
			updateColumnFields(column, { pinned: payload }, 'columns.errors.update')
		} else if (type === 'delete') {
			setDeleteColumnTarget(column)
		} else if (type === 'move') {
			moveColumn(column, null, payload)
		} else if (type === 'watch') {
			try {
				const { data } = await axiosInstance.post(`/board/columns/${column._id}/watch`, { watching: payload })
				setColumns((current) => mergeColumn(current, { _id: data._id, watchers: data.watchers }))
				toast.success(payload ? tr('columns.toast.watching', { title: column.title }) : tr('columns.toast.unwatched', { title: column.title }))
			} catch (error) {
				columnError(error, 'columns.errors.update')
			}
		} else if (type === 'copy') {
			try {
				await axiosInstance.post(`/board/columns/${column._id}/copy`, { title: payload })
				applyLoadedColumns(await fetchColumns(selectedBoard._id))
				toast.success(tr('columns.toast.copied', { title: payload }))
			} catch (error) {
				columnError(error, 'columns.errors.copy')
			}
		} else if (type === 'moveCards') {
			try {
				const { data } = await axiosInstance.post(`/board/columns/${column._id}/move-tasks`, { targetColumnId: payload })
				applyLoadedColumns(await fetchColumns(selectedBoard._id))
				const target = columns.find((item) => item._id === payload)
				toast.success(tr('columns.toast.cardsMoved', { count: data.moved, title: target?.title || '' }))
			} catch (error) {
				columnError(error, 'columns.errors.moveCards')
			}
		}
	}

	const selectedBoardIdForPlanner = selectedBoard?._id
	const openPlanner = useCallback(() => {
		if (selectedBoardIdForPlanner) navigate(`/calendar?board=${selectedBoardIdForPlanner}`)
	}, [navigate, selectedBoardIdForPlanner])
	const openSwitcher = useCallback(() => setIsSwitcherOpen(true), [])

	const startColumnDrag = (event, column) => {
		// Lists are reordered by dragging the header with a mouse or pen; on touch the
		// header scrolls the board, and "Move list" in the menu does the job.
		if (event.button !== 0 || event.pointerType === 'touch' || !canEditBoardName) return
		// The title itself is a handle too; only the icon buttons and editors are not.
		if (event.target.closest('.ui-icon-btn, input, textarea, form')) return
		// Holding the mouse on a header must never start selecting text across the lists.
		// The click that follows (opening the title for renaming) still fires.
		event.preventDefault()
		window.getSelection()?.removeAllRanges()
		const element = event.currentTarget.closest('.bc-column')
		const rect = element.getBoundingClientRect()
		// No pointer capture: moves are tracked on the window, and capturing here would
		// steal the click that opens the title for renaming.
		columnDragSessionRef.current = {
			column,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			width: rect.width,
			height: rect.height,
			grabOffsetX: event.clientX - rect.left,
			grabOffsetY: event.clientY - rect.top,
			element,
			active: false,
			targetId: null,
			pinned: Boolean(column.pinned),
		}
		document.querySelectorAll('.column-drag-dom-preview').forEach((node) => node.remove())
	}



	const openTaskDetails = useCallback((task) => setTaskDetails(task), [])

	// A card opened from the bell (router state) or from an email link (?task=).
	useEffect(() => {
		const targetTaskId = location.state?.notificationTaskId || new URLSearchParams(location.search).get('task')
		if (!targetTaskId || taskDetails || !columns.length) return
		const task = columns.flatMap((column) => column.tasks || []).find((item) => item._id === targetTaskId)
		if (!task) return
		queueMicrotask(() => {
			openTaskDetails(task)
			navigate(location.pathname, { replace: true, state: null })
		})
	}, [columns, location.pathname, location.search, location.state, navigate, openTaskDetails, taskDetails])

	const visibleColumns = columns
		.filter((column) => column.pinned)
		.concat(columns.filter((column) => !column.pinned))
	// During a drag the lists are drawn in the order they would have after the drop.
	const previewColumns = draggedColumn && columnPreviewIndex !== null ? reorderColumns(columns, draggedColumn._id, columnPreviewIndex) : columns
	const boardColumns = previewColumns
		.filter((column) => column.pinned)
		.concat(previewColumns.filter((column) => !column.pinned))
	const boardOrderKey = boardColumns.map((column) => column._id).join(',')
	useFlipColumns(boardListRef, boardOrderKey)

	const isBoardOwner = selectedBoard?.createdBy === authUser?._id
	const canEditBoardName = isBoardOwner || selectedBoard?.role === 'admin'

	// ── Board top bar ───────────────────────────────────────────────────────────
	const canManageBoard = isBoardOwner || selectedBoard?.role === 'admin'
	const isStarredBoard = Boolean(selectedBoard && starredBoardIds.includes(selectedBoard._id))
	const boardPeople = boardMemberRecords
		.filter((member) => member.user)
		.map((member) => ({
			id: member.user._id,
			_id: member.user._id,
			name: member.user.name || member.user.email,
			email: member.user.email,
			avatar: member.user.avatar,
			jobTitle: member.user.jobTitle,
			timezone: member.user.timezone,
			role: String(member.user._id) === String(selectedBoard?.createdBy) ? 'owner' : member.role || 'member',
			isMe: String(member.user._id) === String(authUser?._id),
			status: presenceByUserId?.[member.user._id] === 'online' ? 'online' : undefined,
		}))
	const boardAdmins = boardMemberRecords
		.filter((member) => member.user && (member.role === 'admin' || String(member.user._id) === String(selectedBoard?.createdBy)))
		.map((member) => member.user)

	const patchSelectedBoard = (data) => {
		setSelectedBoard((current) => (current ? { ...current, ...data } : current))
		setBoards((current) => current.map((board) => (board._id === selectedBoard?._id ? { ...board, ...data } : board)))
	}
	const failToast = (error, key) => toast.error(translateServerMessageCurrent(error.response?.data?.message, key))

	const renameBoardTo = async (name) => {
		if (!selectedBoard) return false
		if (!name.trim()) {
			toast.error(tr('boardHeader.nameRequired'))
			return false
		}
		try {
			const { data } = await axiosInstance.patch(`/board/boards/${selectedBoard._id}`, { name: name.trim() })
			patchSelectedBoard({ name: data.name })
			toast.success(tr('boardHeader.renamed'))
			return true
		} catch (error) {
			failToast(error, 'boardHeader.renameError')
			return false
		}
	}

	const applyVisibility = async (visibility) => {
		if (!selectedBoard) return
		try {
			const { data } = await axiosInstance.patch(`/board/boards/${selectedBoard._id}`, { visibility })
			patchSelectedBoard({ visibility: data.visibility })
			setInviteLink(null)
			if (visibility !== 'public') setPublicBoardLink('')
			toast.success(tr('boardHeader.visibilitySaved', { value: tr(`boards.visibility.${visibility}`) }))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	// Going public asks first: it opens the board to anyone with the view link.
	const changeVisibility = (visibility) => {
		if (visibility === 'public') setPendingVisibility('public')
		else void applyVisibility(visibility)
	}

	const copyText = async (text, message) => {
		try {
			await copyInviteUrl(text)
			toast.success(message)
		} catch {
			toast.error(tr('auth.errors.generic'))
		}
	}

	const reloadInvites = async () => {
		const { data } = await axiosInstance.get(`/board/boards/${selectedBoard._id}/invites`)
		setBoardInvites(data)
	}
	// Invites everyone listed; returns the addresses that could not be invited.
	const inviteByEmail = async (emails, role) => {
		const failed = []
		let invited = 0
		let notEmailed = 0
		for (const email of emails) {
			try {
				const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/invites`, { email, role })
				invited += 1
				if (!data.emailSent) notEmailed += 1
			} catch (error) {
				failed.push(email)
				toast.error(`${email}: ${translateServerMessageCurrent(error.response?.data?.message, 'boardHeader.inviteError')}`)
			}
		}
		if (invited) {
			await reloadInvites()
			toast.success(invited === 1 && emails.length === 1 ? tr('boardHeader.sent', { email: emails[0] }) : tr('boardHeader.invitedMany', { count: invited }))
			if (notEmailed) toast.warning(tr('boardHeader.sentNoEmail'))
		}
		return failed
	}
	const resendInvite = async (invite) => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/invites/${invite._id}/resend`)
			await reloadInvites()
			if (data.emailSent) toast.success(tr('boardHeader.resent', { email: invite.email }))
			else toast.warning(tr('boardHeader.sentNoEmail'))
		} catch (error) {
			failToast(error, 'boardHeader.inviteError')
		}
	}
	const copyInviteFor = async (invite) => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/invites/${invite._id}/copy`)
			await copyText(data.inviteUrl, tr('boardHeader.linkCopied'))
			await reloadInvites()
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}

	const [shareSuggestions, setShareSuggestions] = useState([])
	useEffect(() => {
		if (!isInviteOpen || !canManageBoard || isDevAuthBypass) return undefined
		let current = true
		axiosInstance.get('/board/team').then(({ data }) => {
			if (!current) return
			const seen = new Map()
			for (const entry of data) for (const member of entry.members || []) {
				const user = member.user
				if (user?.email && String(user._id) !== String(authUser?._id) && !seen.has(user.email)) seen.set(user.email, { name: user.name, email: user.email.toLowerCase(), avatar: user.avatar })
			}
			setShareSuggestions([...seen.values()])
		}).catch(() => {})
		return () => {
			current = false
		}
	}, [isInviteOpen, canManageBoard, authUser?._id])

	const createInviteLink = async () => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/invites`, { email: '', role: 'member' })
			await copyInviteUrl(data.inviteUrl)
			await loadInviteLink()
			toast.success(tr('boardHeader.linkCreated'))
		} catch (error) {
			failToast(error, 'boardHeader.inviteError')
		}
	}
	const turnOffInviteLink = async () => {
		if (!inviteLink?.inviteId) return
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/invites/${inviteLink.inviteId}`)
			setInviteLink(null)
			setBoardInvites((current) => current.filter((invite) => invite._id !== inviteLink.inviteId))
			toast.success(tr('boardHeader.linkRevoked'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const createViewLink = async () => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/public-link`)
			setPublicBoardLink(data.publicUrl)
			await copyText(data.publicUrl, tr('boardHeader.publicCopied'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const turnOffViewLink = async () => {
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/public-link`)
			setPublicBoardLink('')
			toast.success(tr('boardHeader.publicRevoked'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const cancelInvite = async (invite) => {
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/invites/${invite._id}`)
			setBoardInvites((current) => current.filter((item) => item._id !== invite._id))
			toast.success(tr('boardHeader.inviteRevoked'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const changeMemberRole = async (member, role) => {
		await updateMemberRole(member._id, role)
	}
	const removeMember = async (member) => {
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}/members/${member._id}`)
			setBoardMemberRecords((current) => current.filter((record) => record._id !== member._id))
			toast.success(tr('boardHeader.removed', { name: member.user?.name || member.user?.email }))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}

	const saveBoardDescription = async (description) => {
		try {
			const { data } = await axiosInstance.patch(`/board/boards/${selectedBoard._id}`, { description })
			patchSelectedBoard({ description: data.description })
			toast.success(tr('boardHeader.descriptionSaved'))
			return true
		} catch (error) {
			failToast(error, 'auth.errors.generic')
			return false
		}
	}
	const copyCurrentBoard = async (name, keepCards) => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/copy`, { name, keepCards })
			setBoards((current) => [data, ...current])
			toast.success(tr('boardHeader.copied'))
			selectBoard(data)
			return true
		} catch (error) {
			failToast(error, 'boardHeader.copyError')
			return false
		}
	}
	const deleteCurrentBoard = async () => {
		try {
			await axiosInstance.delete(`/board/boards/${selectedBoard._id}`)
			setBoards((current) => current.filter((board) => board._id !== selectedBoard._id))
			setSelectedBoard(null)
			setColumns([])
			setIsDeleteBoardOpen(false)
			navigate('/workspaces')
			toast.success(tr('boardHeader.deleted'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const leaveBoardNow = async () => {
		try {
			await axiosInstance.post(`/board/boards/${selectedBoard._id}/leave`)
			setBoards((current) => current.filter((board) => board._id !== selectedBoard._id))
			setSelectedBoard(null)
			setColumns([])
			setIsLeaveBoardOpen(false)
			navigate('/workspaces')
			toast.success(tr('boardHeader.left'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}

	// Filter: cards in the board's last list count as done (never overdue).
	const lastColumnId = columns.reduce((last, column) => (!last || column.position > last.position ? column : last), null)?._id
	const isFiltering = isFilterActive(cardFilter)
	const cardPasses = (task, column) => !isFiltering || matchesCardFilter(task, cardFilter, { done: column._id === lastColumnId })
	const totalCards = columns.reduce((sum, column) => sum + (column.tasks?.length || 0), 0)
	const matchingCards = isFiltering ? columns.reduce((sum, column) => sum + (column.tasks || []).filter((task) => cardPasses(task, column)).length, 0) : totalCards


	// ── Cards ──────────────────────────────────────────────────────────────────
	const meId = authUser?._id
	const boardLabelList = selectedBoard?.labels || []
	const labelOptions = allLabels(boardLabelList, columns)
	const allTasks = columns.flatMap((column) => column.tasks)
	const findTask = (taskId) => allTasks.find((task) => task._id === taskId)
	const openTask = taskDetails ? findTask(taskDetails._id) || null : null
	const [features, setFeatures] = useState({ uploads: false })
	useEffect(() => {
		if (isDevAuthBypass) return
		axiosInstance.get('/board/features').then(({ data }) => setFeatures(data)).catch(() => {})
	}, [])
	const cardError = (error) => toast.error(translateServerMessageCurrent(error.response?.data?.message, 'card.saveError'))

	/** Move a card (drag, list menu, Move panel) and save the new order of both lists. */
	const moveCard = async (taskId, columnId, index) => {
		if (!selectedBoard || isSamePlace(columns, taskId, columnId, index)) return
		const previous = columns
		const previousSorts = columnSortBy
		const sourceId = columns.find((column) => column.tasks.some((task) => task._id === taskId))?._id
		const next = moveCardInColumns(columns, taskId, columnId, index).map((column) => (column._id === columnId || column._id === sourceId ? { ...column, sortBy: 'custom' } : column))
		setColumns(next)
		setColumnSortBy((current) => ({ ...current, [columnId]: 'custom', ...(sourceId && { [sourceId]: 'custom' }) }))
		if (isDevAuthBypass) return
		try {
			await axiosInstance.patch(`/board/boards/${selectedBoard._id}/tasks/reorder`, {
				columns: [...new Set([sourceId, columnId])].filter(Boolean).map((id) => ({ columnId: id, taskIds: next.find((column) => column._id === id)?.tasks.map((task) => task._id) || [] })),
			})
		} catch (error) {
			setColumns(previous)
			setColumnSortBy(previousSorts)
			cardError(error)
		}
	}

	/** Save card fields: shown at once, rolled back if the server says no. `local` skips the server. */
	const patchTask = async (task, fields, { local = false } = {}) => {
		const optimistic = { ...fields }
		if (fields.assignees) optimistic.assignees = fields.assignees.map((id) => boardPeople.find((person) => String(person._id) === String(id)) || { _id: id })
		if ('completed' in fields) optimistic.completedAt = fields.completed ? new Date().toISOString() : null
		setColumns((current) => replaceTask(current, { ...task, ...optimistic }))
		if (local || isDevAuthBypass) return task
		try {
			const { data } = await axiosInstance.patch(`/board/tasks/${task._id}`, fields)
			setColumns((current) => replaceTask(current, data))
			return data
		} catch (error) {
			setColumns((current) => replaceTask(current, task))
			cardError(error)
			return null
		}
	}

	const saveBoardLabels = (labels) => patchSelectedBoard({ labels })
	const createLabel = async ({ name, color }, { addTo } = {}) => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/labels`, { name: name.trim(), color })
			saveBoardLabels(data)
			if (addTo && !addTo.labels.some((label) => label.toLowerCase() === name.trim().toLowerCase())) await patchTask(addTo, { labels: [...addTo.labels, name.trim()] })
			return true
		} catch (error) {
			cardError(error)
			return false
		}
	}
	// Labels only on cards (older boards) become board labels the first time they are edited.
	const ensureSavedLabel = async (label) => {
		if (label.saved) return selectedBoard.labels.find((item) => item.name.toLowerCase() === label.name.toLowerCase())
		const { data } = await axiosInstance.post(`/board/boards/${selectedBoard._id}/labels`, { name: label.name, color: label.color })
		saveBoardLabels(data)
		return data.find((item) => item.name.toLowerCase() === label.name.toLowerCase())
	}
	const updateLabel = async (label, draft) => {
		try {
			const saved = await ensureSavedLabel(label)
			const { data } = await axiosInstance.patch(`/board/boards/${selectedBoard._id}/labels/${saved._id}`, { name: draft.name.trim(), color: draft.color })
			saveBoardLabels(data)
			if (draft.name.trim() !== label.name) setColumns((current) => current.map((column) => ({ ...column, tasks: column.tasks.map((task) => ({ ...task, labels: (task.labels || []).map((name) => (name === label.name ? draft.name.trim() : name)) })) })))
			return true
		} catch (error) {
			cardError(error)
			return false
		}
	}
	const deleteLabel = async (label) => {
		try {
			const saved = await ensureSavedLabel(label)
			const { data } = await axiosInstance.delete(`/board/boards/${selectedBoard._id}/labels/${saved._id}`)
			saveBoardLabels(data)
			setColumns((current) => current.map((column) => ({ ...column, tasks: column.tasks.map((task) => ({ ...task, labels: (task.labels || []).filter((name) => name !== label.name) })) })))
			return true
		} catch (error) {
			cardError(error)
			return false
		}
	}

	const cardRequest = async (request) => {
		try {
			const { data } = await request()
			setColumns((current) => replaceTask(current, data.task || data))
			return true
		} catch (error) {
			cardError(error)
			return false
		}
	}
	const copyCard = async (task, payload) => {
		try {
			const { data } = await axiosInstance.post(`/board/tasks/${task._id}/copy`, payload)
			setColumns((current) => (current.some((column) => column.tasks.some((item) => item._id === data._id)) ? current : addTask(current, data)))
			toast.success(tr('card.copied'))
			return true
		} catch (error) {
			cardError(error)
			return false
		}
	}

	// Card drag: the slot opens where the card would land, cards glide around it.
	const cardDrag = useCardDrag({ boardRef: boardListRef, enabled: Boolean(selectedBoard) && !isDevAuthBypass, onDrop: moveCard })
	const cardLayoutKey = `${columns.map((column) => column.tasks.map((task) => task._id).join('.')).join('|')}#${cardDrag.drag ? `${cardDrag.drag.columnId}:${cardDrag.drag.index}` : ''}`
	useFlipCards(boardListRef, cardLayoutKey)

	const renderColumnCards = (column) => {
		const drag = cardDrag.drag
		const slot = drag && drag.columnId === column._id ? <div key='drag-slot' className='task-drag-slot' style={{ height: drag.height }} aria-hidden='true' /> : null
		const done = column._id === lastColumnId
		const items = []
		let place = 0
		for (const task of column.tasks) {
			const isSource = drag?.taskId === task._id
			if (!isSource) {
				if (slot && drag.index === place) items.push(slot)
				place += 1
			}
			items.push(
				<CardTile
					key={task._id}
					task={task}
					boardLabels={boardLabelList}
					done={done}
					meId={meId}
					canEdit
					isDragSource={isSource}
					isFilteredOut={!cardPasses(task, column)}
					onOpen={() => {
						if (!cardDrag.consumeClick()) setTaskDetails(task)
					}}
					onToggleComplete={() => patchTask(task, { completed: !task.completed })}
					onPointerDown={(event) => cardDrag.onPointerDown(event, task._id)}
				/>,
			)
		}
		if (slot && drag.index >= place) items.push(slot)
		return items
	}

	// F opens the filter, Q shows only my cards (Trello's shortcuts).
	useEffect(() => {
		if (!boardId) return undefined
		const onKey = (event) => {
			const target = event.target
			const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
			if (event.metaKey || event.ctrlKey || event.altKey || typing || document.body.classList.contains('has-modal')) return
			const key = event.key.toLowerCase()
			if (key === 'f') {
				event.preventDefault()
				setIsFilterOpen(true)
			} else if (key === 'q' && authUser?._id) {
				event.preventDefault()
				setCardFilter((current) => {
					const me = String(authUser._id)
					const onlyMine = current.members.length === 1 && current.members[0] === me
					return { ...current, members: onlyMine ? [] : [me] }
				})
			}
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [boardId, authUser?._id])

	return (
		<div className='workspace-shell'>
			<AppSidebar
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
				boards={boards}
				selectedBoardId={selectedBoard?._id}
				onBoardSelect={selectBoard}
				onCreateBoard={() => setIsCreatingBoard(true)}
				isCollapsed={isSidebarCollapsed}
			/>

			<main
				className={`workspace-main${boardId && selectedBoard?.background ? ' has-board-background' : ''}`}
				style={boardId && selectedBoard?.background ? backdropStyle(selectedBoard.background) : undefined}
			>
				{boardId && selectedBoard?.background && <div className='board-backdrop' aria-hidden='true' />}
				<AppTopbar
					isSidebarOpen={isSidebarOpen}
					onSidebarToggle={() => setIsSidebarOpen((value) => !value)}
					isSidebarCollapsed={isSidebarCollapsed}
					onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}
					realtimeStatus={selectedBoard?._id ? realtimeStatus : null}
					boardActions={boardId && selectedBoard ? (
						<BoardActions
							people={boardPeople}
							filterCount={activeFilterCount(cardFilter)}
							onFilter={() => setIsFilterOpen(true)}
							onShare={() => setIsInviteOpen(true)}
							onMenu={() => setIsBoardMenuOpen(true)}
							onOpenProfile={(person) => navigate(person.isMe ? '/profile' : `/team?person=${person._id}`)}
							onShowCards={(person) => setCardFilter({ ...EMPTY_FILTER, members: [String(person._id)] })}
						/>
					) : null}
				>
							{!boardId || !selectedBoard ? <span className='app-topbar__title'>{tr('boards.title')}</span> : (
								<BoardTitle
									board={selectedBoard}
									canEdit={canEditBoardName}
									onRename={renameBoardTo}
									isStarred={isStarredBoard}
									onToggleStar={() => toggleBoardStar(selectedBoard._id)}
									canChangeVisibility={canManageBoard}
									onVisibilityChange={changeVisibility}
									onOpenSwitcher={() => setIsSwitcherOpen(true)}
								/>
							)}
				</AppTopbar>

				{!boardId ? (
					<BoardsOverview
						boards={boards}
						isLoading={isLoading}
						onOpenBoard={openOverviewBoard}
						onCreateBoard={() => setIsCreatingBoard(true)}
					/>
				) : (
					<div className='workspace-content bc-content has-dock'>
						{isBoardContentLoading ? (
							<BoardSkeleton />
						) : !selectedBoard ? (
							<EmptyState
								icon={Sparkles}
								title={tr('workspace.emptyTitle')}
								description={tr('workspace.emptyText')}
								action={<Button icon={Plus} onClick={() => setIsCreatingBoard(true)}>{tr('workspace.emptyAction')}</Button>}
							/>
						) : (
							<>
								<div className='bc-scroll'>
									<div className={`bc-board${isFiltering ? ' is-filtering' : ''}`} ref={boardListRef}>
										{boardColumns.map((column) => (
											<BoardColumn
												key={column._id}
												column={column}
												canManage={canEditBoardName}
												isCollapsed={!isPhone && collapsedColumnIds.includes(column._id)}
												isWatching={(column.watchers || []).some((watcherId) => String(watcherId) === String(authUser?._id))}
												isDragging={draggedColumn?._id === column._id || landingColumnId === column._id}
												isDropTarget={Boolean(cardDrag.drag) && cardDrag.drag.columnId === column._id}
												isTaskDragActive={Boolean(cardDrag.drag)}
												isComposing={activeTaskColumn === column._id}
												onStartComposing={() => setActiveTaskColumn(column._id)}
												onStopComposing={() => setActiveTaskColumn((current) => (current === column._id ? null : current))}
												onAddCard={(title) => addCard(column, title)}
												onRename={(title) => renameColumn(column._id, title)}
												onToggleCollapse={() => toggleCollapsed(column._id)}
												onOpenMenu={(anchor) => setColumnMenu({ columnId: column._id, anchor })}
												onHeaderPointerDown={(event) => startColumnDrag(event, column)}
											>
												{renderColumnCards(column)}
											</BoardColumn>
										))}
										{canEditBoardName && <ListComposer onSubmit={addList} />}
									</div>
								</div>
							</>
						)}
					</div>
				)}
				{boardId && selectedBoard && !isBoardContentLoading && (
					<BoardDock onPlanner={openPlanner} onSwitchBoards={openSwitcher} />
				)}
			</main>
			<BoardSwitcher
				open={isSwitcherOpen}
				onClose={() => setIsSwitcherOpen(false)}
				boards={boards}
				currentBoardId={selectedBoard?._id}
				onOpenBoard={selectBoard}
				onCreateBoard={() => setIsCreatingBoard(true)}
			/>
			{openTask && (
				<CardModal
					task={openTask}
					columns={columns}
					boardLabels={boardLabelList}
					labels={labelOptions}
					people={boardPeople}
					meId={meId}
					canEdit
					canManage={canManageBoard}
					uploads={features.uploads}
					commentsVersion={commentsVersion}
					onClose={() => setTaskDetails(null)}
					onPatch={(fields, options) => patchTask(openTask, fields, options)}
					onMove={(columnId, index) => {
						moveCard(openTask._id, columnId, index)
						toast.success(tr('card.moved'))
					}}
					onCopy={(payload) => copyCard(openTask, payload)}
					onDelete={() => deleteTask(openTask._id)}
					onLabelCreate={(draft) => createLabel(draft, { addTo: openTask })}
					onLabelUpdate={updateLabel}
					onLabelDelete={deleteLabel}
					onAttachLink={(url, name) => cardRequest(() => axiosInstance.post(`/board/tasks/${openTask._id}/attachments`, { url, name }))}
					onAttachImage={(image, name) => cardRequest(() => axiosInstance.post(`/board/tasks/${openTask._id}/attachments/image`, { image, name }, { timeout: 60_000 }))}
					onRemoveAttachment={(item) => cardRequest(() => axiosInstance.delete(`/board/tasks/${openTask._id}/attachments/${item._id}`))}
					onToggleWatch={() => cardRequest(() => axiosInstance.post(`/board/tasks/${openTask._id}/watch`))}
					onCopyLink={() => copyText(`${window.location.origin}/workspaces/${selectedBoard?._id}?task=${openTask._id}`, tr('card.linkCopied'))}
					taskTitleOf={(taskId) => findTask(String(taskId))?.title || ''}
				/>
			)}
			{selectedBoard && (
				<>
					<ShareDialog
						open={isInviteOpen}
						onClose={() => setIsInviteOpen(false)}
						board={selectedBoard}
						canManage={canManageBoard}
						isOwner={isBoardOwner}
						currentUserId={authUser?._id}
						members={boardMemberRecords}
						invites={boardInvites}
						presence={presenceByUserId}
						inviteLink={inviteLink}
						publicLink={publicBoardLink}
						onInvite={inviteByEmail}
						onCreateInviteLink={createInviteLink}
						onRevokeInviteLink={turnOffInviteLink}
						onCreatePublicLink={createViewLink}
						onRevokePublicLink={turnOffViewLink}
						onCopy={copyText}
						onRoleChange={changeMemberRole}
						onRemove={removeMember}
						onRevokeInvite={cancelInvite}
						onResendInvite={resendInvite}
						onCopyInvite={copyInviteFor}
						onLeave={() => {
							setIsInviteOpen(false)
							setIsLeaveBoardOpen(true)
						}}
						suggestions={shareSuggestions}
					/>
					<BoardMenu
						open={isBoardMenuOpen}
						onClose={() => setIsBoardMenuOpen(false)}
						board={selectedBoard}
						canManage={canManageBoard}
						isOwner={isBoardOwner}
						isStarred={isStarredBoard}
						admins={boardAdmins}
						activities={boardActivities}
						activityLoading={isActivityLoading}
						onSaveDescription={saveBoardDescription}
						onShare={() => setIsInviteOpen(true)}
						onVisibilityChange={changeVisibility}
						onBackground={() => setIsBackgroundOpen(true)}
						onToggleStar={() => toggleBoardStar(selectedBoard._id)}
						onCopyLink={() => copyText(`${window.location.origin}/workspaces/${selectedBoard._id}`, tr('boardHeader.linkCopied'))}
						onCopyBoard={copyCurrentBoard}
						onLeave={() => setIsLeaveBoardOpen(true)}
						onDelete={() => setIsDeleteBoardOpen(true)}
					/>
					<BoardFilter
						open={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						filter={cardFilter}
						onChange={setCardFilter}
						people={boardPeople}
						labels={boardLabels(columns)}
						savedLabels={selectedBoard?.labels || []}
						currentUserId={authUser?._id}
						matchCount={matchingCards}
						totalCount={totalCards}
					/>
					<ConfirmDialog
						open={isDeleteBoardOpen}
						onClose={() => setIsDeleteBoardOpen(false)}
						onConfirm={deleteCurrentBoard}
						title={tr('boardHeader.deleteTitle', { name: selectedBoard.name })}
						description={tr('boardHeader.deleteText')}
						confirmLabel={tr('boardHeader.delete')}
						confirmText={selectedBoard.name}
					/>
					<ConfirmDialog
						open={isLeaveBoardOpen}
						onClose={() => setIsLeaveBoardOpen(false)}
						onConfirm={leaveBoardNow}
						title={tr('boardHeader.leaveTitle', { name: selectedBoard.name })}
						description={tr('boardHeader.leaveText')}
						confirmLabel={tr('boardHeader.leave')}
					/>
					<ConfirmDialog
						open={pendingVisibility === 'public'}
						onClose={() => setPendingVisibility(null)}
						onConfirm={async () => {
							setPendingVisibility(null)
							await applyVisibility('public')
						}}
						tone='primary'
						title={tr('boardHeader.publicConfirmTitle')}
						description={tr('boardHeader.publicConfirmText')}
						confirmLabel={tr('boardHeader.publicConfirm')}
					/>
				</>
			)}

			<ConfirmDialog
				open={Boolean(deleteColumnTarget)}
				onClose={() => setDeleteColumnTarget(null)}
				onConfirm={() => deleteColumn(deleteColumnTarget._id)}
				title={deleteColumnTarget ? tr('columns.delete.title', { title: deleteColumnTarget.title }) : ''}
				description={deleteColumnTarget ? tr('columns.delete.text', { count: deleteColumnTarget.tasks?.length || 0 }) : ''}
				confirmLabel={tr('columns.delete.confirm')}
			/>
			<ColumnActions
				open={Boolean(columnMenu)}
				anchor={columnMenu?.anchor}
				column={columns.find((column) => column._id === columnMenu?.columnId)}
				columns={visibleColumns}
				canManage={canEditBoardName}
				isWatching={(columns.find((column) => column._id === columnMenu?.columnId)?.watchers || []).some((watcherId) => String(watcherId) === String(authUser?._id))}
				isCollapsed={collapsedColumnIds.includes(columnMenu?.columnId)}
				onClose={() => setColumnMenu(null)}
				onAction={(type, payload) => {
					const column = columns.find((item) => item._id === columnMenu?.columnId)
					if (column) runColumnAction(column, type, payload)
				}}
			/>
			<BoardBackgroundDialog
				open={isBackgroundOpen && Boolean(selectedBoard)}
				onClose={() => setIsBackgroundOpen(false)}
				value={selectedBoard?.background || null}
				onChange={changeBoardBackground}
				onUpload={uploadBoardBackground}
				canUpload={canManageBoard}
			/>
			<CreateBoardModal
				open={isCreatingBoard}
				onClose={closeCreateBoard}
				name={newBoardName}
				onNameChange={(value) => {
					setNewBoardName(value)
					setCreateBoardError('')
				}}
				visibility={newBoardVisibility}
				onVisibilityChange={setNewBoardVisibility}
				background={newBoardBackground}
				onBackgroundChange={setNewBoardBackground}
				onSubmit={createBoard}
				isSubmitting={isSubmittingBoard}
				error={createBoardError}
			/>
		</div>
	)
}

export default Workspace
