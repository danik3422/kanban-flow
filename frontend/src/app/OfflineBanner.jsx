import { RefreshCw, WifiOff } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../i18n'
import { useConnection } from '../lib/connection'
import { useOutbox } from '../lib/outbox'
import './offline-banner.css'

/**
 * Shown while the server can't be reached: the app keeps working from what this device
 * saved, and changes are kept here until the connection is back (lib/outbox.js). Inside
 * the app it is a strip under the top bar (`inline`); elsewhere a floating notice. While
 * the kept changes are being sent it says so too.
 */
const OfflineBanner = ({ inline = false }) => {
	const { t } = useI18n()
	const offline = useConnection((state) => !state.deviceOnline || !state.apiReachable)
	const pending = useOutbox((state) => state.items.length)
	const syncing = useOutbox((state) => state.syncing)
	const wasOffline = useRef(false)

	useEffect(() => {
		if (inline) return
		if (offline) wasOffline.current = true
		else if (wasOffline.current) {
			wasOffline.current = false
			toast.success(t('app.offline.back'), { id: 'connection' })
		}
	}, [inline, offline, t])

	if (!offline && !(syncing && pending)) return null
	const sending = !offline
	const Icon = sending ? RefreshCw : WifiOff
	return (
		<div className={inline ? 'offline-banner offline-banner--inline' : 'offline-banner offline-banner--floating'} role='status' aria-live={inline ? undefined : 'polite'}>
			<Icon size={16} aria-hidden='true' className={sending ? 'offline-banner__spin' : undefined} />
			<span className='offline-banner__text'>
				<strong>{sending ? t('offline.sending', { count: pending }) : t('app.offline.title')}</strong>
				{!sending && <span>{pending ? t('offline.kept', { count: pending }) : t('app.offline.text')}</span>}
			</span>
		</div>
	)
}

export default OfflineBanner
