import { ArrowRight, CalendarDays, CheckCircle2, Circle, Eye, Flag, LayoutGrid, Link2Off, ListChecks, Pin, Search, SearchX } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../app/shell/app-shell.css'
import BoardTile from '../features/boards/BoardTile'
import BrandMark from '../ui/BrandMark'
import { LanguageMenu, ThemeMenu } from '../features/settings/PreferenceMenus'
import '../features/public-board/public-board.css'
import { useI18n } from '../i18n'
import { axiosInstance } from '../lib/axios'
import { sanitizeDescription, toPlainText } from '../lib/richText'
import { useAuthStore } from '../store/useAuthStore'
import { Badge, Button, Chip, EmptyState, Input, LabelBadge, Modal, Skeleton } from '../ui'
import { CARD_COLORS, labelColorKey } from '../features/board/model/cardDisplay'
import { getDueDateKey, getLocalDateKey } from '../lib/dueDate'
import { startPagePath } from '../lib/preferences'
import { relativeTime } from '../lib/relativeTime'
import { dueLabel, dueToneFor, PRIORITY_TONE } from '../features/board/model/taskDisplay'

const hasPriority = (task) => task.priority && task.priority !== 'none'

// The board's saved labels, so each label keeps the colour it has on the board.
const BoardLabelsContext = createContext([])

const TaskMeta = ({ task, done }) => {
	const { t, language } = useI18n()
	const boardLabels = useContext(BoardLabelsContext)
	const dueKey = getDueDateKey(task.dueDate)
	const checked = task.checklist?.filter((item) => item.completed).length || 0
	return (
		<>
			{dueKey && <Badge tone={dueToneFor(task.dueDate, done)}><CalendarDays size={12} aria-hidden='true' />{dueLabel(dueKey, t, language)}</Badge>}
			{hasPriority(task) && <Badge tone={PRIORITY_TONE[task.priority]}><Flag size={12} aria-hidden='true' />{t(`myTasks.priority.${task.priority}`)}</Badge>}
			{task.checklist?.length > 0 && <Badge><ListChecks size={12} aria-hidden='true' />{checked}/{task.checklist.length}</Badge>}
			{task.labels?.map((label) => <LabelBadge key={label} name={label} color={CARD_COLORS[labelColorKey(label, boardLabels)]} />)}
		</>
	)
}

const TaskPanel = ({ task, column, done, onClose }) => {
	const { t } = useI18n()
	const description = task ? sanitizeDescription(task.description || '') : ''
	return (
		<Modal open={Boolean(task)} onClose={onClose} variant='panel' title={task?.title || ''}>
			{task && (
				<div className='pb-task'>
					<dl className='pb-task__facts'>
						<dt>{t('publicBoard.column')}</dt>
						<dd><span data-i18n-ignore>{column?.title}</span>{done && <Badge tone='success'>{t('publicBoard.done')}</Badge>}</dd>
						{(task.dueDate || hasPriority(task) || task.labels?.length > 0) && (
							<>
								<dt>{t('publicBoard.due')} · {t('publicBoard.priorityLabel')}</dt>
								<dd><TaskMeta task={{ ...task, checklist: [] }} done={done} /></dd>
							</>
						)}
					</dl>
					<section>
						<h3 className='pb-task__heading'>{t('publicBoard.description')}</h3>
						{toPlainText(description)
							? <div className='pb-task__description' data-i18n-ignore dangerouslySetInnerHTML={{ __html: description }} />
							: <p className='pb-task__description'>{t('publicBoard.noDescription')}</p>}
					</section>
					{task.checklist?.length > 0 && (
						<section>
							<h3 className='pb-task__heading'>{t('publicBoard.checklist')} · {task.checklist.filter((item) => item.completed).length}/{task.checklist.length}</h3>
							<ul className='pb-task__checklist'>
								{task.checklist.map((item, index) => (
									<li key={item._id || index} className={item.completed ? 'is-done' : undefined}>
										{item.completed ? <CheckCircle2 size={16} aria-label={t('publicBoard.done')} /> : <Circle size={16} aria-hidden='true' />}
										<span data-i18n-ignore>{item.text}</span>
									</li>
								))}
							</ul>
						</section>
					)}
				</div>
			)}
		</Modal>
	)
}

