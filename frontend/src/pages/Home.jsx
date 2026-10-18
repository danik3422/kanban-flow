import {
	ArrowRight,
	BellRing,
	CalendarDays,
	Check,
	CheckSquare,
	Clock3,
	EyeOff,
	History,
	KeyRound,
	LayoutGrid,
	MailX,
	MessageSquare,
	Paperclip,
	Pause,
	Smartphone,
	Timer,
	UsersRound,
} from 'lucide-react'
import { FaGithub } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import DemoBoard from '../components/site/DemoBoard'
import SiteFooter from '../components/site/SiteFooter'
import SiteHeader from '../components/site/SiteHeader'
import { GITHUB_URL } from '../components/site/links'
import { useI18n } from '../i18n'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../ui'

const FEATURES = [
	{ key: 'cards', icon: LayoutGrid },
	{ key: 'time', icon: Timer },
	{ key: 'calendar', icon: CalendarDays },
	{ key: 'team', icon: UsersRound },
	{ key: 'live', icon: BellRing },
	{ key: 'history', icon: History },
	{ key: 'security', icon: KeyRound },
	{ key: 'anywhere', icon: Smartphone },
]
const CARD_POINTS = ['labels', 'dates', 'checklist', 'attachments', 'comments', 'time']
const OPEN_POINTS = [
	{ key: 'code', icon: FaGithub },
	{ key: 'tracking', icon: EyeOff },
	{ key: 'mail', icon: MailX },
]

/** A still picture of an open card, so the page shows what a card holds. */
const CardMock = () => {
	const { t } = useI18n()
	return (
		<div className='home-mock' aria-hidden='true'>
			<div className='home-mock__cover' />
			<div className='home-mock__body'>
				<span className='home-mock__list'>{t('home.mock.list')}</span>
				<p className='home-mock__title'>{t('home.mock.title')}</p>
				<div className='home-mock__labels'>
					<span style={{ '--mock-label': '#4bce97' }}>{t('home.mock.labelDesign')}</span>
					<span style={{ '--mock-label': '#9f8fef' }}>{t('home.mock.labelLaunch')}</span>
				</div>
				<div className='home-mock__meta'>
					<span className='home-mock__due'><Clock3 size={13} />{t('home.mock.due')}</span>
					<span className='home-mock__people'><i>DS</i><i>OK</i><i>MV</i></span>
				</div>
				<div className='home-mock__check'>
					<span><CheckSquare size={14} />{t('home.mock.checklist')}</span>
					<b>3/5</b>
				</div>
				<div className='home-mock__bar'><span style={{ width: '60%' }} /></div>
				<div className='home-mock__timer'>
					<span className='home-mock__stop'><Pause size={14} />1:24:05</span>
					<span className='home-mock__total'><b>{t('home.mock.spent')}</b>{t('home.mock.estimate')}</span>
				</div>
				<div className='home-mock__foot'>
					<span><Paperclip size={13} />2</span>
					<span><MessageSquare size={13} />4</span>
				</div>
			</div>
			<div className='home-mock__comment'>
				<i>OK</i>
				<p>{t('home.mock.comment')}</p>
			</div>
		</div>
	)
}

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

				<section className='home-section' aria-labelledby='home-card'>
					<div className='home-spotlight'>
						<div className='home-spotlight__copy'>
							<div className='home-section__head'>
								<p className='home-eyebrow'>{t('home.card.eyebrow')}</p>
								<h2 id='home-card' className='home-section__title'>{t('home.card.title')}</h2>
								<p className='home-section__lead'>{t('home.card.lead')}</p>
							</div>
							<ul className='home-checks'>
								{CARD_POINTS.map((key) => (
									<li key={key}><Check size={16} aria-hidden='true' /><span>{t(`home.card.${key}`)}</span></li>
								))}
							</ul>
						</div>
						<div className='home-spotlight__visual'>
							<CardMock />
						</div>
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

				<section className='home-section' aria-labelledby='home-open'>
					<div className='home-open'>
						<div className='home-section__head'>
							<p className='home-eyebrow'>{t('home.openSource.eyebrow')}</p>
							<h2 id='home-open' className='home-section__title'>{t('home.openSource.title')}</h2>
							<p className='home-section__lead'>{t('home.openSource.lead')}</p>
						</div>
						<ul className='home-open__list'>
							{OPEN_POINTS.map(({ key, icon: Icon }) => (
								<li key={key}>
									<span className='home-feature__icon' aria-hidden='true'><Icon size={20} /></span>
									<span>
										<strong>{t(`home.openSource.${key}`)}</strong>
										<span>{t(`home.openSource.${key}Text`)}</span>
									</span>
								</li>
							))}
						</ul>
						<div className='home-open__actions'>
							<Button as='a' href={GITHUB_URL} target='_blank' rel='noreferrer' variant='secondary' icon={FaGithub}>{t('site.github')}</Button>
							<Button as={Link} to='/about' variant='ghost' iconRight={ArrowRight}>{t('home.openSource.more')}</Button>
						</div>
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
