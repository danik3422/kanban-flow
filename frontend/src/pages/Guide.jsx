import { ArrowRight, ArrowUp, Check, ChevronDown, CircleHelp, Lightbulb, Mail, MousePointerClick, RotateCcw, Search, X } from 'lucide-react'
import { use, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import { BoardDemo, CalendarAppsDemo, GuideIcon, KeysDemo, RepeatDemo, Rich, RulesDemo, ViewsDemo } from '../features/guide/GuideDemos'
import { guideContentFor } from '../features/guide/guideContent'
import { readProgress, saveProgress, searchSections } from '../features/guide/guideModel'
import '../features/guide/guide.css'
import SiteFooter from '../features/site/SiteFooter'
import SiteHeader from '../features/site/SiteHeader'
import { ISSUES_URL } from '../features/site/links'
import '../features/site/docs.css'
import '../features/site/site.css'
import { useI18n } from '../i18n'
import { useAuthStore } from '../store/useAuthStore'
import { Button, IconButton, Input } from '../ui'
import { cx } from '../ui/utils'

// Smooth scrolling, unless the reader asked for less motion.
const smoothScroll = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

// The section in view, for the table of contents.
const useActiveSection = (ids) => {
	const [active, setActive] = useState(ids[0])
	const key = ids.join()
	useEffect(() => {
		const ids = key ? key.split(',') : []
		const visible = new Map()
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : null)
			const shown = ids.filter((id) => visible.get(id) !== null && visible.get(id) !== undefined)
			if (shown.length) setActive(shown[0])
		}, { rootMargin: '-96px 0px -55% 0px' })
		for (const id of ids) {
			const element = document.getElementById(id)
			if (element) observer.observe(element)
		}
		return () => observer.disconnect()
	}, [key])
	return active
}

const Demo = ({ section, content }) => {
	switch (section.demo) {
		case 'board': return <BoardDemo copy={content.demos.board} />
		case 'views': return <ViewsDemo section={section} keysLabel={content.ui.keys} />
		case 'repeat': return <RepeatDemo copy={content.demos.repeat} />
		case 'rules': return <RulesDemo copy={content.demos.rules} />
		case 'keys': return <KeysDemo copy={content.demos.keys} />
		case 'calendarApps': return <CalendarAppsDemo section={section} copy={content.demos.calendar} />
		default: return null
	}
}

/** "Try it": opens the right place in the app, or asks to sign in first. */
const TryIt = ({ action, ui }) => {
	const authUser = useAuthStore((state) => state.authUser)
	if (!action) return null
	return authUser ? (
		<Button as={Link} to={action.to} state={action.state} variant='secondary' size='sm' iconRight={ArrowRight}>{action.label}</Button>
	) : (
		<span className='gd-try__guest'>
			<Button as={Link} to='/signup' variant='secondary' size='sm' iconRight={ArrowRight}>{ui.tryIt}</Button>
			<span>{ui.tryNeedsAccount}</span>
		</span>
	)
}

