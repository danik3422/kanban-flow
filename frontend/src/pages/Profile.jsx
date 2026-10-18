import { AlertTriangle, BriefcaseBusiness, Camera, Check, CheckCircle2, Circle, Clock3, LayoutGrid, ListTodo, Settings2, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AvatarEditor from '../components/profile/AvatarEditor'
import '../components/profile/profile.css'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import TimezonePicker from '../components/timezone/TimezonePicker'
import { normalizeTimezone } from '../data/timezones'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'
import { useI18n } from '../i18n'
import { intlLocale, translateServerMessageCurrent } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import { useAuthStore } from '../store/useAuthStore'
import { Avatar, Badge, Button, ConfirmDialog, Field, Input, Menu, PageHeader, Skeleton } from '../ui'
import { getDueDateKey, getLocalDateKey } from '../utils/dueDate'

const timeIn = (timezone, language) => {
	try {
		return new Intl.DateTimeFormat(intlLocale(language), { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date())
	} catch {
		return ''
	}
}

const Profile = () => {
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const { authUser, checkAuth } = useAuthStore()
	const { isSidebarCollapsed, setIsSidebarCollapsed } = useWorkspaceNavigation()
	const saved = useMemo(() => ({ name: authUser?.name || '', jobTitle: authUser?.jobTitle || '', timezone: normalizeTimezone(authUser?.timezone || 'UTC') }), [authUser?.name, authUser?.jobTitle, authUser?.timezone])
	const [form, setForm] = useState(saved)
	const [nameError, setNameError] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [editorOpen, setEditorOpen] = useState(false)
	const [editorFile, setEditorFile] = useState(null)
	const [confirmRemove, setConfirmRemove] = useState(false)
	const [isRemoving, setIsRemoving] = useState(false)
	const [boards, setBoards] = useState([])
	const [tasks, setTasks] = useState(null)
	const [, setClock] = useState(0)

	// Saved values arrive after a save or a refresh; keep unsaved edits otherwise.
	const [savedSnapshot, setSavedSnapshot] = useState(saved)
	if (savedSnapshot !== saved) {
		setSavedSnapshot(saved)
		setForm(saved)
	}

	useEffect(() => {
		fetchBoardsWithCache(authUser?._id).then(setBoards).catch(() => setBoards([]))
		axiosInstance.get('/board/my-tasks').then(({ data }) => setTasks(Array.isArray(data) ? data : [])).catch(() => setTasks([]))
	}, [authUser?._id])

	// The local time on the card stays current.
	useEffect(() => {
		const timer = window.setInterval(() => setClock((tick) => tick + 1), 30000)
		return () => window.clearInterval(timer)
	}, [])

	const dirty = form.name !== saved.name || form.jobTitle !== saved.jobTitle || form.timezone !== saved.timezone
	const displayName = authUser?.name || authUser?.email || ''
	const memberSince = authUser?.createdAt ? new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(authUser.createdAt)) : ''

	const todayKey = getLocalDateKey()
	const stats = tasks && {
		boards: boards.length,
		open: tasks.filter((task) => !task.isDone).length,
		overdue: tasks.filter((task) => !task.isDone && getDueDateKey(task.dueDate) && getDueDateKey(task.dueDate) < todayKey).length,
		done: tasks.filter((task) => task.isDone).length,
	}

	const checklist = [
		{ key: 'photo', done: Boolean(authUser?.avatar), action: () => setEditorOpen(true) },
		{ key: 'role', done: Boolean(saved.jobTitle), action: () => document.getElementById('profile-job')?.focus() },
		{ key: 'timezone', done: Boolean(authUser?.timezone), action: () => document.getElementById('profile-timezone')?.focus() },
	]
	const completion = Math.round(((1 + checklist.filter((item) => item.done).length) / (1 + checklist.length)) * 100)

	const update = (key) => (event) => {
		const { value } = event.target
		setForm((current) => ({ ...current, [key]: value }))
		if (key === 'name') setNameError('')
	}

	const saveProfile = async (event) => {
		event?.preventDefault()
		if (!form.name.trim()) {
			setNameError(t('auth.errors.nameRequired'))
			return
		}
		setIsSaving(true)
		try {
			await axiosInstance.patch('/auth/setup-profile', { name: form.name.trim(), jobTitle: form.jobTitle.trim(), timezone: form.timezone })
			await checkAuth()
			toast.success(t('profile.saved'))
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'profile.saveError'))
		} finally {
			setIsSaving(false)
		}
	}

	const currentName = () => saved.name || authUser?.email?.split('@')[0] || 'User'

	const savePhoto = async (dataUrl) => {
		try {
			await axiosInstance.patch('/auth/setup-profile', { name: currentName(), avatar: dataUrl })
			await checkAuth()
			toast.success(t('profile.photo.saved'))
			return true
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'profile.photo.saveError'))
			return false
		}
	}

	const removePhoto = async () => {
		setIsRemoving(true)
		try {
			await axiosInstance.patch('/auth/setup-profile', { name: currentName(), removeAvatar: true })
			await checkAuth()
			toast.success(t('profile.photo.removed'))
			setConfirmRemove(false)
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'profile.saveError'))
		} finally {
			setIsRemoving(false)
		}
	}

	const openEditor = (file = null) => {
		setEditorFile(file)
		setEditorOpen(true)
	}

	const photoButton = (
		<Menu
			label={t('profile.photo.menu')}
			trigger={(props) => (
				<button type='button' className='pf-avatar' aria-label={t('profile.photo.menu')} {...props}>
					<Avatar name={displayName} src={authUser?.avatar} size={96} decorative />
					<span className='pf-avatar__badge' aria-hidden='true'><Camera size={15} /></span>
				</button>
			)}
			items={[
				{ label: authUser?.avatar ? t('profile.photo.change') : t('profile.photo.add'), icon: Upload, onSelect: () => openEditor() },
				...(authUser?.avatar ? [{ label: t('profile.photo.remove'), icon: Trash2, tone: 'danger', onSelect: () => setConfirmRemove(true) }] : []),
			]}
		/>
	)

	const stat = (key, icon, value, to, tone) => {
		const Icon = icon
		return (
			<Link key={key} to={to} className={`pf-stat${tone ? ` pf-stat--${tone}` : ''}`}>
				<Icon size={16} aria-hidden='true' />
				<span className='pf-stat__value'>{value}</span>
				<span className='pf-stat__label'>{t(`profile.stats.${key}`)}</span>
			</Link>
		)
	}

	return (
		<div className='workspace-shell flex h-dvh'>
			<WorkspaceSidebar
				boards={boards}
				selectedBoardId={null}
				onBoardSelect={(board) => navigate(`/workspaces/${board._id}`)}
				onCreateBoard={() => navigate('/workspaces', { state: { createBoard: true } })}
				isCollapsed={isSidebarCollapsed}
			/>
			<main className='workspace-main flex-1 overflow-auto'>
				<WorkspaceTopbar isSidebarCollapsed={isSidebarCollapsed} onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}>
					<span className='app-topbar__title'>{t('profile.title')}</span>
				</WorkspaceTopbar>
				<div className='app-page pf-page'>
					<PageHeader
						title={t('profile.title')}
						description={t('profile.description')}
						actions={<Button as={Link} to='/settings' variant='secondary' size='sm' icon={Settings2}>{t('profile.accountSettings')}</Button>}
					/>
					<div className='pf-layout'>
						<div className='pf-main'>
							<section className='pf-card pf-hero' aria-label={t('profile.cardLabel')}>
								{photoButton}
								<div className='pf-hero__text'>
									<h2 className='pf-hero__name' data-i18n-ignore>{displayName}</h2>
									<p className='pf-hero__role'>{saved.jobTitle ? <span data-i18n-ignore>{saved.jobTitle}</span> : <span className='pf-muted'>{t('profile.noRole')}</span>}</p>
									<p className='pf-hero__meta'>
										<span data-i18n-ignore>{authUser?.email}</span>
										{saved.timezone && <span><Clock3 size={13} aria-hidden='true' /> {t('profile.localTime', { time: timeIn(saved.timezone, language) })}</span>}
										{memberSince && <span>{t('profile.memberSince', { date: memberSince })}</span>}
									</p>
								</div>
							</section>

							<form className='pf-card pf-form' onSubmit={saveProfile} noValidate>
								<h2 className='pf-section-title'>{t('profile.details')}</h2>
								<Field label={t('auth.setup.name')} error={nameError}>
									<Input id='profile-name' value={form.name} onChange={update('name')} autoComplete='name' maxLength={120} />
								</Field>
								<Field label={t('auth.setup.job')} optional hint={t('profile.roleHint')}>
									<Input id='profile-job' icon={BriefcaseBusiness} value={form.jobTitle} onChange={update('jobTitle')} placeholder={t('auth.setup.jobPlaceholder')} autoComplete='organization-title' maxLength={120} />
								</Field>
								<Field label={t('auth.setup.timezone')} hint={t('profile.timezoneHint', { time: timeIn(form.timezone, language) })}>
									<TimezonePicker id='profile-timezone' value={form.timezone} onChange={(timezone) => setForm((current) => ({ ...current, timezone }))} />
								</Field>
								<div className={`pf-savebar${dirty ? ' is-visible' : ''}`} aria-hidden={!dirty}>
									<span className='pf-savebar__text'>{t('profile.unsaved')}</span>
									<Button variant='ghost' onClick={() => setForm(saved)} disabled={!dirty || isSaving} tabIndex={dirty ? 0 : -1}>{t('profile.discard')}</Button>
									<Button type='submit' icon={Check} loading={isSaving} disabled={!dirty} tabIndex={dirty ? 0 : -1}>{t('common.save')}</Button>
								</div>
							</form>

							<section className='pf-card'>
								<h2 className='pf-section-title'>{t('profile.activity')}</h2>
								{stats ? (
									<div className='pf-stats'>
										{stat('boards', LayoutGrid, stats.boards, '/workspaces')}
										{stat('open', ListTodo, stats.open, '/my-tasks')}
										{stat('overdue', AlertTriangle, stats.overdue, '/my-tasks', stats.overdue ? 'danger' : '')}
										{stat('done', CheckCircle2, stats.done, '/my-tasks')}
									</div>
								) : (
									<div className='pf-stats' aria-hidden='true'>{[0, 1, 2, 3].map((index) => <Skeleton key={index} height={84} radius={14} />)}</div>
								)}
							</section>
						</div>

						<aside className='pf-side'>
							{completion < 100 && (
								<section className='pf-card'>
									<div className='pf-complete__head'>
										<h2 className='pf-section-title'>{t('profile.complete.title')}</h2>
										<span className='pf-complete__value'>{completion}%</span>
									</div>
									<span className='pf-complete__bar' aria-hidden='true'><span style={{ width: `${completion}%` }} /></span>
									<ul className='pf-checklist'>
										{checklist.map((item) => (
											<li key={item.key} className={item.done ? 'is-done' : undefined}>
												{item.done ? <CheckCircle2 size={16} aria-hidden='true' /> : <Circle size={16} aria-hidden='true' />}
												<span>{t(`profile.complete.${item.key}`)}</span>
												{!item.done && <button type='button' className='pf-link' onClick={item.action}>{t('profile.complete.fix')}</button>}
											</li>
										))}
									</ul>
								</section>
							)}

							<section className='pf-card'>
								<h2 className='pf-section-title'>{t('profile.preview.title')}</h2>
								<p className='pf-muted pf-preview__text'>{t('profile.preview.text')}</p>
								<div className='pf-preview' data-i18n-ignore>
									<div className='pf-preview__person'>
										<Avatar name={form.name || displayName} src={authUser?.avatar} size={40} decorative />
										<span className='pf-preview__who'>
											<strong>{form.name || displayName}</strong>
											<span>{[form.jobTitle, timeIn(form.timezone, language)].filter(Boolean).join(' · ')}</span>
										</span>
									</div>
									<div className='pf-preview__task'>
										<span>{t('profile.preview.task')}</span>
										<Avatar name={form.name || displayName} src={authUser?.avatar} size={24} decorative />
									</div>
								</div>
								<Badge>{t('profile.preview.live')}</Badge>
							</section>
						</aside>
					</div>
				</div>
			</main>

			<AvatarEditor open={editorOpen} initialFile={editorFile} name={form.name || displayName} onClose={() => setEditorOpen(false)} onSave={savePhoto} />
			<ConfirmDialog
				open={confirmRemove}
				onClose={() => setConfirmRemove(false)}
				onConfirm={removePhoto}
				loading={isRemoving}
				title={t('profile.photo.removeTitle')}
				description={t('profile.photo.removeText')}
				confirmLabel={t('profile.photo.remove')}
			/>
		</div>
	)
}

export default Profile
