import { ArrowRight, Check, ChevronDown, Cpu, Database, MailCheck, MailX, MemoryStick, Package, Play, RefreshCw, Server, ShieldCheck, Terminal, UserPlus, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import SiteFooter from '../features/site/SiteFooter'
import SiteHeader from '../features/site/SiteHeader'
import { Callout, CodeBlock, Rich } from '../features/site/DocBlocks'
import { GITHUB_URL, ISSUES_URL } from '../features/site/links'
import '../features/site/site.css'
import '../features/site/docs.css'
import { useI18n } from '../i18n'
import { Button } from '../ui'
import { cx } from '../ui/utils'

// Commands are the same in every language; only the words around them change.
const CODE = {
	quick: `git clone ${GITHUB_URL}.git\ncd kanban-flow\ndocker compose up -d`,
	clone: `git clone ${GITHUB_URL}.git\ncd kanban-flow`,
	up: 'docker compose up -d',
	env: 'cp .env.example .env',
	network: 'PUBLIC_URL=http://192.168.1.20:8080',
	restart: 'docker compose up -d',
	caddy: 'kanban.example.com {\n\treverse_proxy localhost:8080\n}',
	domainEnv: 'PUBLIC_URL=https://kanban.example.com\nTRUST_PROXY=1\nSIGNUP=closed',
	offlineEnv: 'REMOTE_PHOTOS=false',
	airgapSave: 'docker compose build\ndocker pull mongo:8.0\ndocker save kanbanhub:latest mongo:8.0 | gzip > kanbanhub-images.tar.gz',
	airgapLoad: 'docker load < kanbanhub-images.tar.gz\ndocker compose up -d --no-build',
	smtp: 'MAIL_FROM=KanbanHub <kanban@example.com>\nSMTP_HOST=smtp.example.com\nSMTP_PORT=587\nSMTP_USER=kanban@example.com\nSMTP_PASS=your-password',
	signup: 'SIGNUP=closed',
	createUser: 'docker compose exec app npm run create-user -- anna@example.com',
	resetPassword: 'docker compose exec app npm run reset-password -- anna@example.com',
	logs: 'docker compose logs -f app',
	stopStart: 'docker compose down\ndocker compose up -d',
	update: 'git pull\ndocker compose up -d --build',
	backup: 'docker compose exec -T mongo mongodump --archive --gzip > kanbanhub-db.gz\ndocker compose run --rm --no-deps --user root -v "$PWD":/backup --entrypoint tar app czf /backup/kanbanhub-files.tgz -C /data .',
	restore: 'docker compose exec -T mongo mongorestore --archive --gzip --drop < kanbanhub-db.gz\ndocker compose run --rm --no-deps --user root -v "$PWD":/backup --entrypoint tar app xzf /backup/kanbanhub-files.tgz -C /data\ndocker compose restart app',
	port: 'PORT=8090',
}

const SECTIONS = ['needs', 'install', 'network', 'domain', 'offline', 'email', 'signup', 'admin', 'update', 'backup', 'help']

// The section in view, for the table of contents.
const useActiveSection = () => {
	const [active, setActive] = useState(SECTIONS[0])
	useEffect(() => {
		const visible = new Map()
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : null)
			const shown = SECTIONS.filter((id) => visible.get(id) !== null && visible.get(id) !== undefined)
			if (shown.length) setActive(shown[0])
		}, { rootMargin: '-96px 0px -55% 0px' })
		for (const id of SECTIONS) {
			const element = document.getElementById(id)
			if (element) observer.observe(element)
		}
		return () => observer.disconnect()
	}, [])
	return active
}

const Section = ({ id, number, title, children }) => (
	<section id={id} className='doc-section' aria-labelledby={`${id}-title`}>
		<h2 id={`${id}-title`} className='doc-section__title'>
			<span className='doc-section__number' aria-hidden='true'>{String(number).padStart(2, '0')}</span>
			{title}
		</h2>
		{children}
	</section>
)

const Step = ({ number, title, children }) => (
	<li className='doc-step'>
		<span className='doc-step__number' aria-hidden='true'>{number}</span>
		<div className='doc-step__body'>
			<h3 className='doc-step__title'>{title}</h3>
			{children}
		</div>
	</li>
)

