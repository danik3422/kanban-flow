import {
	ArrowRight,
	CheckCircle2,
	ClipboardList,
	Layers3,
	Plus,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const HomeHero = () => {
	const { authUser } = useAuthStore()
	const [draggedCard, setDraggedCard] = useState(null)
	const [touchDrag, setTouchDrag] = useState(null)
	const [heroColumns, setHeroColumns] = useState([
		{
			id: 'backlog',
			title: 'BACKLOG',
			tasks: [
				{
					id: 'research',
					label: 'Research',
					title: 'Interview five users',
					meta: 'Today',
				},
				{ id: 'planning', label: 'Planning', title: 'Outline launch brief' },
			],
		},
		{
			id: 'progress',
			title: 'IN PROGRESS',
			tasks: [
				{
					id: 'design',
					label: 'Design',
					title: 'Polish onboarding flow',
					meta: '4 subtasks',
					accent: 'teal',
				},
				{ id: 'content', label: 'Content', title: 'Write release notes' },
			],
		},
		{
			id: 'done',
			title: 'DONE',
			tasks: [
				{
					id: 'analytics',
					label: 'Shipped',
					title: 'Set up analytics',
					meta: 'Complete',
					accent: 'done',
				},
			],
		},
	])

	const moveHeroCard = (targetColumnId) => {
		if (!draggedCard) return
		setHeroColumns((current) => {
			const sourceColumn = current.find((column) =>
				column.tasks.some((task) => task.id === draggedCard.id),
			)
			if (!sourceColumn || sourceColumn.id === targetColumnId) return current
			const card = sourceColumn.tasks.find((task) => task.id === draggedCard.id)
			return current.map((column) =>
				column.id === sourceColumn.id
					? {
							...column,
							tasks: column.tasks.filter((task) => task.id !== draggedCard.id),
						}
					: column.id === targetColumnId
						? { ...column, tasks: [...column.tasks, card] }
						: column,
			)
		})
		setDraggedCard(null)
	}

	const handleTouchStart = (event, task) => {
		event.preventDefault()
		const touch = event.touches[0]
		setDraggedCard(task)
		setTouchDrag({ task, x: touch.clientX, y: touch.clientY })
	}

	const handleTouchMove = (event) => {
		event.preventDefault()
		const touch = event.touches[0]
		setTouchDrag((current) =>
			current ? { ...current, x: touch.clientX, y: touch.clientY } : current,
		)
	}

	const handleTouchEnd = (event) => {
		const touch = event.changedTouches[0]
		const target = document.elementFromPoint(touch.clientX, touch.clientY)
		const column = target?.closest('[data-hero-column]')
		moveHeroCard(column?.dataset.heroColumn)
		setTouchDrag(null)
	}

	const handleTouchCancel = () => {
		setDraggedCard(null)
		setTouchDrag(null)
	}

	return (
		<section className='hero-section hero-entrance'>
			<div className='hero-copy hero-entrance-copy'>
				<p className='hero-kicker'>
					<span className='brand-mark'>K</span> A calmer way to get work done
				</p>
				<h1>Make progress visible.</h1>
				<p className='hero-description'>
					KanbanHub gives your projects a clear rhythm: capture the work, focus
					the team, and celebrate what moves forward.
				</p>
				<div className='hero-actions'>
					{authUser ? (
						<Link to='/workspaces' className='hero-primary'>
							Open workspace <ArrowRight size={17} />
						</Link>
					) : (
						<>
							<Link to='/signup' className='hero-primary'>
								Start for free <ArrowRight size={17} />
							</Link>
							<Link to='/login' className='hero-secondary'>
								Log in
							</Link>
						</>
					)}
				</div>
				<div className='hero-proof'>
					<CheckCircle2 size={16} /> No credit card <span />{' '}
					<CheckCircle2 size={16} /> Ready in minutes
				</div>
			</div>
			<div
				className='hero-board hero-entrance-board'
				aria-label='Preview of a Kanban board'
			>
				<div className='hero-board-top'>
					<div>
						<span className='hero-dot' />
						<span className='hero-dot muted' />
						<span className='hero-dot muted' />
					</div>
					<span>Product launch</span>
					<Layers3 size={16} />
				</div>
				<div className='hero-board-columns'>
					{heroColumns.map((column) => (
						<div
							className={`hero-demo-column ${draggedCard ? 'is-drop-ready' : ''}`}
							key={column.id}
							data-hero-column={column.id}
							onDragOver={(event) => event.preventDefault()}
							onDrop={() => moveHeroCard(column.id)}
							onPointerUp={(event) => {
								if (event.pointerType !== 'touch') moveHeroCard(column.id)
							}}
						>
							<p>
								{column.title} <b>{column.tasks.length}</b>
							</p>
							{column.tasks.map((task) => (
								<article
									className={`${
										task.accent === 'teal'
											? 'hero-card-teal'
											: task.accent === 'done'
												? 'hero-card-done'
												: ''
									} ${touchDrag?.task.id === task.id ? 'is-touch-dragging' : ''}`}
									draggable
									onPointerDown={(event) => {
										if (event.pointerType === 'touch') event.preventDefault()
										setDraggedCard(task)
									}}
									onTouchStart={(event) => handleTouchStart(event, task)}
									onTouchMove={handleTouchMove}
									onTouchEnd={handleTouchEnd}
									onTouchCancel={handleTouchCancel}
									onDragStart={() => setDraggedCard(task)}
									onDragEnd={() => setDraggedCard(null)}
									key={task.id}
								>
									<span>{task.label}</span>
									<strong>{task.title}</strong>
									{task.meta && (
										<small>
											{task.accent === 'teal' && <ClipboardList size={12} />}
											{task.accent === 'done' && <CheckCircle2 size={12} />}
											{task.meta}
										</small>
									)}
								</article>
							))}
						</div>
					))}
				</div>
				<div className='hero-board-footer'>
					<span>
						<Plus size={14} /> Add task
					</span>
					<span>
						3 columns ·{' '}
						{heroColumns.reduce(
							(total, column) => total + column.tasks.length,
							0,
						)}{' '}
						tasks
					</span>
				</div>
			</div>
			{touchDrag &&
				createPortal(
					<div
						className='hero-touch-drag'
						style={{ left: `${touchDrag.x}px`, top: `${touchDrag.y}px` }}
						aria-hidden='true'
					>
						<span>{touchDrag.task.label}</span>
						<strong>{touchDrag.task.title}</strong>
						{touchDrag.task.meta && <small>{touchDrag.task.meta}</small>}
					</div>,
					document.body,
				)}
		</section>
	)
}

export default HomeHero
