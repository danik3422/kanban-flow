import { ArrowUpRight, Mail } from 'lucide-react'

const SiteFooter = () => {
	const year = new Date().getFullYear()
	const portfolioUrl =
		import.meta.env.VITE_PORTFOLIO_URL || 'https://danylodev.com'

	return (
		<footer className='site-footer'>
			<div className='footer-identity'>
				<div className='footer-brand'>
					<span className='brand-mark'>K</span>
					<strong>KanbanHub</strong>
				</div>
				<p>© {year} KanbanHub. Built by Danylo Syloats.</p>
			</div>
			<nav className='footer-links' aria-label='Footer links'>
				<a href='mailto:support@kanbanhub.app'>
					<Mail size={14} /> support@kanbanhub.app
				</a>
				{portfolioUrl ? (
					<a href={portfolioUrl} target='_blank' rel='noreferrer'>
						View portfolio <ArrowUpRight size={14} />
					</a>
				) : (
					<span className='footer-note'>Portfolio link coming soon</span>
				)}
			</nav>
		</footer>
	)
}

export default SiteFooter
