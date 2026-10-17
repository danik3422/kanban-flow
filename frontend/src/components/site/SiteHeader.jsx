import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../store/useAuthStore'
import { Button } from '../../ui'
import BrandMark from '../BrandMark'
import { LanguageMenu, ThemeMenu } from '../preferences/PreferenceMenus'
import './site.css'

/** Header of the public pages: logo, language, theme and the way in. */
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
