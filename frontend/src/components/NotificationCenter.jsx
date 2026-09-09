import { Bell, CheckCheck, ClipboardList, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { socketUrl } from '../lib/runtimeConfig'

const NotificationCenter = () => {
	const [notifications, setNotifications] = useState([])
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const centerRef = useRef(null)

	useEffect(() => {
		const loadNotifications = async () => {
			try {
				const { data } = await axiosInstance.get('/notifications')
				setNotifications(data)
			} catch (error) {
				if (error.response?.status !== 401) {
					toast.error('Could not load notifications')
				}
			} finally {
				setIsLoading(false)
			}
		}
		loadNotifications()

		const socket = io(socketUrl, { withCredentials: true })
		socket.on('notification:new', (notification) => {
			setNotifications((current) => [notification, ...current])
			toast.info(notification.title)
		})
		return () => socket.disconnect()
	}, [])

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (!centerRef.current?.contains(event.target)) setIsOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const unreadCount = notifications.filter((notification) => !notification.readAt).length

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

	return (
		<div className='notification-center' ref={centerRef}>
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
				<div className='notification-popover'>
					<div className='notification-popover-header'>
						<div>
							<strong>Notifications</strong>
							<small>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</small>
						</div>
						<button type='button' onClick={() => setIsOpen(false)} aria-label='Close notifications'>
							<X size={16} />
						</button>
					</div>
					{isLoading ? (
						<p className='notification-empty'>Loading notifications...</p>
					) : notifications.length ? (
						<div className='notification-list'>
							{notifications.slice(0, 20).map((notification) => (
								<button
									key={notification._id}
									type='button'
									className={`notification-item ${notification.readAt ? '' : 'is-unread'}`}
									onClick={() => markRead(notification)}
								>
									<span className='notification-item-icon'><ClipboardList size={16} /></span>
									<span>
										<strong>{notification.title}</strong>
										<small>{notification.message}</small>
										<em>{new Date(notification.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</em>
									</span>
								</button>
							))}
						</div>
					) : (
						<p className='notification-empty'>No notifications yet.</p>
					)}
					{unreadCount > 0 && (
						<button type='button' className='notification-mark-all' onClick={markAllRead}>
							<CheckCheck size={15} /> Mark all as read
						</button>
					)}
				</div>
			)}
		</div>
	)
}

export default NotificationCenter