import {
	ArrowRight,
	Ban,
	Check,
	Cloud,
	Code2,
	Container,
	EyeOff,
	HardDrive,
	Heart,
	Image,
	Laptop,
	Mail,
	MailX,
	Server,
	ShieldCheck,
	UserRound,
} from 'lucide-react'
import { FaGithub } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import SiteFooter from '../components/site/SiteFooter'
import SiteHeader from '../components/site/SiteHeader'
import { GITHUB_URL, ISSUES_URL } from '../components/site/links'
import { useI18n } from '../i18n'
import { useAuthStore } from '../store/useAuthStore'
import { Badge, Button } from '../ui'

const PROMISES = [
	{ key: 'noTracking', icon: EyeOff },
	{ key: 'noMarketing', icon: MailX },
	{ key: 'noSelling', icon: Ban },
	{ key: 'yourData', icon: ShieldCheck },
]
// The outside services a hosted copy relies on, named plainly.
const SERVICES = [
	{ key: 'hosting', icon: Server },
	{ key: 'mail', icon: Mail },
	{ key: 'images', icon: Cloud },
	{ key: 'photos', icon: Image },
	{ key: 'signIn', icon: UserRound },
]
const SELF_HOST = [
	{ key: 'computer', icon: Laptop },
	{ key: 'server', icon: HardDrive },
]

const About = () => {
	const { t } = useI18n()
	const authUser = useAuthStore((state) => state.authUser)

	return (
		<div className='site-page'>
			<SiteHeader />
			<main>
				<section className='about-hero'>
					<p className='home-eyebrow home-eyebrow--pill'>{t('about.eyebrow')}</p>
					<h1 className='about-hero__title'>{t('about.title')}</h1>
					<p className='about-hero__lead'>{t('about.lead')}</p>
					<div className='about-hero__actions'>
						<Button as='a' href={GITHUB_URL} target='_blank' rel='noreferrer' size='lg' icon={FaGithub}>{t('about.github')}</Button>
						{authUser
							? <Button as={Link} to='/workspaces' variant='secondary' size='lg' iconRight={ArrowRight}>{t('home.open')}</Button>
							: <Button as={Link} to='/signup' variant='secondary' size='lg' iconRight={ArrowRight}>{t('home.start')}</Button>}
					</div>
				</section>

				<section className='home-section about-story' aria-labelledby='about-what'>
					<div className='home-section__head'>
						<p className='home-eyebrow'>{t('about.what.eyebrow')}</p>
						<h2 id='about-what' className='home-section__title'>{t('about.what.title')}</h2>
					</div>
					<div className='about-prose'>
						<p>{t('about.what.p1')}</p>
						<p>{t('about.what.p2')}</p>
						<p>{t('about.what.p3')}</p>
					</div>
				</section>

				<section className='home-section' aria-labelledby='about-open'>
					<div className='about-panel'>
						<span className='about-panel__icon' aria-hidden='true'><Code2 size={22} /></span>
						<div className='about-panel__copy'>
							<h2 id='about-open' className='home-section__title'>{t('about.open.title')}</h2>
							<p>{t('about.open.p1')}</p>
							<p>{t('about.open.p2')}</p>
							<div className='about-panel__actions'>
								<Button as='a' href={GITHUB_URL} target='_blank' rel='noreferrer' icon={FaGithub}>{t('about.open.repo')}</Button>
								<Button as='a' href={ISSUES_URL} target='_blank' rel='noreferrer' variant='secondary'>{t('about.open.issues')}</Button>
							</div>
						</div>
					</div>
				</section>

				<section className='home-section' aria-labelledby='about-privacy'>
					<div className='home-section__head'>
						<p className='home-eyebrow'>{t('about.privacy.eyebrow')}</p>
						<h2 id='about-privacy' className='home-section__title'>{t('about.privacy.title')}</h2>
						<p className='home-section__lead'>{t('about.privacy.lead')}</p>
					</div>
					<div className='home-features about-promises'>
						{PROMISES.map(({ key, icon: Icon }) => (
							<article key={key} className='home-feature'>
								<span className='home-feature__icon' aria-hidden='true'><Icon size={20} /></span>
								<h3>{t(`about.privacy.${key}`)}</h3>
								<p>{t(`about.privacy.${key}Text`)}</p>
							</article>
						))}
					</div>
					<div className='about-services'>
						<h3>{t('about.privacy.servicesTitle')}</h3>
						<p>{t('about.privacy.servicesLead')}</p>
						<ul>
							{SERVICES.map(({ key, icon: Icon }) => (
								<li key={key}>
									<Icon size={18} aria-hidden='true' />
									<span><strong>{t(`about.privacy.services.${key}`)}</strong> {t(`about.privacy.services.${key}Text`)}</span>
								</li>
							))}
						</ul>
						<p className='about-services__note'><Heart size={15} aria-hidden='true' />{t('about.privacy.working')}</p>
					</div>
				</section>

				<section className='home-section' aria-labelledby='about-self'>
					<div className='about-self'>
						<div className='home-section__head'>
							<p className='home-eyebrow'>{t('about.self.eyebrow')}</p>
							<h2 id='about-self' className='home-section__title'>
								{t('about.self.title')} <Badge tone='warning' className='about-soon'>{t('about.self.soon')}</Badge>
							</h2>
							<p className='home-section__lead'>{t('about.self.lead')}</p>
						</div>
						<ul className='about-self__ways'>
							{SELF_HOST.map(({ key, icon: Icon }) => (
								<li key={key}>
									<span className='home-feature__icon' aria-hidden='true'><Icon size={20} /></span>
									<span>
										<strong>{t(`about.self.${key}`)}</strong>
										<span>{t(`about.self.${key}Text`)}</span>
									</span>
								</li>
							))}
						</ul>
						<div className='about-terminal' aria-label={t('about.self.preview')}>
							<div className='about-terminal__bar' aria-hidden='true'><i /><i /><i /><span><Container size={13} />Docker</span></div>
							<pre data-i18n-ignore><code>{`git clone ${GITHUB_URL}.git\ncd kanban-flow\ndocker compose up -d`}</code></pre>
							<p className='about-terminal__note'>{t('about.self.note')}</p>
						</div>
						<ul className='about-self__checks'>
							{['c1', 'c2', 'c3'].map((key) => <li key={key}><Check size={16} aria-hidden='true' />{t(`about.self.${key}`)}</li>)}
						</ul>
					</div>
				</section>

				<section className='home-cta'>
					<h2 className='home-cta__title'>{t('about.cta.title')}</h2>
					<p>{t('about.cta.text')}</p>
					<Button as='a' href={GITHUB_URL} target='_blank' rel='noreferrer' size='lg' icon={FaGithub}>{t('about.cta.button')}</Button>
				</section>
			</main>
			<SiteFooter />
		</div>
	)
}

export default About
