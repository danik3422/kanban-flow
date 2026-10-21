import { WifiOff } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../i18n'
import { useConnection } from '../lib/connection'
import './offline-banner.css'

/**
 * Shown while the server can't be reached: the app keeps working from what this
 * device saved, read-only. Inside the app it is a strip under the top bar
 * (`inline`); elsewhere a floating notice. Says so once the connection is back.
 */
const OfflineBanner = ({ inline = false }) => {
	const { t } = useI18n()
	const offline = useConnection((state) => !state.deviceOnline || !state.apiReachable)
	const wasOffline = useRef(false)

	useEffect(() => {
		if (inline) return
		if (offline) wasOffline.current = true
		else if (wasOffline.current) {
			wasOffline.current = false
			toast.success(t('app.offline.back'), { id: 'connection' })
		}
	}, [inline, offline, t])

	if (!offline) return null
	return (
		<div className={inline ? 'offline-banner offline-banner--inline' : 'offline-banner offline-banner--floating'} role='status' aria-live={inline ? undefined : 'polite'}>
			<WifiOff size={16} aria-hidden='true' />
			<span className='offline-banner__text'>
				<strong>{t('app.offline.title')}</strong>
				<span>{t('app.offline.text')}</span>
			</span>
		</div>
	)
}

export default OfflineBanner
