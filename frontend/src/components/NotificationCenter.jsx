import { ArrowRightLeft, Bell, CheckCheck, ClipboardList, MessageCircle, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { socketUrl } from '../lib/runtimeConfig'
import Popover from './Popover'

const NotificationCenter = () => {
	const [notifications, setNotifications] = useState([])
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [filter, setFilter] = useState('all')

	useEffect(() => {
		const loadNotifications = async () => {
			try {
				const { data } = await axiosInstance.get('/notifications')
				setNotifications((current) => {
					const nextById = new Map([...data.map((item) => [item._id, item]), ...current.map((item) => [item._id, item])])
					return [...nextById.values()].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
				})
			} catch (error) {
				if ([404, 204].includes(error.response?.status)) {
					setNotifications([])
				} else if (error.response?.status !== 401) {
					toast.error('Could not load notifications')
				}
			} finally {
				setIsLoading(false)
			}
		}
		loadNotifications()

		const socket = io(socketUrl, { withCredentials: true })
		socket.on('notification:new', (notification) => {
			setNotifications((current) => {
				const merged = [notification, ...current]
				const uniqueById = new Map()
				merged.forEach((item) => uniqueById.set(item._id, item))
				return [...uniqueById.values()].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
			})
			toast.info(notification.title)
		})
		return () => socket.disconnect()
	}, [])

	const unreadCount = notifications.filter((notification) => !notification.readAt).length
	const visibleNotifications = notifications
		.filter((notification) => filter === 'all' || !notification.readAt)
		.slice(0, 20)
	const notificationIcon = (type) => {
		if (type === 'task_commented') return MessageCircle
		if (type === 'task_moved') return ArrowRightLeft
		return ClipboardList
	}

	const markRead = async (notification) => {
		if (notification.readAt) return
		try {
			await axiosInstance.patch(`/notifications/${notification._id}/read`)
			setNotifications((current) =>
				current.map((item) =>
					item._id === notification._id
						? { ...item, readAt: new Date().toISOString() }
						: item,
				),
			)
		} catch {
			toast.error('Could not update notification')
		}
	}

	const markAllRead = async () => {
		if (!unreadCount) return
		try {
			await axiosInstance.patch('/notifications/read-all')
			setNotifications((current) =>
				current.map((notification) => ({
					...notification,
					readAt: notification.readAt || new Date().toISOString(),
				})),
			)
		} catch {
			toast.error('Could not update notifications')
		}
	}

	const deleteNotification = async (notification) => {
		try {
			await axiosInstance.delete(`/notifications/${notification._id}`)
			setNotifications((current) => current.filter((item) => item._id !== notification._id))
		} catch {
			toast.error('Could not delete notification')
		}
	}

	return (
		<Popover isOpen={isOpen} onClose={() => setIsOpen(false)} className='notification-center'>
			<button
				type='button'
				className='notification-trigger'
				onClick={() => setIsOpen((value) => !value)}
				aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
				aria-expanded={isOpen}
			>
				<Bell size={18} />
				{unreadCount > 0 && <span className='notification-badge'>{unreadCount > 9 ? '9+' : unreadCount}</span>}
			</button>
			{isOpen && (
				<div className='popover-shell notification-popover' role='dialog' aria-label='Notifications'>
					<div className='popover-header notification-popover-header'>
						<div className='notification-heading-copy'><div className='notification-heading-title'><strong>Notifications</strong></div><small>{unreadCount ? `${unreadCount} waiting for you` : 'All caught up'}</small></div>
						<button type='button' className='icon-button' onClick={() => setIsOpen(false)} aria-label='Close notifications' title='Close'>
							<X size={16} />
						</button>
					</div>
					<div className='notification-tabs' role='tablist' aria-label='Notification filter'>
						<button type='button' role='tab' aria-selected={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All <b>{notifications.length}</b></button>
						<button type='button' role='tab' aria-selected={filter === 'unread'} className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>Unread <b>{unreadCount}</b></button>
					</div>
					{isLoading ? (
						<p className='notification-empty'>Loading notifications...</p>
					) : visibleNotifications.length ? (
						<div className='notification-list'>
							{visibleNotifications.map((notification) => (
								<div
									key={notification._id}
									className={`notification-item ${notification.readAt ? '' : 'is-unread'}`}
									onClick={() => markRead(notification)}
									onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); markRead(notification) } }}
									role='button'
									tabIndex='0'
									aria-label={`${notification.readAt ? '' : 'Unread: '}${notification.title}`}
								>
									<span className='notification-item-icon'>{(() => { const Icon = notificationIcon(notification.type); return <Icon size={16} /> })()}</span>
									<span className='notification-item-content'>
										<strong>{notification.title}</strong>
										<small>{notification.message}</small>
										<em>{new Date(notification.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</em>
									</span>
									<button type='button' className='notification-delete' onClick={(event) => { event.stopPropagation(); deleteNotification(notification) }} aria-label={`Delete ${notification.title}`} title='Delete notification'><Trash2 size={14} /></button>
								</div>
							))}
						</div>
					) : (
						<p className='notification-empty'>{filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}</p>
					)}
					{unreadCount > 0 && (
						<button type='button' className='notification-mark-all' onClick={markAllRead}>
							<CheckCheck size={15} /> Mark all as read
						</button>
					)}
				</div>
			)}
		</Popover>
	)
}

export default NotificationCenter