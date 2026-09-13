import { ArrowUpRight } from 'lucide-react'

const SiteFooter = () => {
	const year = new Date().getFullYear()
	const portfolioUrl =
		import.meta.env.VITE_PORTFOLIO_URL || 'https://danylodev.com'

	return (
		<footer className='site-footer'>
			<div className='footer-inner'>
				<div className='footer-main'>
					<div className='footer-identity'>
						<p className='footer-kicker'>A calmer way to get work done</p>
						<div className='footer-brand'>
							<span className='brand-mark'>K</span>
							<strong>KanbanHub</strong>
						</div>
						<p>Keep the next useful action visible.</p>
					</div>
					<nav className='footer-links' aria-label='Footer links'>
						<a href='mailto:support@kanbanhub.app'>
							<span><strong>Support</strong><small>support@kanbanhub.app</small></span>
						</a>
						{portfolioUrl ? (
							<a href={portfolioUrl} target='_blank' rel='noreferrer'>
								<span><strong>Portfolio</strong><small>See more work</small></span>
								<ArrowUpRight size={16} />
							</a>
						) : (
							<span className='footer-note'>Portfolio link coming soon</span>
						)}
					</nav>
				</div>
				<div className='footer-bottom'>
					<span>© {year} KanbanHub</span>
					<span>Built by Danylo Syloats</span>
				</div>
			</div>
		</footer>
	)
}

export default SiteFooter
