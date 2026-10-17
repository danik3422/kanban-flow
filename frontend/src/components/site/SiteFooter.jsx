import { ArrowUpRight, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import BrandMark from '../BrandMark'
import './site.css'

const PORTFOLIO_URL = import.meta.env.VITE_PORTFOLIO_URL || 'https://danylodev.com'

const SiteFooter = () => {
	const { t } = useI18n()
	return (
		<footer className='public-footer'>
			<div className='public-footer__inner'>
				<div className='public-footer__identity'>
					<Link to='/' className='site-header__brand' aria-label={t('common.homeLink')}><BrandMark /></Link>
					<p>{t('site.footerTagline')}</p>
				</div>
				<div className='public-footer__links'>
					<a href='mailto:support@kanbanhub.app'><Mail size={16} aria-hidden='true' />{t('site.support')}</a>
					<a href={PORTFOLIO_URL} target='_blank' rel='noreferrer'>{t('site.portfolio')}<ArrowUpRight size={16} aria-hidden='true' /></a>
				</div>
			</div>
			<div className='public-footer__bottom'>
				<span>© {new Date().getFullYear()} KanbanHub</span>
				<span>{t('site.madeBy')} <span data-i18n-ignore>Danylo Syloats</span></span>
			</div>
		</footer>
	)
}

export default SiteFooter
