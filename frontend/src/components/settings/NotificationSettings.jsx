import { Bell, BellRing, Clock3, Info, MailX, Monitor, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../i18n'
import { translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { isDevAuthBypass } from '../../lib/devMode'
import { useAuthStore } from '../../store/useAuthStore'
import { Alert, Button, Checkbox, RadioCards, Switch } from '../../ui'
import { desktopEnabled, desktopPermission, requestDesktopPermission, setDesktopEnabled, showDesktopNotification } from '../../utils/desktopNotifications'

const PREFS = ['comments', 'dueDates', 'removed', 'cardsCreated', 'cardsMoved']
const FREQUENCY_ICONS = { never: MailX, periodic: Clock3, instant: Zap }

const frequencyOf = (user) => user?.emailFrequency || (user?.emailNotifications === false ? 'never' : 'instant')

/** "Select all" that shows a dash when only some are picked. */
const SelectAll = ({ checked, indeterminate, ...props }) => {
	const ref = useRef(null)
	useEffect(() => {
		if (ref.current) ref.current.indeterminate = indeterminate
	}, [indeterminate])
	return <Checkbox ref={ref} checked={checked} {...props} />
}

/**
 * Notifications: the bell and desktop pop-ups (this device), then email: how often,
 * and which kinds of board activity. Each change saves at once.
 */
const NotificationSettings = () => {
	const { t } = useI18n()
	const authUser = useAuthStore((state) => state.authUser)
	const [saving, setSaving] = useState(false)
	const [permission, setPermission] = useState(desktopPermission)
	const [desktopOn, setDesktopOn] = useState(desktopEnabled)

	const frequency = frequencyOf(authUser)
	const prefs = { comments: true, dueDates: true, removed: true, cardsCreated: true, cardsMoved: true, ...authUser?.emailPreferences }
	const picked = PREFS.filter((key) => prefs[key] !== false)
	const emailOff = frequency === 'never'

	// Optimistic: the switch moves now and steps back if saving fails.
	const save = async (patch, local = patch) => {
		const previous = useAuthStore.getState().authUser
		useAuthStore.setState((state) => ({ authUser: { ...state.authUser, ...local } }))
		if (isDevAuthBypass) return
		setSaving(true)
		try {
			await axiosInstance.patch('/auth/settings', patch)
			toast.success(t('settings.notify.saved'), { id: 'notify-saved' })
		} catch (error) {
			useAuthStore.setState({ authUser: previous })
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'settings.notify.saveError'))
		} finally {
			setSaving(false)
		}
	}
	const savePrefs = (next) => save({ emailPreferences: next }, { emailPreferences: { ...prefs, ...next } })

	const allowDesktop = async () => {
		const result = await requestDesktopPermission()
		setPermission(result)
		setDesktopOn(desktopEnabled())
		if (result === 'denied') toast.error(t('settings.notify.desktopDenied'))
	}
	const toggleDesktop = (on) => {
		setDesktopEnabled(on)
		setDesktopOn(on)
	}
	const sendTest = () => showDesktopNotification({ title: t('settings.notify.desktopTestTitle'), body: t('settings.notify.desktopTestBody'), tag: 'kh-test', force: true })

	return (
		<>
			<h3 className='st-subtitle st-subtitle--first'>{t('settings.notify.appTitle')}</h3>
			<div className='st-card'>
				<div className='st-row'>
					<span className='st-row__lead'>
						<span className='st-row__icon' aria-hidden='true'><Bell size={16} /></span>
						<Switch
							className='st-row__switch'
							label={t('settings.notify.bellTitle')}
							description={t('settings.notify.bellText')}
							checked={authUser?.taskNotifications !== false}
							disabled={saving}
							onChange={(event) => save({ taskNotifications: event.target.checked })}
						/>
					</span>
				</div>
				<div className='st-row st-desktop' data-permission={permission}>
					<span className='st-row__lead'>
						<span className='st-row__icon' aria-hidden='true'><Monitor size={16} /></span>
						{permission === 'granted' ? (
							<Switch
								className='st-row__switch'
								label={t('settings.notify.desktopTitle')}
								description={t('settings.notify.desktopText')}
								checked={desktopOn}
								onChange={(event) => toggleDesktop(event.target.checked)}
							/>
						) : (
							<span className='st-row__text'>
								<span className='st-row__title'>{t('settings.notify.desktopTitle')}</span>
								<span className='st-row__description'>
									{permission === 'denied' ? t('settings.notify.desktopBlocked') : permission === 'unsupported' ? t('settings.notify.desktopUnsupported') : t('settings.notify.desktopText')}
								</span>
							</span>
						)}
					</span>
					{permission === 'default' && (
						<span className='st-row__control'><Button variant='secondary' size='sm' icon={BellRing} onClick={allowDesktop}>{t('settings.notify.desktopAllow')}</Button></span>
					)}
					{permission === 'granted' && desktopOn && (
						<span className='st-row__control'><Button variant='ghost' size='sm' onClick={sendTest}>{t('settings.notify.desktopTest')}</Button></span>
					)}
				</div>
			</div>

			<h3 className='st-subtitle'>{t('settings.notify.emailTitle')}</h3>
			<p className='st-section__text'>{t('settings.notify.emailText', { email: authUser?.email || '' })}</p>
			<RadioCards
				className='st-frequency'
				legend={t('settings.notify.frequency')}
				name='email-frequency'
				value={frequency}
				onChange={(value) => save({ emailFrequency: value }, { emailFrequency: value, emailNotifications: value !== 'never' })}
				options={['never', 'periodic', 'instant'].map((value) => ({
					value,
					icon: FREQUENCY_ICONS[value],
					label: t(`settings.notify.frequencyOptions.${value}`),
					description: t(`settings.notify.frequencyTexts.${value}`),
				}))}
			/>

			<div className='st-prefs-head'>
				<span className='st-row__title'>{t('settings.notify.prefsTitle')}</span>
				<span className='st-row__description'>{t('settings.notify.prefsText')}</span>
			</div>
			{emailOff ? (
				<Alert icon={Info} className='st-prefs-off'>{t('settings.notify.off')}</Alert>
			) : (
				<div className='st-card st-prefs' role='group' aria-label={t('settings.notify.prefsTitle')}>
					<div className='st-pref st-pref--all'>
						<SelectAll
							checked={picked.length === PREFS.length}
							indeterminate={picked.length > 0 && picked.length < PREFS.length}
							disabled={saving}
							label={<span className='st-pref__title'>{t('settings.notify.selectAll')}</span>}
							onChange={(event) => savePrefs(Object.fromEntries(PREFS.map((key) => [key, event.target.checked])))}
						/>
					</div>
					{PREFS.map((key) => (
						<div className='st-pref' key={key}>
							<Checkbox
								checked={prefs[key] !== false}
								disabled={saving}
								data-pref={key}
								onChange={(event) => savePrefs({ [key]: event.target.checked })}
								label={(
									<span className='st-pref__text'>
										<span className='st-pref__title'>{t(`settings.notify.prefs.${key}`)}</span>
										<span className='st-pref__description'>{t(`settings.notify.prefTexts.${key}`)}</span>
									</span>
								)}
							/>
						</div>
					))}
				</div>
			)}
			<p className='st-prefs-always'>{t('settings.notify.always')}</p>
		</>
	)
}

export default NotificationSettings
