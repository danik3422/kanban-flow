import { useAuthStore } from '../store/useAuthStore'

// Desktop notifications: switched on or off for the account (saved on the server),
// and allowed once per browser, because only the browser can grant that.

export const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window

/** 'unsupported' | 'default' (not asked yet) | 'granted' | 'denied' (blocked in the browser) */
export const desktopPermission = () => (desktopSupported() ? window.Notification.permission : 'unsupported')

/** The account wants them and this browser allows them. */
export const desktopEnabled = (user = useAuthStore.getState().authUser) => desktopPermission() === 'granted' && user?.desktopNotifications !== false

/** Asks the browser; resolves to the new permission. */
export const requestDesktopPermission = async () => (desktopSupported() ? window.Notification.requestPermission() : 'unsupported')

const ICON = '/notification-icon.png'

/**
 * Shows one notification when this tab is not in front (in front, the bell and the
 * toast already say it). Clicking it brings the tab back and runs onClick.
 */
export const showDesktopNotification = ({ title, body, tag, onClick, force = false }) => {
	if (!desktopEnabled()) return null
	if (!force && document.visibilityState === 'visible' && document.hasFocus()) return null
	try {
		const notification = new window.Notification(title, { body, tag, icon: ICON, badge: ICON, lang: document.documentElement.lang || undefined })
		notification.onclick = () => {
			window.focus()
			notification.close()
			onClick?.()
		}
		return notification
	} catch {
		return null
	}
}
