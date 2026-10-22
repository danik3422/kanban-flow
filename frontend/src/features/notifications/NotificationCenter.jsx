import { AlarmClock, ArrowRightLeft, AtSign, Bell, CalendarClock, BellOff, Check, CheckCheck, ClipboardList, MessageCircle, MoreHorizontal, PencilLine, Trash2, UserMinus, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useI18n } from '../../i18n'
import { intlLocale, translateCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { isDevAuthBypass } from '../../lib/devMode'
import { acquireSocket, releaseSocket } from '../../lib/socket'
import { useAuthStore } from '../../store/useAuthStore'
import { EmptyState, IconButton, Menu, Modal, SegmentedControl, Skeleton } from '../../ui'
import { cx } from '../../ui/utils'
import { showDesktopNotification } from './desktopNotifications'
import { describeNotification } from './notificationText'
import { relativeTime } from '../../lib/relativeTime'
import './notifications.css'
import { peekCache } from '../../lib/apiCache'

const TYPE_LOOK = {
	task_assigned: { icon: ClipboardList, tone: 'accent' },
	task_commented: { icon: MessageCircle, tone: 'info' },
	task_mentioned: { icon: AtSign, tone: 'accent' },
	task_moved: { icon: ArrowRightLeft, tone: 'warning' },
	task_updated: { icon: PencilLine, tone: 'neutral' },
	task_unassigned: { icon: UserMinus, tone: 'neutral' },
	task_due_soon: { icon: AlarmClock, tone: 'warning' },
	task_due_changed: { icon: CalendarClock, tone: 'warning' },
}

const PHONE_QUERY = '(max-width: 720px)'
const subscribePhone = (callback) => {
	const query = window.matchMedia(PHONE_QUERY)
	query.addEventListener('change', callback)
	return () => query.removeEventListener('change', callback)
}
const isPhoneWidth = () => window.matchMedia(PHONE_QUERY).matches

const byNewest = (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
const mergeNotifications = (...lists) => {
	const byId = new Map()
	lists.flat().forEach((item) => byId.set(item._id, { ...byId.get(item._id), ...item }))
	return [...byId.values()].sort(byNewest)
}

const dayGroup = (date) => {
	const startOfToday = new Date()
	startOfToday.setHours(0, 0, 0, 0)
	const time = new Date(date).getTime()
	if (time >= startOfToday.getTime()) return 'today'
	if (time >= startOfToday.getTime() - 86400000) return 'yesterday'
	return 'earlier'
}

const NotificationCenter = () => {
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const isPhone = useSyncExternalStore(subscribePhone, isPhoneWidth, () => false)
	const [notifications, setNotifications] = useState(() => (isDevAuthBypass ? [] : peekCache('/notifications') || []))
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(() => !isDevAuthBypass && !peekCache('/notifications'))
	const [filter, setFilter] = useState('all')
	const wrapperRef = useRef(null)
	const triggerRef = useRef(null)
	const panelRef = useRef(null)
	// The latest opener, for desktop notifications clicked later.
	const openRef = useRef(null)

	useEffect(() => {
		if (isDevAuthBypass) return undefined
		const loadNotifications = async () => {
			try {
				const { data } = await axiosInstance.get('/notifications')
				if (!Array.isArray(data)) throw new Error('Unexpected notifications response')
				setNotifications((current) => mergeNotifications(data, current))
			} catch (error) {
				if ([404, 204].includes(error.response?.status)) setNotifications([])
				else if (error.response?.status !== 401) toast.error(translateCurrent('app.notifications.loadError'))
			} finally {
				setIsLoading(false)
			}
		}
		loadNotifications()

		const socket = acquireSocket()
		let hasConnected = socket.connected
		// Notifications created while the connection was down never arrive as events.
		const handleConnect = () => {
			if (hasConnected) loadNotifications()
			hasConnected = true
		}
		const handleNotification = (notification) => {
			setNotifications((current) => mergeNotifications([notification], current))
			const text = describeNotification(translateCurrent, notification, intlLocale(document.documentElement.lang))
			toast.info(text.title, { description: [text.message, text.actor].filter(Boolean).join(' · ') })
			// On the desktop too, when this tab is in the background.
			showDesktopNotification({
				title: text.title,
				// The card on the first line, where and who on the second.
				body: [text.message, [text.context, text.actor].filter(Boolean).join(' · ')].filter(Boolean).join('\n'),
				tag: notification._id,
				onClick: () => openRef.current?.(notification),
			})
		}
		// Another device ended the other sessions; a stale one finds out on this check.
		let sessionTimer
		const handleSessionChanged = () => {
			window.clearTimeout(sessionTimer)
			sessionTimer = window.setTimeout(() => useAuthStore.getState().checkAuth(), 1500)
		}
		socket.on('connect', handleConnect)
		socket.on('notification:new', handleNotification)
		socket.on('session:changed', handleSessionChanged)
		// A device signed in or out: Settings refreshes its list of devices.
		const handleSessionsUpdated = () => window.dispatchEvent(new Event('kh:sessions-updated'))
		socket.on('sessions:updated', handleSessionsUpdated)
		return () => {
			socket.off('sessions:updated', handleSessionsUpdated)
			window.clearTimeout(sessionTimer)
			socket.off('connect', handleConnect)
			socket.off('notification:new', handleNotification)
			socket.off('session:changed', handleSessionChanged)
			releaseSocket()
		}
	}, [])

	const close = (restoreFocus = true) => {
		setIsOpen(false)
		if (restoreFocus) triggerRef.current?.focus({ preventScroll: true })
	}

	// Desktop panel: close on Escape or a click outside, and start keyboard focus inside it.
	useEffect(() => {
		if (!isOpen || isPhone) return undefined
		panelRef.current?.querySelector('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true })
		const handlePointerDown = (event) => {
			// A row's action menu is portalled to the body but still belongs to the panel.
			if (!wrapperRef.current?.contains(event.target) && !event.target.closest?.('.ui-menu')) setIsOpen(false)
		}
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') {
				event.stopPropagation()
				setIsOpen(false)
				triggerRef.current?.focus({ preventScroll: true })
			}
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen, isPhone])

	const unreadCount = notifications.filter((notification) => !notification.readAt).length
	const visible = notifications.filter((notification) => filter === 'all' || !notification.readAt).slice(0, 50)

	const markRead = async (notification) => {
		if (notification.readAt) return
		const readAt = new Date().toISOString()
		setNotifications((current) => current.map((item) => (item._id === notification._id ? { ...item, readAt } : item)))
		try {
			await axiosInstance.patch(`/notifications/${notification._id}/read`)
		} catch {
			setNotifications((current) => current.map((item) => (item._id === notification._id ? { ...item, readAt: null } : item)))
			toast.error(t('app.notifications.updateError'))
		}
	}

	const markAllRead = async () => {
		if (!unreadCount) return
		const previous = notifications
		const readAt = new Date().toISOString()
		setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })))
		try {
			await axiosInstance.patch('/notifications/read-all')
		} catch {
			setNotifications(previous)
			toast.error(t('app.notifications.updateError'))
		}
	}

	const deleteNotification = async (notification) => {
		try {
			await axiosInstance.delete(`/notifications/${notification._id}`)
			setNotifications((current) => current.filter((item) => item._id !== notification._id))
		} catch {
			toast.error(t('app.notifications.deleteError'))
		}
	}

	const openNotification = async (notification) => {
		markRead(notification)
		if (notification.board && notification.task) {
			close(false)
			navigate(`/workspaces/${notification.board}`, { state: { notificationTaskId: notification.task } })
		}
	}
	useEffect(() => {
		openRef.current = openNotification
	})

	const groups = ['today', 'yesterday', 'earlier']
		.map((key) => ({ key, items: visible.filter((notification) => dayGroup(notification.createdAt) === key) }))
		.filter((group) => group.items.length)

	const toolbar = (
		<div className='notify__toolbar'>
			<SegmentedControl
				label={t('app.notifications.filter')}
				value={filter}
				onChange={setFilter}
				options={[
					{ value: 'all', label: <>{t('app.notifications.all')}<span className='ui-segmented__count'>{notifications.length}</span></> },
					{ value: 'unread', label: <>{t('app.notifications.unread')}<span className='ui-segmented__count'>{unreadCount}</span></> },
				]}
			/>
		</div>
	)
	// Sits in the header next to close, on the panel and on the phone sheet alike.
	const markAllButton = unreadCount > 0 && (
		<IconButton icon={CheckCheck} size='sm' label={t('app.notifications.markAll')} onClick={markAllRead} className='notify__mark-all' />
	)

	let body
	if (isLoading) {
		body = (
			<div className='notify__loading' role='status' aria-label={t('app.notifications.loading')}>
				{[0, 1, 2].map((index) => (
					<div key={index} className='notify__skeleton'>
						<Skeleton width={36} height={36} radius={999} />
						<span><Skeleton width='70%' height={14} /><Skeleton width='90%' height={12} /></span>
					</div>
				))}
			</div>
		)
	} else if (!visible.length) {
		body = filter === 'unread' || notifications.length ? (
			<EmptyState icon={CheckCheck} title={t('app.notifications.emptyUnreadTitle')} description={t('app.notifications.emptyUnreadText')} />
		) : (
			<EmptyState icon={BellOff} title={t('app.notifications.emptyTitle')} description={t('app.notifications.emptyText')} />
		)
	} else {
		body = (
			<div className='notify__list'>
				{groups.map((group) => (
					<section key={group.key} aria-labelledby={`notify-group-${group.key}`}>
						<h3 className='notify__group' id={`notify-group-${group.key}`}>{t(`app.notifications.${group.key}`)}</h3>
						<ul>
							{group.items.map((notification) => {
								const { title, message, context, actor } = describeNotification(t, notification, intlLocale(language))
								const summary = [title, message, context, actor].filter(Boolean).join('. ')
								const look = TYPE_LOOK[notification.type] || TYPE_LOOK.task_updated
								const Icon = look.icon
								const unread = !notification.readAt
								return (
									<li key={notification._id} className={cx('notify-item', unread && 'is-unread')}>
										<button
											type='button'
											className='notify-item__main'
											onClick={() => openNotification(notification)}
											aria-label={unread ? t('app.notifications.unreadPrefix', { title: summary }) : summary}
											data-i18n-ignore
										>
											<span className={`notify-item__icon notify-item__icon--${look.tone}`} aria-hidden='true'><Icon size={16} /></span>
											<span className='notify-item__text'>
												<span className='notify-item__title'>{title}</span>
												{message && <span className='notify-item__message'>{message}</span>}
												{context && <span className='notify-item__context'>{context}</span>}
												<span className='notify-item__time'>{[actor, relativeTime(notification.createdAt, language, t('boards.justNow'))].filter(Boolean).join(' · ')}</span>
											</span>
											{unread && <span className='notify-item__dot' aria-hidden='true' />}
										</button>
										{/* A mouse reveals the actions on hover or focus; touch screens get one menu per row. */}
										<span className='notify-item__actions'>
											{unread && <IconButton icon={Check} size='sm' label={t('app.notifications.markRead')} onClick={() => markRead(notification)} />}
											<IconButton icon={Trash2} size='sm' variant='danger' label={t('app.notifications.delete')} onClick={() => deleteNotification(notification)} />
										</span>
										<span className='notify-item__menu'>
											<Menu
												label={t('app.notifications.actions')}
												items={[
													unread && { label: t('app.notifications.markRead'), icon: Check, onSelect: () => markRead(notification) },
													{ label: t('app.notifications.delete'), icon: Trash2, tone: 'danger', onSelect: () => deleteNotification(notification) },
												]}
												trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label={t('app.notifications.actions')} />}
											/>
										</span>
									</li>
								)
							})}
						</ul>
					</section>
				))}
			</div>
		)
	}

	const subtitle = unreadCount ? t('app.notifications.waiting', { count: unreadCount }) : t('app.notifications.caughtUp')

	return (
		<div className='notify' ref={wrapperRef}>
			<button
				ref={triggerRef}
				type='button'
				className='notification-trigger'
				onClick={() => (isOpen ? close() : setIsOpen(true))}
				aria-label={unreadCount ? t('app.notifications.labelUnread', { count: unreadCount }) : t('app.notifications.label')}
				title={t('app.notifications.label')}
				aria-expanded={isOpen}
				aria-haspopup='dialog'
			>
				<Bell size={18} aria-hidden='true' />
				{unreadCount > 0 && <span className='notification-badge' aria-hidden='true'>{unreadCount > 9 ? '9+' : unreadCount}</span>}
			</button>
			{isPhone ? (
				<Modal open={isOpen} onClose={() => close()} title={t('app.notifications.label')} description={subtitle} className='notify-sheet' headerActions={markAllButton || null}>
					{toolbar}
					{body}
				</Modal>
			) : (
				isOpen && (
					<div className='notify__panel' role='dialog' aria-label={t('app.notifications.label')} ref={panelRef}>
						<div className='notify__header'>
							<div>
								<h2 className='notify__title'>{t('app.notifications.label')}</h2>
								<p className='notify__subtitle'>{subtitle}</p>
							</div>
							<span className='notify__header-actions'>
								{markAllButton}
								<IconButton icon={X} size='sm' label={t('app.notifications.close')} onClick={() => close()} />
							</span>
						</div>
						{toolbar}
						<div className='notify__scroll'>{body}</div>
					</div>
				)
			)}
		</div>
	)
}

export default NotificationCenter
