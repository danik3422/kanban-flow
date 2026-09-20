import {
	CalendarDays,
	ChevronDown,
	ClipboardList,
	Home,
	Layers3,
	Plus,
	Search,
	Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const MIN_WIDTH = 220
const MAX_WIDTH = 286
const SIDEBAR_WIDTH_KEY = 'kanban-sidebar-width'

const readStoredWidth = () => {
	if (typeof window === 'undefined') return 286
	const storedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY))
	return Number.isFinite(storedWidth)
		? Math.min(Math.max(storedWidth, MIN_WIDTH), MAX_WIDTH)
		: 286
}

const RoomGroup = ({
	title,
	items,
	isOpen,
	onToggle,
	search,
	selectedBoardId,
	onBoardSelect,
}) => {
	const filteredItems = items.filter((board) =>
		board.name.toLowerCase().includes(search.toLowerCase()),
	)

	return (
		<div className='workspace-room-group'>
			<button className='workspace-room-group-heading' onClick={onToggle}>
				<span>{title}</span>
				<span className='workspace-room-group-meta'>
					<b>{items.length}</b>
					<ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
				</span>
			</button>
			{isOpen && (
				<div className='workspace-room-list'>
					{filteredItems.map((board) => (
						<button
							key={board._id}
							onClick={() => onBoardSelect(board)}
							className={`workspace-room ${selectedBoardId === board._id ? 'active' : ''}`}
							title={board.name}
						>
							<span className='workspace-room-icon'>
								<Layers3 size={15} />
							</span>
											<span className='workspace-room-copy'>
												<span className='workspace-room-name'>{board.name}</span>
												<span className='workspace-room-dot' />
											</span>
						</button>
					))}
					{!filteredItems.length && (
						<div className='workspace-rooms-empty'>
							{search ? 'No rooms match your search.' : 'No rooms here yet.'}
						</div>
					)}
				</div>
			)}
		</div>
	)
}

const WorkspaceSidebar = ({
	isOpen,
	onClose,
	boards = [],
	selectedBoardId,
	onBoardSelect,
	onCreateBoard,
	isCollapsed = false,
}) => {
	const [width, setWidth] = useState(readStoredWidth)
	const [roomSearch, setRoomSearch] = useState('')
	const [isOwnedOpen, setIsOwnedOpen] = useState(true)
	const [isSharedOpen, setIsSharedOpen] = useState(true)
	const isDragging = useRef(false)
	const sidebarRef = useRef(null)
	const [isResizing, setIsResizing] = useState(false)
	const location = useLocation()
	const effectiveWidth = Math.min(width, MAX_WIDTH)

	useEffect(() => {
		window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(effectiveWidth))
	}, [effectiveWidth])

	useEffect(() => {
		const handleMouseMove = (event) => {
			if (!isDragging.current) return
			setWidth(Math.min(Math.max(event.clientX, MIN_WIDTH), MAX_WIDTH))
		}
		const handleMouseUp = () => {
			isDragging.current = false
			setIsResizing(false)
			document.body.classList.remove('sidebar-resizing')
			document.body.style.cursor = ''
		}
		const handleSelectStart = (event) => {
			if (isDragging.current) event.preventDefault()
		}
		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)
		document.addEventListener('selectstart', handleSelectStart)
		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
			document.removeEventListener('selectstart', handleSelectStart)
			document.body.classList.remove('sidebar-resizing')
		}
	}, [])

	const ownedBoards = boards.filter(
		(board) => board.access === 'owned' || !board.access,
	)
	const sharedBoards = boards.filter((board) => board.access === 'invited')
	const navItems = [
		{ icon: <Home size={17} />, label: 'Workspace', to: '/workspaces' },
		{ icon: <ClipboardList size={17} />, label: 'My tasks', to: '/my-tasks' },
		{ icon: <CalendarDays size={17} />, label: 'Calendar', to: '/calendar' },
		{ icon: <Users size={17} />, label: 'Team', to: '/team' },
	]

	return (
		<>
			<div
				className={`workspace-overlay md:hidden ${isOpen ? 'is-open' : ''}`}
				onClick={onClose}
			/>
			<aside
				ref={sidebarRef}
				style={{ width: isCollapsed ? 76 : effectiveWidth }}
				className={`workspace-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''} h-full z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
			>
				<div className='workspace-sidebar-main'>
					<div className='workspace-brand-row'>
						<Link to='/workspaces' className='workspace-brand'>
							<span className='brand-mark'>K</span>
							<span>KanbanHub</span>
						</Link>
					</div>
					<div className='workspace-space-label'>
						<span>Workspace</span>
						<span className='workspace-private'>Private</span>
					</div>
					<nav className='workspace-primary-nav'>
						{navItems.map((item) =>
							item.disabled ? (
								<button
									key={item.label}
									className='workspace-nav-item workspace-nav-disabled'
									disabled
									title={item.label}
								>
									{item.icon}
									<span>{item.label}</span>
									<small>Soon</small>
								</button>
							) : (
								<Link
									key={item.label}
									to={item.to}
									onClick={onClose}
									className={`workspace-nav-item ${location.pathname === item.to ? 'active' : ''}`}
									title={item.label}
								>
									{item.icon}
									<span>{item.label}</span>
								</Link>
							),
						)}
					</nav>
					<div className='workspace-rooms-heading'>
						<span>Rooms</span>
						<button
							onClick={onCreateBoard}
							aria-label='Create a room'
							title='Create a room'
						>
							<Plus size={16} />
						</button>
					</div>
					<label className='workspace-room-search'>
						<Search size={15} />
						<input
							value={roomSearch}
							onChange={(event) => setRoomSearch(event.target.value)}
							placeholder='Find a room'
							aria-label='Find a room'
						/>
					</label>
					<RoomGroup
						title='My boards'
						items={ownedBoards}
						isOpen={isOwnedOpen}
						onToggle={() => setIsOwnedOpen((value) => !value)}
						search={roomSearch}
						selectedBoardId={selectedBoardId}
						onBoardSelect={onBoardSelect}
					/>
					<RoomGroup
						title='Shared with me'
						items={sharedBoards}
						isOpen={isSharedOpen}
						onToggle={() => setIsSharedOpen((value) => !value)}
						search={roomSearch}
						selectedBoardId={selectedBoardId}
						onBoardSelect={onBoardSelect}
					/>
					<button className='workspace-create-room' onClick={onCreateBoard}>
						<Plus size={16} /> New room
					</button>
				</div>
			</aside>
			<div
				onMouseDown={(event) => {
					if (!isCollapsed && window.innerWidth >= 768) {
						event.preventDefault()
						isDragging.current = true
						setIsResizing(true)
						document.body.classList.add('sidebar-resizing')
						document.body.style.cursor = 'col-resize'
					}
				}}
				className={`workspace-resize-handle hidden md:block ${isCollapsed ? 'is-disabled' : ''}`}
			/>
		</>
	)
}

export default WorkspaceSidebar
