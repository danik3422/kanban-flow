import {
	ArrowRight,
	Ban,
	Check,
	Cloud,
	Code2,
	EyeOff,
	GitFork,
	HardDrive,
	Heart,
	Image,
	Laptop,
	Mail,
	MailX,
	Server,
	ShieldCheck,
	UserRound,
	WifiOff,
} from 'lucide-react'
import { FaGithub } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import { CodeBlock } from '../features/site/DocBlocks'
import SiteFooter from '../features/site/SiteFooter'
import SiteHeader from '../features/site/SiteHeader'
import { GITHUB_URL, ISSUES_URL } from '../features/site/links'
import '../features/site/about.css'
import '../features/site/docs.css'
import { useI18n } from '../i18n'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../ui'
import { LogoMark } from '../ui/BrandMark'

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
const FACTS = ['trackers', 'languages', 'command', 'open']
const VISUAL_CHECKS = [
	{ key: 'no1', icon: EyeOff },
	{ key: 'no2', icon: Ban },
	{ key: 'own', icon: Server },
	{ key: 'offline', icon: WifiOff },
]
const REPO_NAME = GITHUB_URL.replace(/^https?:\/\/github\.com\//, '')

/** The story behind KanbanHub: what it is, open source, privacy and running your own copy. */
const About = () => {
	const { t } = useI18n()
	const authUser = useAuthStore((state) => state.authUser)

	return (
		<div className='site-page'>
			<SiteHeader />
			<main className='about'>
				<section className='about-hero'>
					<div className='about-hero__copy'>
						<p className='home-eyebrow home-eyebrow--pill'>{t('about.eyebrow')}</p>
						<h1 className='about-hero__title'>{t('about.title')}</h1>
						<p className='about-hero__lead'>{t('about.lead')}</p>
						<div className='about-hero__actions'>
							<Button as='a' href={GITHUB_URL} target='_blank' rel='noreferrer' size='lg' icon={FaGithub}>{t('about.github')}</Button>
							{authUser
								? <Button as={Link} to='/workspaces' variant='secondary' size='lg' iconRight={ArrowRight}>{t('home.open')}</Button>
								: <Button as={Link} to='/signup' variant='secondary' size='lg' iconRight={ArrowRight}>{t('home.start')}</Button>}
						</div>
					</div>
					{/* A repository card with what KanbanHub promises, instead of an empty half-page. */}
					<div className='about-visual' aria-hidden='true'>
						<div className='about-visual__card'>
							<div className='about-visual__head'>
								<LogoMark size={36} />
								<div className='about-visual__repo'>
									<span className='about-visual__name' data-i18n-ignore>{REPO_NAME}</span>
									<span className='about-visual__status'><span className='about-visual__dot' />{t('about.visual.status')}</span>
								</div>
								<FaGithub size={20} className='about-visual__github' />
							</div>
							<p className='about-visual__title'>{t('about.visual.title')}</p>
							<ul className='about-visual__checks'>
								{VISUAL_CHECKS.map(({ key, icon: Icon }) => (
									<li key={key}>
										<span className='about-visual__icon'><Icon size={16} /></span>
										{t(`about.visual.${key}`)}
										<Check size={16} className='about-visual__check' />
									</li>
								))}
							</ul>
						</div>
						<div className='about-visual__chip about-visual__chip--code'><Code2 size={15} />{t('about.open.title')}</div>
						<div className='about-visual__chip about-visual__chip--fork'><GitFork size={15} />docker compose up -d</div>
					</div>
				</section>

				<ul className='about-facts' aria-label={t('about.eyebrow')}>
					{FACTS.map((key) => (
						<li key={key} className='about-fact'>
							<span className='about-fact__value' data-i18n-ignore>{t(`about.facts.${key}Value`)}</span>
							<span className='about-fact__label'>{t(`about.facts.${key}`)}</span>
						</li>
					))}
				</ul>

				<section className='about-section about-story' aria-labelledby='about-what'>
					<div className='about-section__head'>
						<p className='home-eyebrow'>{t('about.what.eyebrow')}</p>
						<h2 id='about-what' className='about-section__title'>{t('about.what.title')}</h2>
					</div>
					<div className='about-prose'>
						<p className='about-prose__lead'>{t('about.what.p1')}</p>
						<p>{t('about.what.p2')}</p>
						<p>{t('about.what.p3')}</p>
					</div>
				</section>

				<section className='about-section' aria-labelledby='about-open'>
					<div className='about-open'>
						<div className='about-open__copy'>
							<span className='about-open__icon' aria-hidden='true'><Code2 size={22} /></span>
							<h2 id='about-open' className='about-open__title'>{t('about.open.title')}</h2>
							<p>{t('about.open.p1')}</p>
							<p>{t('about.open.p2')}</p>
							<div className='about-open__actions'>
								<Button as='a' href={GITHUB_URL} target='_blank' rel='noreferrer' size='lg' icon={FaGithub} className='about-open__primary'>{t('about.open.repo')}</Button>
								<Button as='a' href={ISSUES_URL} target='_blank' rel='noreferrer' size='lg' variant='ghost' className='about-open__secondary'>{t('about.open.issues')}</Button>
							</div>
						</div>
						<CodeBlock code={`git clone ${GITHUB_URL}.git`} className='about-open__code' />
					</div>
				</section>

				<section className='about-section' aria-labelledby='about-privacy'>
					<div className='about-section__head about-section__head--center'>
						<p className='home-eyebrow'>{t('about.privacy.eyebrow')}</p>
						<h2 id='about-privacy' className='about-section__title'>{t('about.privacy.title')}</h2>
						<p className='about-section__lead'>{t('about.privacy.lead')}</p>
					</div>
					<ul className='about-promises'>
						{PROMISES.map(({ key, icon: Icon }) => (
							<li key={key} className='about-promise'>
								<span className='about-promise__icon' aria-hidden='true'><Icon size={20} /></span>
								<h3>{t(`about.privacy.${key}`)}</h3>
								<p>{t(`about.privacy.${key}Text`)}</p>
							</li>
						))}
					</ul>
					<div className='about-services'>
						<div className='about-services__head'>
							<h3>{t('about.privacy.servicesTitle')}</h3>
							<p>{t('about.privacy.servicesLead')}</p>
						</div>
						<ul>
							{SERVICES.map(({ key, icon: Icon }) => (
								<li key={key}>
									<span className='about-services__icon' aria-hidden='true'><Icon size={16} /></span>
									<span><strong>{t(`about.privacy.services.${key}`)}</strong> {t(`about.privacy.services.${key}Text`)}</span>
								</li>
							))}
						</ul>
						<p className='about-services__note'><Heart size={15} aria-hidden='true' />{t('about.privacy.working')}</p>
					</div>
				</section>

				<section className='about-section' aria-labelledby='about-self'>
					<div className='about-self'>
						<div className='about-self__copy'>
							<p className='home-eyebrow'>{t('about.self.eyebrow')}</p>
							<h2 id='about-self' className='about-section__title'>{t('about.self.title')}</h2>
							<p className='about-section__lead'>{t('about.self.lead')}</p>
							<ul className='about-self__ways'>
								{SELF_HOST.map(({ key, icon: Icon }) => (
									<li key={key}>
										<span className='about-promise__icon' aria-hidden='true'><Icon size={18} /></span>
										<span>
											<strong>{t(`about.self.${key}`)}</strong>
											<span>{t(`about.self.${key}Text`)}</span>
										</span>
									</li>
								))}
							</ul>
							<Button as={Link} to='/self-hosting' size='lg' iconRight={ArrowRight} className='about-self__guide'>{t('about.self.guide')}</Button>
						</div>
						<div className='about-self__visual'>
							<CodeBlock code={`git clone ${GITHUB_URL}.git\ncd kanban-flow\ndocker compose up -d`} label={t('about.self.preview')} className='doc-code--hero' />
							<p className='about-self__note'>{t('about.self.note')}</p>
							<ul className='about-self__checks'>
								{['c1', 'c2', 'c3'].map((key) => <li key={key}><Check size={16} aria-hidden='true' />{t(`about.self.${key}`)}</li>)}
							</ul>
						</div>
					</div>
				</section>

				<section className='home-cta about-cta'>
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
