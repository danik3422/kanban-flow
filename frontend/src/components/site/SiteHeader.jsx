import { ArrowRight } from 'lucide-react'
import { FaGithub } from 'react-icons/fa'
import { Link, NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../store/useAuthStore'
import { Button } from '../../ui'
import { GITHUB_URL } from './links'
import BrandMark from '../BrandMark'
import { LanguageMenu, ThemeMenu } from '../preferences/PreferenceMenus'
import './site.css'

/** Header of the public pages: logo, about, source code, language, theme and the way in. */
const SiteHeader = () => {
	const { t } = useI18n()
	const authUser = useAuthStore((state) => state.authUser)
	return (
		<header className='site-header'>
			<div className='site-header__inner'>
				<Link to='/' className='site-header__brand' aria-label={t('common.homeLink')}>
					<BrandMark />
				</Link>
				<nav className='site-header__actions' aria-label={t('site.nav')}>
					<NavLink to='/about' className='site-header__link'>{t('site.about')}</NavLink>
					<a href={GITHUB_URL} target='_blank' rel='noreferrer' className='site-header__github' aria-label={t('site.github')} title={t('site.github')}>
						<FaGithub size={18} aria-hidden='true' />
					</a>
					<LanguageMenu />
					<ThemeMenu />
					{authUser ? (
						<Button as={Link} to='/workspaces' size='sm' iconRight={ArrowRight}>{t('site.openWorkspace')}</Button>
					) : (
						<>
							<Button as={Link} to='/login' variant='secondary' size='sm'>{t('site.login')}</Button>
							<Button as={Link} to='/signup' size='sm' className='site-header__signup'>{t('site.signup')}</Button>
						</>
					)}
				</nav>
			</div>
		</header>
	)
}

export default SiteHeader
