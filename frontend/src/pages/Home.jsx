import { useEffect } from 'react'
import HomeFeatures from '../components/HomeFeatures'
import HomeHero from '../components/HomeHero'
import SiteFooter from '../components/SiteFooter'

const workflowSteps = [
	{
		number: '01',
		title: 'Capture the work',
		copy: 'Turn loose ideas, requests, and next steps into tasks your team can see.',
	},
	{
		number: '02',
		title: 'Focus on now',
		copy: 'Keep active work in one place and make the next useful action obvious.',
	},
	{
		number: '03',
		title: 'Move forward',
		copy: 'Watch tasks travel across the board and keep momentum visible for everyone.',
	},
]

const workflowHighlights = ['Clear ownership', 'Flexible columns', 'A shared source of truth']

const Home = () => {
	useEffect(() => {
		const revealItems = document.querySelectorAll('[data-reveal]')
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			revealItems.forEach((item) => item.classList.add('is-visible'))
			return undefined
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('is-visible')
						observer.unobserve(entry.target)
					}
				})
			},
			{ threshold: 0.12, rootMargin: '0px 0px -36px' }
		)

		revealItems.forEach((item) => observer.observe(item))
		return () => observer.disconnect()
	}, [])

	return (
		<div className='bg-base-100 text-base-content min-h-screen flex flex-col'>
			<HomeHero />
			<section className='workflow-section' data-reveal>
				<div className='workflow-intro reveal-item'>
					<p className='eyebrow'>A simple working rhythm</p>
					<h2>From scattered thoughts to steady progress.</h2>
					<p>KanbanHub keeps your team aligned without adding another complicated process to manage.</p>
				</div>
				<div className='workflow-steps'>
					{workflowSteps.map((step) => (
						<article className='workflow-step reveal-item' key={step.number}>
							<span>{step.number}</span>
							<h3>{step.title}</h3>
							<p>{step.copy}</p>
						</article>
					))}
				</div>
				<div className='workflow-highlights reveal-item'>
					{workflowHighlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
				</div>
			</section>
			<HomeFeatures />
			<SiteFooter />
		</div>
	)
}

export default Home