const Section = ({ section, number, content, isRead, onRead, onUnread, nextId }) => {
	const { ui } = content
	const markRead = () => {
		onRead(section.id)
		const next = nextId && document.getElementById(nextId)
		if (next) next.scrollIntoView({ behavior: smoothScroll(), block: 'start' })
	}
	return (
		<section id={section.id} className={cx('doc-section gd-section', isRead && 'is-read')} aria-labelledby={`${section.id}-title`}>
			<header className='gd-section__head'>
				<span className='gd-section__icon' aria-hidden='true'><GuideIcon name={section.icon} size={22} /></span>
				<div className='gd-section__heading'>
					<p className='gd-section__meta'>
						<span>{String(number).padStart(2, '0')}</span>
						<span aria-hidden='true'>·</span>
						<span>{ui.minutes.replace('{count}', section.minutes)}</span>
						{isRead && <span className='gd-section__read'><Check size={13} aria-hidden='true' />{ui.read}</span>}
					</p>
					<h2 id={`${section.id}-title`} className='doc-section__title gd-section__title'>{section.title}</h2>
				</div>
			</header>
			<Rich as='p' className='doc-lead gd-section__lead' text={section.lead} />

			{section.steps && (
				<ol className='doc-steps gd-steps'>
					{section.steps.map((step, index) => (
						<li key={step.title} className='doc-step'>
							<span className='doc-step__number' aria-hidden='true'>{index + 1}</span>
							<div className='doc-step__body'>
								<h3 className='doc-step__title'>{step.title}</h3>
								<Rich as='p' text={step.text} />
							</div>
						</li>
					))}
				</ol>
			)}

			{section.items && (
				<ul className='gd-items'>
					{section.items.map((item) => (
						<li key={item.title} className='gd-item'>
							<span className='gd-item__icon' aria-hidden='true'><GuideIcon name={item.icon} size={18} /></span>
							<div>
								<h3 className='gd-item__title'>{item.title}</h3>
								<Rich as='p' className='gd-item__text' text={item.text} />
								{item.link && <Link to={item.link.to} className='gd-item__link'>{item.link.label}<ArrowRight size={14} aria-hidden='true' /></Link>}
							</div>
						</li>
					))}
				</ul>
			)}

			{section.demo && (
				<figure className='gd-demo'>
					<figcaption className='gd-demo__caption'>
						<span className='gd-demo__badge'><MousePointerClick size={14} aria-hidden='true' />{ui.interactive}</span>
						{section.demoText && <span>{section.demoText}</span>}
					</figcaption>
					<Demo section={section} content={content} />
				</figure>
			)}

			{section.tips?.length > 0 && (
				<aside className='gd-tips' aria-label={ui.tips}>
					<p className='gd-tips__title'><Lightbulb size={16} aria-hidden='true' />{ui.tips}</p>
					<ul>
						{section.tips.map((tip) => <li key={tip}><Rich text={tip} /></li>)}
					</ul>
				</aside>
			)}

			<footer className='gd-section__foot'>
				<TryIt action={section.try} ui={ui} />
				{isRead ? (
					<Button variant='ghost' size='sm' icon={RotateCcw} onClick={() => onUnread(section.id)}>{ui.unmark}</Button>
				) : (
					<Button size='sm' icon={Check} onClick={markRead}>{ui.markRead}</Button>
				)}
			</footer>
		</section>
	)
}

// Back to the top, with keyboard focus on the title so Tab continues from there.
const toTop = (event) => {
	event.preventDefault()
	window.scrollTo({ top: 0, behavior: smoothScroll() })
	document.getElementById('guide-title')?.focus({ preventScroll: true })
}

