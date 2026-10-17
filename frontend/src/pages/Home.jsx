import { ArrowRight, BellRing, Check, History, Languages, LayoutGrid, MoonStar, Smartphone, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import DemoBoard from '../components/site/DemoBoard'
import SiteFooter from '../components/site/SiteFooter'
import SiteHeader from '../components/site/SiteHeader'
import { useI18n } from '../i18n'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../ui'

const FEATURES = [
	{ key: 'boards', icon: LayoutGrid },
	{ key: 'team', icon: UsersRound },
	{ key: 'live', icon: BellRing },
	{ key: 'history', icon: History },
]
const ANYWHERE = [
	{ key: 'devices', icon: Smartphone },
	{ key: 'themes', icon: MoonStar },
	{ key: 'languages', icon: Languages },
]

const Home = () => {
	const { t } = useI18n()
	const authUser = useAuthStore((state) => state.authUser)

	const primaryAction = authUser ? (
		<Button as={Link} to='/workspaces' size='lg' iconRight={ArrowRight}>{t('home.open')}</Button>
	) : (
		<Button as={Link} to='/signup' size='lg' iconRight={ArrowRight}>{t('home.start')}</Button>
	)

	return (
		<div className='site-page'>
			<SiteHeader />
			<main>
				<section className='home-hero'>
					<div className='home-hero__copy'>
						<p className='home-eyebrow home-eyebrow--pill'>{t('home.eyebrow')}</p>
						<h1 className='home-hero__title'>{t('home.title')}</h1>
						<p className='home-hero__lead'>{t('home.lead')}</p>
						<div className='home-hero__actions'>
							{primaryAction}
							{!authUser && (
								<>
									<Button as={Link} to='/login' variant='secondary' size='lg' className='home-hero__login-button'>{t('home.login')}</Button>
									{/* Phones: one full-width call, sign-in as a quiet link under it. */}
									<Link to='/login' className='home-hero__login-link'>{t('home.login')}</Link>
								</>
							)}
						</div>
						<ul className='home-hero__proof'>
							{['proof1', 'proof2', 'proof3'].map((key) => (
								<li key={key} className={key === 'proof3' ? 'home-hero__proof-extra' : undefined}><Check size={16} aria-hidden='true' />{t(`home.${key}`)}</li>
							))}
						</ul>
					</div>
					<div className='home-hero__stage'>
						<DemoBoard />
					</div>
				</section>

				<section className='home-section' aria-labelledby='home-how'>
					<div className='home-section__head'>
						<p className='home-eyebrow'>{t('home.how.eyebrow')}</p>
						<h2 id='home-how' className='home-section__title'>{t('home.how.title')}</h2>
					</div>
					<ol className='home-steps'>
						{['step1', 'step2', 'step3'].map((step, index) => (
							<li key={step} className='home-step'>
								<span className='home-step__number' aria-hidden='true'>{index + 1}</span>
								<h3>{t(`home.how.${step}`)}</h3>
								<p>{t(`home.how.${step}Text`)}</p>
							</li>
						))}
					</ol>
				</section>

				<section className='home-section' aria-labelledby='home-features'>
					<div className='home-section__head'>
						<p className='home-eyebrow'>{t('home.features.eyebrow')}</p>
						<h2 id='home-features' className='home-section__title'>{t('home.features.title')}</h2>
					</div>
					<div className='home-features'>
						{FEATURES.map(({ key, icon: Icon }) => (
							<article key={key} className='home-feature'>
								<span className='home-feature__icon' aria-hidden='true'><Icon size={20} /></span>
								<h3>{t(`home.features.${key}`)}</h3>
								<p>{t(`home.features.${key}Text`)}</p>
							</article>
						))}
					</div>
				</section>

				<section className='home-section' aria-labelledby='home-anywhere'>
					<div className='home-anywhere'>
						<div className='home-section__head'>
							<p className='home-eyebrow'>{t('home.anywhere.eyebrow')}</p>
							<h2 id='home-anywhere' className='home-section__title'>{t('home.anywhere.title')}</h2>
						</div>
						<ul className='home-anywhere__list'>
							{ANYWHERE.map(({ key, icon: Icon }) => (
								<li key={key}>
									<span className='home-feature__icon' aria-hidden='true'><Icon size={20} /></span>
									<span>
										<strong>{t(`home.anywhere.${key}`)}</strong>
										{/* The languages line names each language in its own script on purpose. */}
										<span data-i18n-ignore={key === 'languages' || undefined}>{t(`home.anywhere.${key}Text`)}</span>
									</span>
								</li>
							))}
						</ul>
					</div>
				</section>

				<section className='home-cta'>
					<h2 className='home-cta__title'>{t('home.cta.title')}</h2>
					<p>{t('home.cta.text')}</p>
					{primaryAction}
				</section>
			</main>
			<SiteFooter />
		</div>
	)
}

export default Home
