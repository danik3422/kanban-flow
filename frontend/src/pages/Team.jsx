import { ArrowUpDown, Check, Copy, Mail, MoreHorizontal, Plus, Search, SearchX, Send, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import '../components/team/team.css'
import InviteDialog from '../components/team/InviteDialog'
import PersonPanel from '../components/team/PersonPanel'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'
import { useI18n } from '../i18n'
import { translateServerMessageCurrent } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { Avatar, Badge, Button, EmptyState, IconButton, Input, Menu, PageHeader, SegmentedControl, Select, Skeleton } from '../ui'
import { cx } from '../ui/utils'
import { boardToneFor } from '../utils/boardTone'

const SORTS = ['name', 'open', 'overdue']
const MANAGES = ['owner', 'admin']

// Everyone across my boards, merged into one entry per person with their role and load per board.
const buildPeople = (results) => {
	const people = new Map()
	for (const { board, members } of results) {
		const canManage = MANAGES.includes(board.role)
		for (const member of members) {
			const user = member.user
			if (!user?._id) continue
			const id = String(user._id)
			const role = String(board.createdBy) === id ? 'owner' : member.role || 'member'
			const person = people.get(id) || { ...user, _id: id, memberships: [], open: 0, overdue: 0 }
			person.memberships.push({
				boardId: board._id,
				boardName: board.name,
				memberId: member._id,
				role,
				canManage,
				open: member.openTasks || 0,
				overdue: member.overdueTasks || 0,
			})
			person.open += member.openTasks || 0
			person.overdue += member.overdueTasks || 0
			people.set(id, person)
		}
	}
	return [...people.values()]
}

const Team = () => {
	const { t } = useI18n()
	const navigate = useNavigate()
	const authUser = useAuthStore((state) => state.authUser)
	const myId = String(authUser?._id || '')
	const [searchParams, setSearchParams] = useSearchParams()
	const [results, setResults] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [reloadKey, setReloadKey] = useState(0)
	const [query, setQuery] = useState('')
	const [boardFilter, setBoardFilter] = useState('all')
	const [mode, setMode] = useState('all')
	const [sort, setSort] = useState('name')
	const [inviteFor, setInviteFor] = useState(null)
	const { isSidebarCollapsed, setIsSidebarCollapsed } = useWorkspaceNavigation()

	useEffect(() => {
		let ignore = false
		axiosInstance.get('/board/team')
			.then(({ data }) => {
				if (ignore) return
				setResults(Array.isArray(data) ? data : [])
				setLoadError('')
			})
			.catch((error) => {
				if (!ignore) setLoadError(translateServerMessageCurrent(error.response?.data?.message, 'team.loadError'))
			})
			.finally(() => {
				if (!ignore) setIsLoading(false)
			})
		return () => {
			ignore = true
		}
	}, [authUser?._id, reloadKey])

	const boards = useMemo(() => results.map(({ board }) => board), [results])
	const managedBoards = boards.filter((board) => MANAGES.includes(board.role))
	const people = useMemo(() => buildPeople(results), [results])
	const me = people.find((person) => person._id === myId)
	const others = people.filter((person) => person._id !== myId)
	const filtersActive = Boolean(query.trim()) || boardFilter !== 'all' || mode !== 'all'

	const visible = useMemo(() => {
		const needle = query.trim().toLocaleLowerCase()
		return others
			.filter((person) => boardFilter === 'all' || person.memberships.some((membership) => membership.boardId === boardFilter))
			.filter((person) => mode !== 'managed' || person.memberships.some((membership) => membership.canManage))
			.filter((person) => mode !== 'overdue' || person.overdue > 0)
			.filter((person) => !needle || [person.name, person.email, ...person.memberships.map((membership) => membership.boardName)].some((value) => String(value || '').toLocaleLowerCase().includes(needle)))
			.sort((left, right) => (sort === 'open' ? right.open - left.open : sort === 'overdue' ? right.overdue - left.overdue : 0)
				|| (left.name || left.email).localeCompare(right.name || right.email))
	}, [others, query, boardFilter, mode, sort])

	const selectedId = searchParams.get('person')
	const selected = people.find((person) => person._id === selectedId) || null
	const openPerson = (person) => setSearchParams((params) => {
		params.set('person', person._id)
		return params
	})
	const closePerson = () => setSearchParams((params) => {
		params.delete('person')
		return params
	}, { replace: true })

	const copyEmail = async (email) => {
		try {
			await navigator.clipboard.writeText(email)
			toast.success(t('team.emailCopied'))
		} catch {
			toast.error(t('team.copyError'))
		}
	}
	const resetFilters = () => {
		setQuery('')
		setBoardFilter('all')
		setMode('all')
	}
	const sendInvite = async (boardId, email) => {
		try {
			await axiosInstance.post(`/board/boards/${boardId}/invites`, { email, role: 'member' })
			toast.success(t('team.inviteSent', { email }))
		} catch (error) {
			toast.error(error.response?.status === 409 ? t('team.inviteExists', { email }) : translateServerMessageCurrent(error.response?.data?.message, 'team.inviteError'))
		}
	}

	const totals = { people: others.length, open: others.reduce((sum, person) => sum + person.open, 0), overdue: others.reduce((sum, person) => sum + person.overdue, 0) }

	const personRow = (person, isMe) => {
		const name = person.name || person.email
		const shown = person.memberships.slice(0, 2)
		const invitable = managedBoards.filter((board) => !person.memberships.some((membership) => membership.boardId === board._id))
		return (
			<li key={person._id} className='tm-row'>
				<button type='button' className='tm-row__main' onClick={() => openPerson(person)} aria-label={t('team.openPerson', { name })} data-i18n-ignore>
					<Avatar name={name} src={person.avatar} size={36} decorative />
					<span className='tm-row__who'>
						<span className='tm-row__name'>{name}{isMe && <Badge tone='accent'>{t('team.you')}</Badge>}</span>
						<span className='tm-row__email'>{person.email}</span>
						<span className='tm-row__summary'>{t('team.boards', { count: person.memberships.length })} · {person.open ? t('team.open', { count: person.open }) : t('team.nothingOpen')}</span>
					</span>
					<span className='tm-row__boards'>
						{shown.map((membership) => (
							<span key={membership.boardId} className='tm-chip'>
								<i style={{ background: `var(--ui-${boardToneFor(membership.boardId)}-soft-text)` }} aria-hidden='true' />
								<span className='tm-chip__name'>{membership.boardName}</span>
								{membership.role !== 'member' && <span className='tm-chip__role'>{t(`team.role.${membership.role}`)}</span>}
							</span>
						))}
						{person.memberships.length > shown.length && <span className='tm-chip tm-chip--more'>{t('team.moreBoards', { count: person.memberships.length - shown.length })}</span>}
					</span>
					<span className='tm-row__load'>
						<span className={cx(!person.open && 'is-muted')}>{person.open ? t('team.open', { count: person.open }) : '—'}</span>
						{person.overdue > 0 && <Badge tone='danger'>{t('team.overdue', { count: person.overdue })}</Badge>}
					</span>
				</button>
				<span className='tm-row__menu'>
					<Menu
						label={t('team.actions', { name })}
						trigger={(props) => <IconButton icon={MoreHorizontal} size='sm' label={t('team.actions', { name })} {...props} />}
						items={[
							{ label: t('team.copyEmail'), icon: Copy, onSelect: () => copyEmail(person.email) },
							{ label: t('team.writeEmail'), icon: Mail, href: `mailto:${person.email}` },
							!isMe && invitable.length > 0 && { label: t('team.inviteToBoard'), icon: Send, onSelect: () => setInviteFor({ email: person.email, boards: invitable }) },
						]}
					/>
				</span>
			</li>
		)
	}

	let body
	if (isLoading) {
		body = (
			<ul className='tm-list' role='status' aria-label={t('team.loading')}>
				{[0, 1, 2, 3].map((index) => (
					<li key={index} className='tm-row is-loading'><span className='tm-row__main'><Skeleton width={36} height={36} radius={999} /><span className='tm-row__who'><Skeleton width='40%' height={15} /><Skeleton width='60%' height={12} /></span></span></li>
				))}
			</ul>
		)
	} else if (loadError) {
		body = <EmptyState icon={Users} tone='danger' title={loadError} action={<Button variant='secondary' onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>{t('common.retry')}</Button>} />
	} else if (!boards.length) {
		body = <EmptyState icon={Users} title={t('team.emptyNoBoardsTitle')} description={t('team.emptyNoBoardsText')} action={<Button icon={Plus} onClick={() => navigate('/workspaces', { state: { createBoard: true } })}>{t('team.createBoard')}</Button>} />
	} else {
		body = (
			<>
				{me && !filtersActive && (
					<section className='tm-section' aria-labelledby='tm-you'>
						<h2 className='tm-section__title' id='tm-you'>{t('team.youSection')}</h2>
						<ul className='tm-list'>{personRow(me, true)}</ul>
					</section>
				)}
				{!others.length ? (
					<EmptyState
						icon={Users}
						title={t('team.emptyAloneTitle')}
						description={t('team.emptyAloneText')}
						action={managedBoards.length > 0 && <Button icon={Send} onClick={() => setInviteFor({ email: '', boards: managedBoards })}>{t('team.inviteToBoard').replace('…', '')}</Button>}
					/>
				) : visible.length ? (
					<section className='tm-section' aria-labelledby='tm-others'>
						<h2 className='tm-section__title' id='tm-others'>{t('team.othersSection')}</h2>
						<ul className='tm-list'>{visible.map((person) => personRow(person, false))}</ul>
					</section>
				) : (
					<EmptyState icon={SearchX} title={t('team.emptyNoMatch')} action={<Button variant='secondary' onClick={resetFilters}>{t('team.resetFilters')}</Button>} />
				)}
			</>
		)
	}

	return (
		<div className='workspace-shell flex h-dvh'>
			<WorkspaceSidebar
				boards={boards}
				selectedBoardId={null}
				onBoardSelect={(board) => navigate(`/workspaces/${board._id}`)}
				onCreateBoard={() => navigate('/workspaces', { state: { createBoard: true } })}
				isCollapsed={isSidebarCollapsed}
			/>
			<main className='workspace-main flex-1 overflow-auto'>
				<WorkspaceTopbar isSidebarCollapsed={isSidebarCollapsed} onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}>
					<span className='app-topbar__title'>{t('team.title')}</span>
				</WorkspaceTopbar>
				<div className='app-page tm-page'>
					<PageHeader title={t('team.title')} description={boards.length ? t('team.description', { count: boards.length }) : undefined} />
					{!isLoading && boards.length > 0 && others.length > 0 && (
						<>
							<div className='tm-stats'>
								<div className='tm-stat'><span className='tm-stat__value'>{totals.people}</span><span className='tm-stat__label'>{t('team.stats.people')}</span></div>
								<div className='tm-stat'><span className='tm-stat__value'>{totals.open}</span><span className='tm-stat__label'>{t('team.stats.open')}</span></div>
								<button
									type='button'
									className={cx('tm-stat', totals.overdue > 0 && 'tm-stat--danger')}
									onClick={() => setMode(mode === 'overdue' ? 'all' : 'overdue')}
									aria-pressed={mode === 'overdue'}
									disabled={!totals.overdue}
								>
									<span className='tm-stat__value'>{totals.overdue}</span>
									<span className='tm-stat__label'>{t('team.stats.overdue')}</span>
								</button>
							</div>
							<div className='tm-toolbar'>
								<div className='tm-toolbar__search'>
									<Input icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('team.searchPlaceholder')} aria-label={t('team.searchLabel')} />
								</div>
								<Select className='tm-toolbar__board' aria-label={t('team.boardFilter')} value={boardFilter} onChange={(event) => setBoardFilter(event.target.value)} options={[{ value: 'all', label: t('team.allBoards') }, ...boards.map((board) => ({ value: board._id, label: board.name }))]} />
								<SegmentedControl
									className='tm-toolbar__mode'
									label={t('team.show')}
									value={mode}
									onChange={setMode}
									options={[
										{ value: 'all', label: t('team.filterAll') },
										...(managedBoards.length ? [{ value: 'managed', label: t('team.filterManaged') }] : []),
										{ value: 'overdue', label: t('team.filterOverdue') },
									]}
								/>
								<Menu
									label={t('team.sortLabel')}
									trigger={(props) => <IconButton icon={ArrowUpDown} variant='secondary' label={`${t('team.sortLabel')}: ${t(`team.sort${sort[0].toUpperCase()}${sort.slice(1)}`)}`} {...props} />}
									items={SORTS.map((value) => ({
										label: t(`team.sort${value[0].toUpperCase()}${value.slice(1)}`),
										icon: value === sort ? Check : undefined,
										checked: value === sort,
										onSelect: () => setSort(value),
									}))}
								/>
							</div>
						</>
					)}
					{body}
				</div>
			</main>
			<PersonPanel
				key={selected?._id || 'none'}
				person={selected}
				isMe={selected?._id === myId}
				managedBoards={managedBoards}
				onClose={closePerson}
				onCopyEmail={copyEmail}
				onInvite={(boardId) => sendInvite(boardId, selected.email)}
				onChanged={({ message, error, reload }) => {
					if (error) toast.error(error)
					else toast.success(message)
					if (reload || !error) setReloadKey((key) => key + 1)
				}}
			/>
			<InviteDialog
				open={Boolean(inviteFor)}
				onClose={() => setInviteFor(null)}
				boards={inviteFor?.boards || []}
				email={inviteFor?.email || ''}
				onSent={(email) => toast.success(t('team.inviteSent', { email }))}
			/>
		</div>
	)
}

export default Team