/** The user guide: every feature step by step, with tips and things to try in the page. */
const Guide = () => {
	// While another language loads, the page keeps showing the current one.
	const language = useDeferredValue(useI18n().language)
	const content = use(guideContentFor(language))
	const { ui, sections, faq } = content
	const authUser = useAuthStore((state) => state.authUser)
	const [query, setQuery] = useState('')
	const [read, setRead] = useState(readProgress)
	const found = useMemo(() => searchSections(sections, query), [sections, query])
	const shown = sections.filter((section) => found.includes(section.id))
	const active = useActiveSection(shown.map((section) => section.id))
	const known = read.filter((id) => sections.some((section) => section.id === id))
	const percent = Math.round((known.length / sections.length) * 100)

	const update = (next) => {
		setRead(next)
		saveProgress(next)
	}
	const results = (count) => {
		const forms = ui.results
		const category = new Intl.PluralRules(language).select(count)
		return (forms[category] ?? forms.other).replace('{count}', count)
	}

	return (
		<div className='site-page'>
			<SiteHeader />
			<main className='doc gd'>
				<header className='doc-hero gd-hero'>
					<div className='doc-hero__copy'>
						<p className='home-eyebrow home-eyebrow--pill'>{ui.eyebrow}</p>
						<h1 id='guide-title' className='doc-hero__title' tabIndex={-1}>{ui.title}</h1>
						<p className='doc-hero__lead'>{ui.lead}</p>
						<div className='doc-hero__actions'>
							<Button as='a' href='#start' size='lg' iconRight={ArrowRight}>{ui.start}</Button>
							{authUser
								? <Button as={Link} to='/workspaces' variant='secondary' size='lg'>{ui.openApp}</Button>
								: <Button as={Link} to='/signup' variant='secondary' size='lg'>{ui.signup}</Button>}
						</div>
					</div>
					<div className='gd-progress-card'>
						<div className='gd-progress' role='progressbar' aria-valuemin={0} aria-valuemax={sections.length} aria-valuenow={known.length} aria-label={ui.progress.replace('{done}', known.length).replace('{total}', sections.length)}>
							<svg viewBox='0 0 120 120' className='gd-progress__ring' aria-hidden='true'>
								<circle cx='60' cy='60' r='52' className='gd-progress__track' />
								<circle cx='60' cy='60' r='52' className='gd-progress__value' style={{ strokeDashoffset: 327 - (327 * percent) / 100 }} />
							</svg>
							<span className='gd-progress__number'>{percent}%</span>
						</div>
						<p className='gd-progress__text'>{known.length === sections.length ? ui.progressDone : ui.progress.replace('{done}', known.length).replace('{total}', sections.length)}</p>
						{known.length > 0 && <Button variant='ghost' size='sm' icon={RotateCcw} onClick={() => update([])}>{ui.reset}</Button>}
					</div>
				</header>

				<div className='gd-search'>
					<Input
						type='search'
						icon={Search}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={ui.searchPlaceholder}
						aria-label={ui.search}
						action={query ? <IconButton icon={X} size='sm' label={ui.clearSearch} onClick={() => setQuery('')} /> : null}
					/>
					{query && <p className='gd-search__count' aria-live='polite'>{shown.length ? results(shown.length) : ui.noResults}</p>}
				</div>

				<nav className='doc-chips' aria-label={ui.toc}>
					{shown.map((section) => (
						<a key={section.id} href={`#${section.id}`} className={cx('doc-chips__item', active === section.id && 'is-active', known.includes(section.id) && 'is-read')} aria-current={active === section.id ? 'location' : undefined}>
							{known.includes(section.id) && <Check size={13} aria-hidden='true' />}
							{section.title}
						</a>
					))}
				</nav>

				<div className='doc-layout'>
					<aside className='doc-toc'>
						<nav aria-label={ui.toc}>
							<p className='doc-toc__title'>{ui.toc}</p>
							<ol>
								{shown.map((section) => (
									<li key={section.id}>
										<a href={`#${section.id}`} className={cx(active === section.id && 'is-active', known.includes(section.id) && 'is-read')} aria-current={active === section.id ? 'location' : undefined}>
											<span className='doc-toc__number gd-toc__mark' aria-hidden='true'>
												{known.includes(section.id) ? <Check size={13} /> : String(sections.indexOf(section) + 1).padStart(2, '0')}
											</span>
											{section.title}
										</a>
									</li>
								))}
							</ol>
						</nav>
					</aside>

					<div className='doc-content'>
						{shown.map((section) => {
							const index = sections.indexOf(section)
							return (
								<Section
									key={section.id}
									section={section}
									number={index + 1}
									content={content}
									isRead={known.includes(section.id)}
									nextId={shown[shown.indexOf(section) + 1]?.id || 'faq'}
									onRead={(id) => update([...new Set([...known, id])])}
									onUnread={(id) => update(known.filter((item) => item !== id))}
								/>
							)
						})}

						<section id='faq' className='doc-section gd-faq' aria-labelledby='faq-title'>
							<h2 id='faq-title' className='doc-section__title'><CircleHelp size={22} aria-hidden='true' />{ui.faqTitle}</h2>
							<div className='doc-faq'>
								{faq.map((item) => (
									<details key={item.q} className='doc-faq__item gd-faq__item'>
										<summary>{item.q}<ChevronDown size={18} aria-hidden='true' /></summary>
										<Rich as='p' className='doc-faq__answer' text={item.a} />
									</details>
								))}
							</div>
						</section>

						<section className='doc-more gd-more'>
							<div className='doc-more__copy'>
								<h2 className='doc-more__title'>{ui.moreTitle}</h2>
								<p>{ui.moreText}</p>
							</div>
							<div className='doc-more__actions'>
								<Button as='a' href='mailto:support@kanbanhub.app' variant='secondary' icon={Mail}>{ui.support}</Button>
								<Button as='a' href={ISSUES_URL} target='_blank' rel='noreferrer' variant='secondary' icon={FaGithub}>{ui.report}</Button>
								<Button as='a' href='#guide-title' variant='ghost' icon={ArrowUp} onClick={toTop}>{ui.toTop}</Button>
							</div>
						</section>
					</div>
				</div>
			</main>
			<SiteFooter />
		</div>
	)
}

export default Guide
