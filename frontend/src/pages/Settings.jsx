import { Monitor, Moon, Pencil, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../features/settings/settings.css'
import NotificationSettings from '../features/settings/NotificationSettings'
import SecuritySection from '../features/settings/SecuritySection'
import CalendarLink from '../features/calendar/CalendarLink'
import AppSidebar from '../app/shell/AppSidebar'
import AppTopbar from '../app/shell/AppTopbar'
import useIsPhone from '../hooks/useIsPhone'
import useWorkspaceNavigation from '../app/shell/useWorkspaceNavigation'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, useI18n } from '../i18n'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import { useAuthStore } from '../store/useAuthStore'
import { Avatar, Button, PageHeader, SegmentedControl, Select } from '../ui'
import { weekdayNames, weekStartFor } from '../lib/calendarDates'
import { getStartPage, getWeekStart, setStartPage, setWeekStart, START_PAGES } from '../lib/preferences'
import { applyTheme, useThemeStore } from '../lib/theme'

const SECTIONS = ['account', 'preferences', 'notifications', 'calendar', 'security']
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor }
const START_PAGE_LABELS = { boards: 'app.nav.boards', myTasks: 'app.nav.myTasks', calendar: 'app.nav.calendar' }

const Section = ({ id, title, text, children }) => (
	<section id={id} className='st-section' aria-labelledby={`${id}-title`}>
		<div className='st-section__head'>
			<h2 className='st-section__title' id={`${id}-title`}>{title}</h2>
			{text && <p className='st-section__text'>{text}</p>}
		</div>
		{children}
	</section>
)

const Row = ({ title, description, children, stack = false }) => (
	<div className={stack ? 'st-row st-row--stack' : 'st-row'}>
		<span className='st-row__text'>
			<span className='st-row__title'>{title}</span>
			{description && <span className='st-row__description'>{description}</span>}
		</span>
		<span className='st-row__control'>{children}</span>
	</div>
)

