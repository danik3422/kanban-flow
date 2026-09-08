import { ArrowUpRight } from 'lucide-react'

const SiteFooter = () => {
	const year = new Date().getFullYear()
	const portfolioUrl = import.meta.env.VITE_PORTFOLIO_URL

	return (
		<footer className='site-footer'>
			<div><span className='brand-mark'>K</span><strong>Kanban</strong></div>
			<p>© {year} Kanban. Built by Danylo Syloats.</p>
			{portfolioUrl ? <a href={portfolioUrl} target='_blank' rel='noreferrer'>View portfolio <ArrowUpRight size={14} /></a> : <span className='footer-note'>Portfolio link coming soon</span>}
		</footer>
	)
}

export default SiteFooter
