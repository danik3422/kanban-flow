import { ArrowLeft, Eye, FolderKanban, LockKeyhole } from 'lucide-react'
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
				<header className='public-board-error-header'>
					<Link className='public-board-brand' to='/'><FolderKanban size={18} /> KanbanHub</Link>
					<span className='public-board-error-badge'><LockKeyhole size={14} /> Link status</span>
				</header>
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
		return <main className='public-board-page'><div className='public-board-loading'>Loading public room...</div></main>
	}

	return (
		<main className='public-board-page'>
			<header className='public-board-header'>
				<div>
					<p className='eyebrow'><Eye size={14} /> Public room</p>
					<h1>{boardData.board.name}</h1>
					<p>Read-only view shared from KanbanHub.</p>
				</div>
				<Link className='public-board-brand' to='/'><FolderKanban size={18} /> KanbanHub</Link>
			</header>
			<section className='public-board-grid' aria-label={`${boardData.board.name} columns`}>
				{boardData.columns.map((column) => (
					<section className='public-board-column' key={column._id}>
						<div className='public-board-column-heading'>
							<h2>{column.title}</h2>
							<span>{column.tasks.length}</span>
						</div>
						<div className='public-board-task-list'>
							{column.tasks.map((task) => (
								<article className='public-board-task' key={task._id}>
									<strong>{task.title}</strong>
									{task.description && <p>{task.description.replace(/<[^>]*>/g, '')}</p>}
									{task.labels?.length > 0 && <div className='public-board-labels'>{task.labels.map((label) => <span key={label}>{label}</span>)}</div>}
								</article>
							))}
							{column.tasks.length === 0 && <p className='public-board-column-empty'>No cards yet.</p>}
						</div>
					</section>
				))}
			</section>
		</main>
	)
}

export default PublicBoard
