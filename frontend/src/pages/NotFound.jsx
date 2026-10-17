import { ArrowLeft, House, LayoutGrid } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import SiteFooter from '../components/site/SiteFooter'
import SiteHeader from '../components/site/SiteHeader'
import { useI18n } from '../i18n'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../ui'

const NotFound = () => {
	const { t } = useI18n()
	const location = useLocation()
	const navigate = useNavigate()
	const authUser = useAuthStore((state) => state.authUser)
	// React Router numbers history entries; 0 means this tab opened straight on the bad link.
	const canGoBack = (window.history.state?.idx ?? 0) > 0

	return (
		<div className='site-page'>
			<SiteHeader />
			<main className='missing-page'>
				<div className='missing-page__art' aria-hidden='true'>
					<span>4</span>
					<span className='missing-page__column'>
						<span className='missing-page__column-title'>{t('notFound.column')}</span>
						<span className='missing-page__ghost'>{t('notFound.card')}</span>
					</span>
					<span>4</span>
				</div>
				<p className='home-eyebrow'>{t('notFound.code')}</p>
				<h1 className='missing-page__title'>{t('notFound.title')}</h1>
				<p className='missing-page__text'>{t('notFound.text')}</p>
				<p className='missing-page__path'>
					{t('notFound.address')}: <code data-i18n-ignore>{location.pathname}</code>
				</p>
				<div className='missing-page__actions'>
					{authUser ? (
						<Button as={Link} to='/workspaces' size='lg' icon={LayoutGrid}>{t('notFound.workspace')}</Button>
					) : (
						<Button as={Link} to='/' size='lg' icon={House}>{t('notFound.home')}</Button>
					)}
					{canGoBack && <Button variant='secondary' size='lg' icon={ArrowLeft} onClick={() => navigate(-1)}>{t('notFound.back')}</Button>}
				</div>
			</main>
			<SiteFooter />
		</div>
	)
}

export default NotFound
