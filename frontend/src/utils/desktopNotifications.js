// Desktop notifications: the browser's permission plus a switch kept per device, so
// a work laptop can show them while a shared computer does not.

const KEY = 'kh:desktop-notifications'

export const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window

/** 'unsupported' | 'default' (not asked yet) | 'granted' | 'denied' (blocked in the browser) */
export const desktopPermission = () => (desktopSupported() ? window.Notification.permission : 'unsupported')

export const desktopEnabled = () => {
	try {
		return desktopPermission() === 'granted' && localStorage.getItem(KEY) !== 'off'
	} catch {
		return desktopPermission() === 'granted'
	}
}

export const setDesktopEnabled = (on) => {
	try {
		localStorage.setItem(KEY, on ? 'on' : 'off')
	} catch {
		// The choice lasts for this visit.
	}
}

/** Asks the browser; resolves to the new permission. */
export const requestDesktopPermission = async () => {
	if (!desktopSupported()) return 'unsupported'
	const result = await window.Notification.requestPermission()
	if (result === 'granted') setDesktopEnabled(true)
	return result
}

/**
 * Shows one notification when this tab is not in front (in front, the bell and the
 * toast already say it). Clicking it brings the tab back and runs onClick.
 */
export const showDesktopNotification = ({ title, body, tag, onClick, force = false }) => {
	if (!desktopEnabled()) return null
	if (!force && document.visibilityState === 'visible' && document.hasFocus()) return null
	try {
		const notification = new window.Notification(title, { body, tag, icon: '/icon-512.png', badge: '/apple-touch-icon.png' })
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