/** The full guide to running KanbanHub with Docker, with or without internet. */
const SelfHosting = () => {
	const { t } = useI18n()
	const s = (key) => t(`selfHosting.${key}`)
	const active = useActiveSection()
	const number = (id) => SECTIONS.indexOf(id) + 1
	// The phone's chip bar keeps the current section's chip in view.
	useEffect(() => {
		const chip = document.querySelector('.doc-chips__item.is-active')
		const bar = chip?.parentElement
		if (!bar || bar.scrollWidth <= bar.clientWidth) return
		const left = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2
		bar.scrollTo({ left: Math.max(0, left), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
	}, [active])

	return (
		<div className='site-page'>
			<SiteHeader />
			<main className='doc'>
				<header className='doc-hero'>
					<div className='doc-hero__copy'>
						<p className='home-eyebrow home-eyebrow--pill'>{s('eyebrow')}</p>
						<h1 className='doc-hero__title'>{s('title')}</h1>
						<p className='doc-hero__lead'>{s('lead')}</p>
						<ul className='doc-hero__highlights'>
							{[['offline', WifiOff], ['email', MailX], ['update', RefreshCw]].map(([key, Icon]) => (
								<li key={key}><Icon size={16} aria-hidden='true' />{s(`highlights.${key}`)}</li>
							))}
						</ul>
						<div className='doc-hero__actions'>
							<Button as='a' href='#install' size='lg' iconRight={ArrowRight}>{s('start')}</Button>
							<Button as='a' href={GITHUB_URL} target='_blank' rel='noreferrer' variant='secondary' size='lg' icon={FaGithub}>{s('github')}</Button>
						</div>
					</div>
					<div className='doc-hero__visual'>
						<CodeBlock code={CODE.quick} label={s('quickStart')} className='doc-code--hero' />
						<p className='doc-hero__ready'><Check size={16} aria-hidden='true' /><span data-i18n-ignore>{s('ready')}</span></p>
					</div>
				</header>

				<nav className='doc-chips' aria-label={s('toc')}>
					{SECTIONS.map((id) => (
						<a key={id} href={`#${id}`} className={cx('doc-chips__item', active === id && 'is-active')} aria-current={active === id ? 'location' : undefined}>{s(`${id}.title`)}</a>
					))}
				</nav>

				<div className='doc-layout'>
					<aside className='doc-toc'>
						<nav aria-label={s('toc')}>
							<p className='doc-toc__title'>{s('toc')}</p>
							<ol>
								{SECTIONS.map((id, index) => (
									<li key={id}>
										<a href={`#${id}`} className={cx(active === id && 'is-active')} aria-current={active === id ? 'location' : undefined}>
											<span className='doc-toc__number' aria-hidden='true'>{String(index + 1).padStart(2, '0')}</span>
											{s(`${id}.title`)}
										</a>
									</li>
								))}
							</ol>
						</nav>
						<a className='doc-toc__repo' href={`${GITHUB_URL}/blob/main/SELF_HOSTING.md`} target='_blank' rel='noreferrer'><FaGithub size={15} aria-hidden='true' />{s('repo')}</a>
					</aside>

					<article className='doc-content'>
						<Section id='needs' number={number('needs')} title={s('needs.title')}>
							<ul className='doc-cards doc-cards--3'>
								{[['docker', Package], ['memory', MemoryStick], ['cpu', Cpu]].map(([key, Icon]) => (
									<li key={key} className='doc-card'>
										<span className='doc-card__icon' aria-hidden='true'><Icon size={20} /></span>
										<h3 className='doc-card__title'>{s(`needs.${key}`)}</h3>
										<p className='doc-card__text'>{s(`needs.${key}Text`)}</p>
									</li>
								))}
							</ul>
						</Section>

						<Section id='install' number={number('install')} title={s('install.title')}>
							<ol className='doc-steps'>
								<Step number={1} title={s('install.step1')}>
									<Rich text={s('install.step1Text')} />
									<CodeBlock code={CODE.clone} />
									<Rich text={s('install.noGit')} className='doc-muted' />
								</Step>
								<Step number={2} title={s('install.step2')}>
									<CodeBlock code={CODE.up} />
									<Rich text={s('install.step2Text')} className='doc-muted' />
								</Step>
								<Step number={3} title={s('install.step3')}>
									<Rich text={s('install.step3Text')} />
								</Step>
							</ol>
							<Callout>
								<Rich text={s('install.settings')} />
								<CodeBlock code={CODE.env} />
							</Callout>
						</Section>

						<Section id='network' number={number('network')} title={s('network.title')}>
							<Rich text={s('network.text')} />
							<CodeBlock code={CODE.network} label='.env' kind='file' />
							<CodeBlock code={CODE.restart} />
							<Rich text={s('network.after')} />
							<Callout><Rich text={s('network.note')} /></Callout>
						</Section>

						<Section id='domain' number={number('domain')} title={s('domain.title')}>
							<Rich text={s('domain.text')} />
							<CodeBlock code={CODE.caddy} label='Caddyfile' kind='file' />
							<Rich text={s('domain.env')} />
							<CodeBlock code={CODE.domainEnv} label='.env' kind='file' />
							<Callout><Rich text={s('domain.note')} /></Callout>
						</Section>

						<Section id='offline' number={number('offline')} title={s('offline.title')}>
							<Rich text={s('offline.lead')} className='doc-lead' />
							<div className='doc-cards doc-cards--2'>
								<div className='doc-card doc-card--wide'>
									<span className='doc-card__icon' aria-hidden='true'><Wifi size={20} /></span>
									<h3 className='doc-card__title'>{s('offline.network')}</h3>
									<Rich text={s('offline.networkText')} className='doc-card__text' />
									<CodeBlock code={CODE.offlineEnv} label='.env' kind='file' />
								</div>
								<div className='doc-card doc-card--wide'>
									<span className='doc-card__icon' aria-hidden='true'><WifiOff size={20} /></span>
									<h3 className='doc-card__title'>{s('offline.airgap')}</h3>
									<Rich text={s('offline.airgapText')} className='doc-card__text' />
									<CodeBlock code={CODE.airgapSave} />
									<Rich text={s('offline.load')} className='doc-card__text' />
									<CodeBlock code={CODE.airgapLoad} />
								</div>
							</div>
							<Callout><Rich text={s('offline.note')} /></Callout>
						</Section>

						<Section id='email' number={number('email')} title={s('email.title')}>
							<Rich text={s('email.lead')} />
							<div className='doc-compare'>
								<div className='doc-compare__col'>
									<h3 className='doc-compare__title'><MailX size={18} aria-hidden='true' />{s('email.without')}<span className='doc-badge'>{s('email.withoutDefault')}</span></h3>
									<ul>{['accounts', 'invites', 'passwords', 'notifications'].map((key) => <li key={key}><Check size={16} aria-hidden='true' />{s(`email.${key}`)}</li>)}</ul>
								</div>
								<div className='doc-compare__col'>
									<h3 className='doc-compare__title'><MailCheck size={18} aria-hidden='true' />{s('email.with')}</h3>
									<ul>{['confirm', 'resetLinks', 'emailInvites', 'smtp'].map((key) => <li key={key}><Check size={16} aria-hidden='true' />{s(`email.${key}`)}</li>)}</ul>
								</div>
							</div>
							<Rich text={s('email.setup')} />
							<CodeBlock code={CODE.smtp} label='.env' kind='file' />
							<Callout><Rich text={s('email.note')} /></Callout>
						</Section>

						<Section id='signup' number={number('signup')} title={s('signup.title')}>
							<Rich text={s('signup.text')} />
							<CodeBlock code={CODE.signup} label='.env' kind='file' />
							<Rich text={s('signup.after')} />
							<CodeBlock code={CODE.createUser} />
						</Section>

						<Section id='admin' number={number('admin')} title={s('admin.title')}>
							<Rich text={s('admin.lead')} />
							<ul className='doc-commands'>
								{[['addUser', UserPlus, CODE.createUser], ['resetPassword', ShieldCheck, CODE.resetPassword], ['logs', Terminal, CODE.logs], ['stop', Play, CODE.stopStart]].map(([key, Icon, code]) => (
									<li key={key} className='doc-command'>
										<div className='doc-command__head'>
											<span className='doc-card__icon doc-card__icon--sm' aria-hidden='true'><Icon size={16} /></span>
											<div>
												<h3 className='doc-command__title'>{s(`admin.${key}`)}</h3>
												<p className='doc-command__text'>{s(`admin.${key}Text`)}</p>
											</div>
										</div>
										<CodeBlock code={code} />
									</li>
								))}
							</ul>
						</Section>

						<Section id='update' number={number('update')} title={s('update.title')}>
							<CodeBlock code={CODE.update} />
							<Rich text={s('update.text')} className='doc-muted' />
						</Section>

						<Section id='backup' number={number('backup')} title={s('backup.title')}>
							<Rich text={s('backup.lead')} />
							<ol className='doc-steps'>
								<Step number={<Database size={16} />} title={s('backup.save')}>
									<Rich text={s('backup.saveText')} />
									<CodeBlock code={CODE.backup} />
								</Step>
								<Step number={<RefreshCw size={16} />} title={s('backup.restore')}>
									<Rich text={s('backup.restoreText')} />
									<CodeBlock code={CODE.restore} />
								</Step>
							</ol>
						</Section>

						<Section id='help' number={number('help')} title={s('help.title')}>
							<div className='doc-faq'>
								{['port', 'signin', 'avx', 'passkeys'].map((key) => (
									<details key={key} className='doc-faq__item'>
										<summary>{s(`help.${key}Q`)}<ChevronDown size={18} aria-hidden='true' /></summary>
										<div className='doc-faq__answer'>
											<Rich text={s(`help.${key}A`)} />
											{key === 'port' && <CodeBlock code={CODE.port} label='.env' kind='file' />}
										</div>
									</details>
								))}
							</div>
						</Section>

						<aside className='doc-more'>
							<span className='doc-card__icon' aria-hidden='true'><Server size={20} /></span>
							<div className='doc-more__copy'>
								<h2 className='doc-more__title'>{s('more.title')}</h2>
								<p>{s('more.text')}</p>
							</div>
							<div className='doc-more__actions'>
								<Button as='a' href={ISSUES_URL} target='_blank' rel='noreferrer' icon={FaGithub}>{s('more.issue')}</Button>
								<Button as='a' href={`${GITHUB_URL}/blob/main/SELF_HOSTING.md#all-settings`} target='_blank' rel='noreferrer' variant='secondary'>{s('more.settings')}</Button>
							</div>
						</aside>
					</article>
				</div>
			</main>
			<SiteFooter />
		</div>
	)
}

export default SelfHosting
