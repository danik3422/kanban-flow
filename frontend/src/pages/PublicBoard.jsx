import { ArrowLeft, CalendarDays, CheckSquare, Eye, LockKeyhole, Pin, Rows3, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'

const PublicBoard = () => {
	const { token } = useParams()
	const authUser = useAuthStore((state) => state.authUser)
	const [boardData, setBoardData] = useState(null)
	const [error, setError] = useState('')

	useEffect(() => {
		axiosInstance
			.get(`/board/public/${token}`)
			.then(({ data }) => setBoardData(data))
			.catch((requestError) => setError(requestError.response?.data?.message || 'This public room is unavailable'))
	}, [token])

	if (error) {
		return (
			<main className='public-board-page public-board-error'>
				<section className='public-board-empty' role='status'>
					<div className='public-board-empty-icon'><LockKeyhole size={25} /></div>
					<p className='eyebrow'>Public room</p>
					<h1>Public room unavailable</h1>
					<p className='public-board-error-copy'>This viewing link is invalid, expired, or no longer shared.</p>
					<div className='public-board-error-detail'>{error}</div>
					<Link className='primary-button' to={authUser ? '/workspaces' : '/'}><ArrowLeft size={16} /> {authUser ? 'Back to workspace' : 'Back home'}</Link>
				</section>
			</main>
		)
	}

	if (!boardData) {
		return (
			<main className='public-board-page public-board-loading' aria-busy='true' aria-live='polite'>
				<div className='public-board-loading-shell'>
					<div className='public-board-loading-kicker' />
					<div className='public-board-loading-title' />
					<div className='public-board-loading-subtitle' />
					<div className='public-board-loading-summary'>
						<span /><span />
					</div>
					<div className='public-board-loading-columns'>
						{[1, 2, 3, 4, 5].map((column) => (
							<div className='public-board-loading-column' key={column}>
								<div className='public-board-loading-column-title' />
								<div className='public-board-loading-card' />
								{column === 1 && <div className='public-board-loading-card short' />}
							</div>
						))}
					</div>
					<p className='public-board-loading-label'>Loading public room...</p>
				</div>
			</main>
		)
	}

	const orderedColumns = [...boardData.columns].sort((left, right) => Number(right.pinned) - Number(left.pinned))
	const taskCount = orderedColumns.reduce((total, column) => total + column.tasks.length, 0)
	const formatDueDate = (dueDate) => {
		if (!dueDate) return ''
		return new Date(dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })
	}

	return (
		<main className='public-board-page'>
			<header className='public-board-header'>
				<div>
					<div className='public-board-kicker-row'>
						<p className='eyebrow'><Eye size={14} /> Public room</p>
						<span className='public-board-readonly'><ShieldCheck size={13} /> Read-only</span>
					</div>
					<h1>{boardData.board.name}</h1>
					<p className='public-board-subtitle'>A shared snapshot of this room. You can browse the work, but changes are disabled.</p>
				</div>
			</header>
			<div className='public-board-summary' aria-label='Board summary'>
				<span><Rows3 size={15} /> {orderedColumns.length} {orderedColumns.length === 1 ? 'column' : 'columns'}</span>
				<span>{taskCount} {taskCount === 1 ? 'card' : 'cards'}</span>
			</div>
			<div className='public-board-scroll'>
				<section
					className='public-board-grid'
					style={{ '--public-column-count': orderedColumns.length }}
					aria-label={`${boardData.board.name} columns`}
				>
					{orderedColumns.map((column) => (
						<section className='public-board-column' key={column._id}>
						<div className='public-board-column-heading'>
							<div className='public-board-column-title'>
								<h2>{column.title}</h2>
								{column.pinned && <Pin className='public-board-pinned-icon' size={14} fill='currentColor' aria-label='Pinned column' title='Pinned column' />}
							</div>
							<span>{column.tasks.length}</span>
						</div>
						<div className='public-board-task-list'>
							{column.tasks.map((task) => (
								<article className='public-board-task' key={task._id}>
									<strong>{task.title}</strong>
									{task.description && <p>{task.description.replace(/<[^>]*>/g, '')}</p>}
									{task.labels?.length > 0 && <div className='public-board-labels'>{task.labels.map((label) => <span key={label}>{label}</span>)}</div>}
									{(task.priority || task.dueDate || task.checklist?.length > 0) && (
										<div className='public-board-task-meta'>
											{task.priority && <span className={`public-board-priority is-${task.priority}`}>{task.priority}</span>}
											{task.dueDate && <span><CalendarDays size={12} /> {formatDueDate(task.dueDate)}</span>}
											{task.checklist?.length > 0 && <span><CheckSquare size={12} /> {task.checklist.filter((item) => item.completed).length}/{task.checklist.length}</span>}
										</div>
									)}
								</article>
							))}
							{column.tasks.length === 0 && (
								<div className='public-board-column-empty'>
									<span>No cards in this column</span>
									<small>New work will appear here when the room is updated.</small>
								</div>
							)}
						</div>
						</section>
					))}
				</section>
			</div>
		</main>
	)
}

export default PublicBoard