const PublicBoard = () => {
	const { token } = useParams()
	const { t, language } = useI18n()
	const authUser = useAuthStore((state) => state.authUser)
	const [data, setData] = useState(null)
	const [failed, setFailed] = useState(false)
	const [query, setQuery] = useState('')
	const [overdueOnly, setOverdueOnly] = useState(false)
	const [currentColumnId, setCurrentColumnId] = useState('')
	const [openTaskId, setOpenTaskId] = useState('')

	useEffect(() => {
		let ignore = false
		axiosInstance
			.get(`/board/public/${token}`)
			.then(({ data: next }) => {
				if (!ignore) setData(next)
			})
			.catch(() => {
				if (!ignore) setFailed(true)
			})
		return () => {
			ignore = true
		}
	}, [token, authUser?._id])

	const columns = useMemo(() => [...(data?.columns || [])].sort((a, b) => Number(b.pinned) - Number(a.pinned)), [data])
	const doneId = data?.doneColumnId
	const todayKey = getLocalDateKey()
	const isOverdue = (task, columnId) => columnId !== doneId && getDueDateKey(task.dueDate) && getDueDateKey(task.dueDate) < todayKey
	const allTasks = columns.flatMap((column) => column.tasks.map((task) => ({ task, columnId: column._id })))
	const doneCount = allTasks.filter(({ columnId }) => columnId === doneId).length
	const overdueCount = allTasks.filter(({ task, columnId }) => isOverdue(task, columnId)).length
	const needle = query.trim().toLowerCase()
	const matches = (task, columnId) => {
		if (overdueOnly && !isOverdue(task, columnId)) return false
		if (!needle) return true
		return [task.title, toPlainText(task.description || ''), ...(task.labels || [])].some((text) => String(text).toLowerCase().includes(needle))
	}
	const visibleColumns = columns.map((column) => ({ ...column, visibleTasks: column.tasks.filter((task) => matches(task, column._id)) }))
	const filtering = Boolean(needle) || overdueOnly
	const nothingMatches = filtering && visibleColumns.every((column) => !column.visibleTasks.length)
	const current = visibleColumns.find((column) => column._id === currentColumnId) || visibleColumns.find((column) => column.visibleTasks.length) || visibleColumns[0]
	const openTask = allTasks.find(({ task }) => task._id === openTaskId)
	const clearFilters = () => {
		setQuery('')
		setOverdueOnly(false)
	}

	const headerActions = data?.viewer?.isMember ? (
		<Button as={Link} to={`/workspaces/${data.board._id}`} size='sm' iconRight={ArrowRight}>{t('publicBoard.openInApp')}</Button>
	) : authUser ? (
		<Button as={Link} to={startPagePath()} variant='secondary' size='sm' icon={LayoutGrid}>{t('publicBoard.myBoards')}</Button>
	) : (
		<>
			<Button as={Link} to='/login' variant='ghost' size='sm'>{t('publicBoard.signIn')}</Button>
			<Button as={Link} to='/signup' size='sm' className='pb-header__secondary'>{t('publicBoard.createOwn')}</Button>
		</>
	)

	let body
	if (failed) {
		body = (
			<div className='pb-status'>
				<div className='pb-status__card' role='status'>
					<span className='pb-status__icon' aria-hidden='true'><Link2Off size={24} /></span>
					<h1 className='pb-status__title'>{t('publicBoard.invalidTitle')}</h1>
					<p className='pb-status__text'>{t('publicBoard.invalidText')}</p>
					<div className='pb-status__actions'>
						{authUser
							? <Button as={Link} to={startPagePath()} icon={LayoutGrid}>{t('publicBoard.toBoards')}</Button>
							: <Button as={Link} to='/'>{t('publicBoard.home')}</Button>}
					</div>
				</div>
			</div>
		)
	} else if (!data) {
		body = (
			<main className='pb-main' aria-busy='true' aria-label={t('publicBoard.loading')}>
				<Skeleton width={160} height={22} radius={999} />
				<Skeleton width='45%' height={40} />
				<Skeleton width='30%' height={16} />
				<div className='pb-board'>
					{[0, 1, 2, 3].map((index) => <Skeleton key={index} height={260} radius={16} />)}
				</div>
			</main>
		)
	} else {
		const updated = relativeTime(data.board.updatedAt, language, t('publicBoard.justNow'))
		body = (
			<main className='pb-main'>
				<section className='pb-hero'>
					<div className='pb-hero__tags'>
						<Badge tone='accent'><Eye size={12} aria-hidden='true' />{t('publicBoard.eyebrow')}</Badge>
						<Badge>{t('publicBoard.readOnly')}</Badge>
					</div>
					<h1 className='pb-hero__title'>
						<BoardTile board={data.board} size={44} />
						<span data-i18n-ignore>{data.board.name}</span>
					</h1>
					<div className='pb-hero__meta'>
						<span>{t('publicBoard.tasks', { count: allTasks.length })}</span>
						{doneId && allTasks.length > 0 && (
							<span className='pb-progress'>
								<span className='pb-progress__bar' aria-hidden='true'><span style={{ width: `${Math.round((doneCount / allTasks.length) * 100)}%` }} /></span>
								{t('publicBoard.progress', { done: doneCount, total: allTasks.length })}
							</span>
						)}
						{overdueCount > 0 && <Badge tone='danger'>{t('publicBoard.overdue', { count: overdueCount })}</Badge>}
						{updated && <span>{t('publicBoard.updated', { time: updated })}</span>}
					</div>
				</section>

				{columns.length === 0 ? (
					<div className='pb-empty'><EmptyState icon={LayoutGrid} title={t('publicBoard.emptyBoard')} description={t('publicBoard.emptyBoardText')} /></div>
				) : (
					<>
						<div className='pb-toolbar'>
							<div className='pb-toolbar__search'>
								<Input icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('publicBoard.search')} aria-label={t('publicBoard.searchLabel')} />
							</div>
							{overdueCount > 0 && (
								<Chip pressed={overdueOnly} onClick={() => setOverdueOnly((value) => !value)}>
									{t('publicBoard.overdueOnly')} <span className='ui-segmented__count'>{overdueCount}</span>
								</Chip>
							)}
						</div>

						{nothingMatches ? (
							<div className='pb-empty'>
								<EmptyState icon={SearchX} title={t('publicBoard.noMatches')} action={<Button variant='secondary' onClick={clearFilters}>{t('publicBoard.clearFilters')}</Button>} />
							</div>
						) : (
							<>
								<div className='pb-tabs' role='group' aria-label={t('publicBoard.columns')}>
									{visibleColumns.map((column) => (
										<Chip key={column._id} pressed={current?._id === column._id} onClick={() => setCurrentColumnId(column._id)}>
											<span data-i18n-ignore>{column.title}</span> <span className='ui-segmented__count'>{column.visibleTasks.length}</span>
										</Chip>
									))}
								</div>
								<div className='pb-board'>
									{visibleColumns.map((column) => (
										<section key={column._id} className={`pb-column${current?._id === column._id ? ' is-current' : ''}`} aria-labelledby={`pb-col-${column._id}`}>
											<div className='pb-column__head'>
												<h2 className='pb-column__title' id={`pb-col-${column._id}`} data-i18n-ignore>{column.title}</h2>
												{column.pinned && <Pin size={13} className='pb-column__pin' aria-label={t('publicBoard.pinned')} />}
												<span className='pb-column__count'>{column.visibleTasks.length}</span>
											</div>
											{column.visibleTasks.length ? (
												<ul className='pb-list'>
													{column.visibleTasks.map((task) => {
														const done = column._id === doneId
														const excerpt = toPlainText(task.description || '')
														return (
															<li key={task._id}>
																<button type='button' className={`pb-card${done ? ' is-done' : ''}`} onClick={() => setOpenTaskId(task._id)} aria-label={t('publicBoard.openTask', { title: task.title })}>
																	<span className='pb-card__title' data-i18n-ignore>{task.title}</span>
																	{excerpt && <span className='pb-card__excerpt' data-i18n-ignore>{excerpt}</span>}
																	<span className='pb-card__meta'><TaskMeta task={task} done={done} /></span>
																</button>
															</li>
														)
													})}
												</ul>
											) : (
												<p className='pb-column__empty'>{t('publicBoard.columnEmpty')}</p>
											)}
										</section>
									))}
								</div>
							</>
						)}
					</>
				)}
			</main>
		)
	}

	return (
		<BoardLabelsContext.Provider value={data?.board?.labels || []}>
		<div className='pb'>
			<header className='pb-header'>
				<Link to='/' className='pb-header__brand' aria-label={t('common.homeLink')}><BrandMark /></Link>
				<div className='pb-header__actions'>
					<LanguageMenu />
					<ThemeMenu />
					{headerActions}
				</div>
			</header>
			{body}
			{data && !data.viewer?.isMember && !authUser && (
				<footer className='pb-footer'>
					{t('publicBoard.footer')} <Link to='/signup'>{t('publicBoard.createOwn')}</Link>
				</footer>
			)}
			<TaskPanel task={openTask?.task} column={columns.find((column) => column._id === openTask?.columnId)} done={openTask?.columnId === doneId} onClose={() => setOpenTaskId('')} />
		</div>
		</BoardLabelsContext.Provider>
	)
}

export default PublicBoard
