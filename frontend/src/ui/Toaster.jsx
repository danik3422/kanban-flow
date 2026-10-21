import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Toaster as Sonner } from 'sonner'
import useIsPhone from '../hooks/useIsPhone'
import { useI18n } from '../i18n'
import './toast.css'

// The app's resolved theme (light or dark), whatever the user picked.
const subscribeTheme = (callback) => {
	const observer = new MutationObserver(callback)
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
	return () => observer.disconnect()
}
const readTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

const ICONS = {
	success: <CheckCircle2 size={18} aria-hidden='true' />,
	error: <XCircle size={18} aria-hidden='true' />,
	warning: <AlertTriangle size={18} aria-hidden='true' />,
	info: <Info size={18} aria-hidden='true' />,
	loading: <Loader2 size={18} className='ui-toast__spin' aria-hidden='true' />,
}

/**
 * Toasts in the app's look. On phones they drop in at the top, under the top bar,
 * so they never cover the bottom bar or a sheet's buttons, and swipe away up or
 * sideways; on wider screens they stay bottom right, above the board dock.
 */
const Toaster = () => {
	const isPhone = useIsPhone()
	const { t } = useI18n()
	const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light')
	return (
		<Sonner
			theme={theme}
			position={isPhone ? 'top-center' : 'bottom-right'}
			visibleToasts={isPhone ? 2 : 3}
			duration={isPhone ? 3500 : 4500}
			gap={8}
			offset={{ bottom: 24, right: 24 }}
			mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 62px)', left: 12, right: 12 }}
			swipeDirections={isPhone ? ['top', 'left', 'right'] : ['right', 'bottom']}
			closeButton={!isPhone}
			icons={ICONS}
			toastOptions={{ className: 'ui-toast', closeButtonAriaLabel: t('common.close') }}
			containerAriaLabel={t('app.notifications.label')}
		/>
	)
}

export default Toaster
