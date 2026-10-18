import { Laptop, LogOut, MonitorSmartphone, Smartphone, Tablet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../i18n'
import { intlLocale, translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { Badge, Button, ConfirmDialog, Skeleton } from '../../ui'

const ICONS = { desktop: Laptop, phone: Smartphone, tablet: Tablet, unknown: MonitorSmartphone }
const ACTIVE_NOW_MS = 10 * 60 * 1000

const relativeTime = (value, now, locale) => {
	const seconds = (new Date(value).getTime() - now) / 1000
	const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
	const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
	for (const [unit, size] of units) {
		if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
	}
	return format.format(0, 'minute')
}

/**
 * Where the account is signed in: this device first, each other one can be signed
 * out on its own, or all of them at once.
 */
const DevicesList = () => {
	const { t, language } = useI18n()
	const locale = intlLocale(language)
	const [sessions, setSessions] = useState(null)
	const [loadedAt, setLoadedAt] = useState(0)
	const [failed, setFailed] = useState(false)
	const [target, setTarget] = useState(null) // a session, or 'others'
	const [isBusy, setIsBusy] = useState(false)

	const load = useCallback(async () => {
		try {
			const { data } = await axiosInstance.get('/auth/sessions')
			setSessions(data)
			setLoadedAt(Date.now())
			setFailed(false)
		} catch {
			setFailed(true)
		}
	}, [])

	// Fresh when another device signs in or out, and whenever you come back to the tab.
	useEffect(() => {
		queueMicrotask(load)
		const onVisible = () => {
			if (document.visibilityState === 'visible') load()
		}
		document.addEventListener('visibilitychange', onVisible)
		window.addEventListener('kh:sessions-updated', load)
		return () => {
			document.removeEventListener('visibilitychange', onVisible)
			window.removeEventListener('kh:sessions-updated', load)
		}
	}, [load])

	const nameOf = (session) => (session.browser && session.os
		? t('settings.sessions.deviceName', { browser: session.browser, os: session.os })
		: session.browser || session.os || t('settings.sessions.unknownDevice'))
	const formatDate = (value) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
	const detailsOf = (session) => {
		const active = session.current || loadedAt - new Date(session.lastSeenAt).getTime() < ACTIVE_NOW_MS
			? t('settings.sessions.activeNow')
			: t('settings.sessions.lastActive', { time: relativeTime(session.lastSeenAt, loadedAt, locale) })
		const via = ['password', 'passkey', 'signup', 'google', 'microsoft', 'apple'].includes(session.method) ? ` ${t(`settings.sessions.via.${session.method}`)}` : ''
		return [active, `${t('settings.sessions.signedIn', { date: formatDate(session.createdAt) })}${via}`, session.ip].filter(Boolean)
	}

	const others = (sessions || []).filter((session) => !session.current)

	const confirm = async () => {
		if (!target || isBusy) return
		setIsBusy(true)
		try {
			if (target === 'others') {
				await axiosInstance.post('/auth/sessions/sign-out-others')
				toast.success(t('settings.sessions.done'))
			} else {
				await axiosInstance.delete(`/auth/sessions/${target.id}`)
				toast.success(t('settings.sessions.signedOut', { device: nameOf(target) }))
			}
			setTarget(null)
			await load()
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'auth.errors.generic'))
		} finally {
			setIsBusy(false)
		}
	}

	return (
		<>
			<ul className='st-card st-devices' aria-busy={!sessions && !failed}>
				{!sessions && !failed && [0, 1].map((index) => (
					<li key={index} className='st-row'>
						<span className='st-row__lead'>
							<Skeleton width={32} height={32} radius={8} />
							<span className='st-row__text'><Skeleton width={160} height={14} /><Skeleton width={220} height={12} /></span>
						</span>
					</li>
				))}
				{failed && !sessions && (
					<li className='st-row'>
						<span className='st-row__text'><span className='st-row__description'>{t('settings.sessions.loadError')}</span></span>
						<span className='st-row__control'><Button variant='secondary' size='sm' onClick={load}>{t('common.retry')}</Button></span>
					</li>
				)}
				{sessions?.map((session) => {
					const Icon = ICONS[session.type] || MonitorSmartphone
					return (
						<li key={session.id} className='st-row st-device' data-current={session.current || undefined}>
							<span className='st-row__lead'>
								<span className='st-row__icon' aria-hidden='true'><Icon size={16} /></span>
								<span className='st-row__text'>
									<span className='st-row__title'>
										<span data-i18n-ignore>{nameOf(session)}</span>
										{session.current && <Badge tone='success'>{t('settings.sessions.thisDevice')}</Badge>}
									</span>
									<span className='st-row__description st-device__details'>
										{detailsOf(session).map((part, index) => <span key={index} data-i18n-ignore={index === 2 || undefined}>{part}</span>)}
									</span>
								</span>
							</span>
							{!session.current && (
								<span className='st-row__control'>
									<Button variant='ghost' size='sm' className='st-ghost-danger' icon={LogOut} aria-label={t('settings.sessions.signOutLabel', { device: nameOf(session) })} onClick={() => setTarget(session)}>
										<span className='st-device__signout'>{t('settings.sessions.signOut')}</span>
									</Button>
								</span>
							)}
						</li>
					)
				})}
				{sessions && !others.length && (
					<li className='st-row st-devices__note'>
						<span className='st-row__description'>{t('settings.sessions.onlyThis')}</span>
					</li>
				)}
				{others.length > 0 && (
					<li>
						<button type='button' className='st-add st-add--danger' data-action='sign-out-others' onClick={() => setTarget('others')}>
							<LogOut size={16} aria-hidden='true' />
							{t('settings.sessions.action')}
						</button>
					</li>
				)}
			</ul>
			<ConfirmDialog
				open={Boolean(target)}
				onClose={() => !isBusy && setTarget(null)}
				onConfirm={confirm}
				loading={isBusy}
				tone={target === 'others' ? 'primary' : 'danger'}
				title={target === 'others' ? t('settings.sessions.confirmTitle') : target ? t('settings.sessions.signOutTitle', { device: nameOf(target) }) : ''}
				description={target === 'others' ? t('settings.sessions.confirmText') : t('settings.sessions.signOutText')}
				confirmLabel={target === 'others' ? t('settings.sessions.confirm') : t('settings.sessions.signOut')}
			/>
		</>
	)
}

export default DevicesList