const Settings = () => {
	const { t, language, setLanguage } = useI18n()
	const navigate = useNavigate()
	const authUser = useAuthStore((state) => state.authUser)
	const theme = useThemeStore((state) => state.theme)
	const { isSidebarCollapsed, setIsSidebarCollapsed } = useWorkspaceNavigation()
	const isPhone = useIsPhone()
	const [boards, setBoards] = useState([])
	const [startPage, setStartPageState] = useState(getStartPage)
	const [weekStart, setWeekStartState] = useState(getWeekStart)
	const [activeSection, setActiveSection] = useState(SECTIONS[0])
	const sectionsRef = useRef(null)

	useEffect(() => {
		fetchBoardsWithCache(authUser?._id)
			.then(setBoards)
			.catch(() => setBoards([]))
	}, [authUser?._id])

	// Deep links (#security) land on their section; the nav follows the scroll: the last
	// section whose heading passed the top bar, or the last one once the page bottoms out.
	useEffect(() => {
		const scroller = sectionsRef.current?.closest('.workspace-main')
		if (!scroller) return undefined
		let frame = 0
		const update = () => {
			frame = 0
			const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
			const top = scroller.getBoundingClientRect().top + 120
			const passed = SECTIONS.filter((id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= top)
			setActiveSection(atBottom && scroller.scrollTop > 0 ? SECTIONS.at(-1) : passed.at(-1) || SECTIONS[0])
		}
		const onScroll = () => {
			if (!frame) frame = window.requestAnimationFrame(update)
		}
		update()
		scroller.addEventListener('scroll', onScroll, { passive: true })
		return () => {
			scroller.removeEventListener('scroll', onScroll)
			window.cancelAnimationFrame(frame)
		}
	}, [])

	// Search (⌘K) can open a section while the page is already showing.
	const { hash } = useLocation()
	useEffect(() => {
		const id = hash.replace('#', '')
		const section = SECTIONS.includes(id) ? document.getElementById(id) : null
		if (!section) return undefined
		section.scrollIntoView({ block: 'start' })
		// Lists below (devices, passkeys) arrive a moment later and move the section;
		// keep it in place for a second unless the person starts scrolling themselves.
		const scroller = section.closest('.workspace-main')
		const content = section.parentElement
		if (!scroller || !content || typeof ResizeObserver === 'undefined') return undefined
		const observer = new ResizeObserver(() => section.scrollIntoView({ block: 'start' }))
		const stop = () => observer.disconnect()
		observer.observe(content)
		const timer = window.setTimeout(stop, 1000)
		scroller.addEventListener('wheel', stop, { once: true, passive: true })
		scroller.addEventListener('touchstart', stop, { once: true, passive: true })
		return () => {
			stop()
			window.clearTimeout(timer)
			scroller.removeEventListener('wheel', stop)
			scroller.removeEventListener('touchstart', stop)
		}
	}, [hash])

	const goToSection = (event, id) => {
		event.preventDefault()
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
		window.history.replaceState(null, '', `#${id}`)
	}

	// One switch, one request: show it at once, undo it if the server refuses.
	const changeStartPage = (value) => {
		setStartPage(value)
		setStartPageState(value)
	}
	const changeWeekStart = (value) => {
		setWeekStart(value)
		setWeekStartState(value)
	}

	const dayNames = weekdayNames(language, 1, 'short')
	const autoDay = weekStartFor(language) === 7 ? dayNames[6] : dayNames[0]
	const name = authUser?.name || authUser?.email || ''

	return (
		<div className='workspace-shell'>
			<AppSidebar
				boards={boards}
				selectedBoardId={null}
				onBoardSelect={(board) => navigate(`/workspaces/${board._id}`)}
				onCreateBoard={() => navigate('/workspaces', { state: { createBoard: true } })}
				isCollapsed={isSidebarCollapsed}
			/>
			<main className='workspace-main'>
				<AppTopbar isSidebarCollapsed={isSidebarCollapsed} onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}>
					<span className='app-topbar__title'>{t('settings.title')}</span>
				</AppTopbar>
				<div className='app-page st-page'>
					<PageHeader title={t('settings.title')} description={t('settings.description')} />
					<div className='st-layout'>
						<nav className='st-nav' aria-label={t('settings.navLabel')}>
							{SECTIONS.map((id) => (
								<a key={id} href={`#${id}`} aria-current={activeSection === id ? 'true' : undefined} onClick={(event) => goToSection(event, id)}>
									{t(`settings.sections.${id}`)}
								</a>
							))}
						</nav>
						<div className='st-sections' ref={sectionsRef}>
							<Section id='account' title={t('settings.sections.account')}>
								<div className='st-card st-account'>
									<Avatar name={name} src={authUser?.avatar} size={48} decorative />
									<span className='st-account__who' data-i18n-ignore>
										<span className='st-account__name'>{name}</span>
										<span className='st-account__meta'>{[authUser?.email, authUser?.jobTitle].filter(Boolean).join(' · ')}</span>
									</span>
									<Button as={Link} to='/profile/edit' variant='secondary' size='sm' icon={Pencil}>{t('settings.account.editProfile')}</Button>
								</div>
							</Section>

							<Section id='preferences' title={t('settings.sections.preferences')} text={t('settings.sectionText.preferences')}>
								<div className='st-card'>
									<Row title={t('settings.theme.title')} description={t('settings.theme.text')} stack>
										<SegmentedControl
											label={t('settings.theme.title')}
											value={theme}
											onChange={applyTheme}
											options={['light', 'dark', 'system'].map((value) => ({ value, label: t(isPhone && value === 'system' ? 'theme.systemShort' : `theme.${value}`), icon: THEME_ICONS[value] }))}
										/>
									</Row>
									<Row title={t('settings.language.title')} description={t('settings.language.text')} stack>
										<Select
											aria-label={t('settings.language.title')}
											value={language}
											onChange={(event) => setLanguage(event.target.value)}
											options={SUPPORTED_LANGUAGES.map((code) => ({ value: code, label: LANGUAGE_NAMES[code] }))}
										/>
									</Row>
									<Row title={t('settings.startPage.title')} description={t('settings.startPage.text')} stack>
										<Select
											aria-label={t('settings.startPage.title')}
											value={startPage}
											onChange={(event) => changeStartPage(event.target.value)}
											options={Object.keys(START_PAGES).map((value) => ({ value, label: t(START_PAGE_LABELS[value]) }))}
										/>
									</Row>
									<Row title={t('settings.weekStart.title')} description={t('settings.weekStart.text')} stack>
										<Select
											aria-label={t('settings.weekStart.title')}
											value={weekStart}
											onChange={(event) => changeWeekStart(event.target.value)}
											options={[
												{ value: 'auto', label: t('settings.weekStart.auto', { day: autoDay }) },
												{ value: '1', label: t('settings.weekStart.monday') },
												{ value: '7', label: t('settings.weekStart.sunday') },
											]}
										/>
									</Row>
								</div>
							</Section>

							<Section id='notifications' title={t('settings.sections.notifications')} text={t('settings.sectionText.notifications')}>
								<NotificationSettings />
							</Section>

							<Section id='calendar' title={t('settings.sections.calendar')} text={t('settings.sectionText.calendar')}>
								<div className='st-card st-calendar'>
									<CalendarLink />
								</div>
							</Section>

							<Section id='security' title={t('settings.sections.security')} text={t('settings.sectionText.security')}>
								<SecuritySection />
							</Section>
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}

export default Settings
