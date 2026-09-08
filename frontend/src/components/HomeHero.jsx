import { ArrowRight, CheckCircle2, ClipboardList, Layers3, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const HomeHero = () => {
	const { authUser } = useAuthStore()

	return (
		<section className='hero-section hero-entrance'>
			<div className='hero-copy hero-entrance-copy'>
				<p className='hero-kicker'><span className='brand-mark'>K</span> A calmer way to get work done</p>
				<h1>Make progress visible.</h1>
				<p className='hero-description'>Kanban gives your projects a clear rhythm: capture the work, focus the team, and celebrate what moves forward.</p>
				<div className='hero-actions'>
					{authUser ? (
						<Link to='/workspaces' className='hero-primary'>Open workspace <ArrowRight size={17} /></Link>
					) : (
						<>
							<Link to='/signup' className='hero-primary'>Start for free <ArrowRight size={17} /></Link>
							<Link to='/login' className='hero-secondary'>Log in</Link>
						</>
					)}
				</div>
				<div className='hero-proof'><CheckCircle2 size={16} /> No credit card <span /> <CheckCircle2 size={16} /> Ready in minutes</div>
			</div>
			<div className='hero-board hero-entrance-board' aria-label='Preview of a Kanban board'>
				<div className='hero-board-top'><div><span className='hero-dot' /><span className='hero-dot muted' /><span className='hero-dot muted' /></div><span>Product launch</span><Layers3 size={16} /></div>
				<div className='hero-board-columns'>
					<div><p>BACKLOG <b>3</b></p><article><span>Research</span><strong>Interview five users</strong><small>Today</small></article><article><span>Planning</span><strong>Outline launch brief</strong></article></div>
					<div><p>IN PROGRESS <b>2</b></p><article className='hero-card-teal'><span>Design</span><strong>Polish onboarding flow</strong><small><ClipboardList size={12} /> 4 subtasks</small></article><article><span>Content</span><strong>Write release notes</strong></article></div>
					<div><p>DONE <b>4</b></p><article className='hero-card-done'><span>Shipped</span><strong>Set up analytics</strong><small><CheckCircle2 size={12} /> Complete</small></article></div>
				</div>
				<div className='hero-board-footer'><span><Plus size={14} /> Add task</span><span>3 columns · 9 tasks</span></div>
			</div>
		</section>
	)
}

export default HomeHero
