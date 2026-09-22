import { Check, ChevronDown, ChevronRight, Copy, Search, Users, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import { fetchBoardMembersWithCache } from '../lib/boardMembersCache'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'
import { handleAvatarError } from '../utils/avatar'
import { useAuthStore } from '../store/useAuthStore'

const getInitials = (person) => {
	const name = person.name || person.email || '?'
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join('')
		.toUpperCase()
}

const avatarColors = ['#aa6687', '#77a65c', '#c8754d', '#6486b4', '#6d9f59', '#8c6ba8']
const roleOrder = ['owner', 'admin', 'member']
const roleLabels = { owner: 'Owner', admin: 'Admin', member: 'Member' }

const Team = () => {
	const authUser = useAuthStore((state) => state.authUser)
	const navigate = useNavigate()
	const [boards, setBoards] = useState([])
	const [people, setPeople] = useState([])
	const [search, setSearch] = useState('')
	const [roleFilter, setRoleFilter] = useState('all')
	const [sortBy, setSortBy] = useState('name')
	const [copiedEmail, setCopiedEmail] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const {
		isSidebarOpen,
		setIsSidebarOpen,
		isSidebarCollapsed,
		setIsSidebarCollapsed,
	} = useWorkspaceNavigation()

	useEffect(() => {
		let isCurrent = true
		const loadTeam = async () => {
			try {
				const boardList = await fetchBoardsWithCache(authUser?._id)
				if (!Array.isArray(boardList) || boardList.length === 0) {
					if (isCurrent) {
						setBoards([])
						setPeople([])
					}
					return
				}
				const results = await Promise.all(
					boardList.map(async (board) => {
						const members = await fetchBoardMembersWithCache(authUser?._id, board._id)
						return { board, members: Array.isArray(members) ? members : [] }
					}),
				)
				const peopleById = new Map()
				results.forEach(({ board, members }) => {
					members.forEach((member) => {
						const user = member.user
						if (!user?._id) return
						const personId = String(user._id)
						const isOwner = String(board.createdBy) === personId
						const role = isOwner ? 'owner' : member.role || 'member'
						const existing = peopleById.get(personId)
						if (existing) {
							existing.boards += 1
							existing.roleCounts[role] = (existing.roleCounts[role] || 0) + 1
							existing.rooms.push({ id: board._id, name: board.name, role })
							return
						}
						peopleById.set(personId, {
							...user,
							roleCounts: { owner: role === 'owner' ? 1 : 0, admin: role === 'admin' ? 1 : 0, member: role === 'member' ? 1 : 0 },
							boards: 1,
							rooms: [{ id: board._id, name: board.name, role }],
						})
					})
				})
				if (isCurrent) {
					setBoards(boardList)
					setPeople(Array.from(peopleById.values()))
				}
			} catch (error) {
				if (isCurrent && ![404, 204].includes(error.response?.status)) {
					toast.error(error.response?.data?.message || 'Could not load team')
				}
			} finally {
				if (isCurrent) setIsLoading(false)
			}
		}
		loadTeam()
		return () => {
			isCurrent = false
		}
	}, [authUser?._id])

	const filteredPeople = useMemo(() => {
		const query = search.trim().toLowerCase()
		return people.filter((person) =>
			(roleFilter === 'all' || person.roleCounts[roleFilter] > 0) &&
			(!query || [person.name, person.email, ...person.rooms.map((room) => room.name), ...roleOrder.filter((role) => person.roleCounts[role])].some((value) =>
				String(value || '').toLowerCase().includes(query),
			)),
		)
	}, [people, roleFilter, search])

	const sortedPeople = useMemo(() => [...filteredPeople].sort((first, second) => {
		if (sortBy === 'rooms') return second.boards - first.boards
		return (first.name || first.email).localeCompare(second.name || second.email)
	}), [filteredPeople, sortBy])

	const ownerCount = people.filter((person) => person.roleCounts.owner > 0).length
	const adminCount = people.filter((person) => person.roleCounts.admin > 0).length
	const memberCount = people.filter((person) => person.roleCounts.member > 0).length

	const copyEmail = async (email) => {
		try {
			await navigator.clipboard.writeText(email)
			setCopiedEmail(email)
			toast.success('Email copied')
			window.setTimeout(() => setCopiedEmail((current) => current === email ? '' : current), 1600)
		} catch {
			toast.error('Could not copy email')
		}
	}

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
			<main className='workspace-main team-page-main flex-1 overflow-auto'>
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
																<ChevronRight size={13} /> Team
							</span>
						</div>
					</div>
				</WorkspaceTopbar>
				<section className='workspace-content team-page'>
					<header className='team-page-header'>
						<div className='team-summary'>
							{isLoading ? [1, 2, 3, 4].map((item) => <span className='team-loading-summary-pill' key={item} />) : <>
								<span>{people.length} people</span>
								<span>{ownerCount} {ownerCount === 1 ? 'owner' : 'owners'}</span>
								<span>{adminCount} {adminCount === 1 ? 'admin' : 'admins'}</span>
								<span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
							</>}
						</div>
					</header>
					<div className={`team-toolbar ${isLoading ? 'is-loading' : ''}`}>
						<div className={`team-search-wrap ${isLoading ? 'team-loading-control' : ''}`}>
							{isLoading ? <><Search size={15} aria-hidden='true' /><span className='team-loading-control-fill' /></> : <>
							<Search size={15} />
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder='Search people'
								aria-label='Search people'
							/>
							</>}
						</div>
						<div className={`team-filter-wrap ${isLoading ? 'team-loading-control' : ''}`}>
							{isLoading ? <span className='team-loading-control-fill' /> : <>
							<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label='Filter by role'>
								<option value='all'>All roles</option>
								<option value='owner'>Owners</option>
								<option value='admin'>Admins</option>
								<option value='member'>Members</option>
							</select>
							<ChevronDown size={14} />
							</>}
						</div>
						<div className={`team-filter-wrap ${isLoading ? 'team-loading-control' : ''}`}>
							{isLoading ? <span className='team-loading-control-fill' /> : <>
							<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label='Sort team'>
								<option value='name'>Sort by name</option>
								<option value='rooms'>Most rooms</option>
							</select>
							<ChevronDown size={14} />
							</>}
						</div>
					</div>
					{isLoading ? (
						<div className='team-loading-grid' role='status' aria-live='polite'>
							{Array.from({ length: 8 }, (_, index) => index + 1).map((card) => (
								<article className='team-person-card team-loading-card' key={card}>
									<div className='team-avatar team-loading-avatar' />
									<strong className='team-loading-line wide' />
									<button type='button' className='team-email-copy team-loading-line' aria-hidden='true' tabIndex='-1' />
									<div className='team-role-list team-loading-tags'><span className='team-role' /><span className='team-role' /></div>
									<div className='team-room-list team-loading-room-list'><span /><span /><i /></div>
									<div className='team-card-footer team-loading-footer' />
								</article>
							))}
						</div>
					) : sortedPeople.length ? (
						<div className='team-grid'>
							{sortedPeople.map((person, index) => (
								<article className='team-person-card' key={person._id}>
									{person.avatar ? (
										<img className='team-avatar' src={person.avatar} onError={handleAvatarError} alt='' />
									) : (
										<div className='team-avatar' style={{ background: avatarColors[index % avatarColors.length] }}>
											{getInitials(person)}
										</div>
									)}
									<strong>{person.name || person.email}</strong>
									<button
										type='button'
										className='team-email-copy'
										onClick={() => copyEmail(person.email)}
										title='Copy email'
									>
										<span>{person.email}</span>
										{copiedEmail === person.email ? <Check size={13} /> : <Copy size={13} />}
									</button>
									<div className='team-role-list'>
										{roleOrder.filter((role) => person.roleCounts[role] > 0).map((role) => (
											<span className={`team-role is-${role}`} key={role}>
												{roleLabels[role]} · {person.roleCounts[role]} {person.roleCounts[role] === 1 ? 'room' : 'rooms'}
											</span>
										))}
									</div>
									<div className='team-room-list'>
										{person.rooms.slice(0, 2).map((room) => (
											<button
												type='button'
												key={`${person._id}-${room.id}`}
												onClick={() => navigate(`/workspaces/${room.id}`)}
												title={`${roleLabels[room.role]} in ${room.name}`}
											>
												{room.name} · {roleLabels[room.role]}
											</button>
										))}
										{person.rooms.length > 2 && <span>+{person.rooms.length - 2} more</span>}
									</div>
									<div className='team-card-footer'>On {person.boards} {person.boards === 1 ? 'room' : 'rooms'}</div>
								</article>
							))}
						</div>
					) : (
						<div className='team-empty'>
							<UserRound size={24} />
							<strong>{search ? 'No people found' : 'No team members yet'}</strong>
							<span>{search ? 'Try another search.' : 'Invite people to a room to see them here.'}</span>
						</div>
					)}
				</section>
			</main>
		</div>
	)
}

export default Team
