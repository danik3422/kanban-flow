import { startRegistration } from '@simplewebauthn/browser'
import { Fingerprint, KeyRound, LockKeyhole, MonitorSmartphone, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ProviderIcon } from '../auth/AuthParts'
import PasswordDialog from './PasswordDialog'
import { useI18n } from '../../i18n'
import { intlLocale, translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { useAuthStore } from '../../store/useAuthStore'
import { Badge, Button, ConfirmDialog, Field, IconButton, PasswordInput } from '../../ui'

const PROVIDERS = ['google', 'microsoft', 'apple']
const PROVIDER_LABELS = { google: 'Google', microsoft: 'Microsoft', apple: 'Apple', local: 'Email' }
const REAUTH_FAILED = 'Re-authentication failed.'

const Row = ({ icon, title, description, children, className }) => (
	<li className={['st-row', className].filter(Boolean).join(' ')}>
		<span className='st-row__lead'>
			{icon && <span className='st-row__icon' aria-hidden='true'>{icon}</span>}
			<span className='st-row__text'>
				<span className='st-row__title'>{title}</span>
				{description && <span className='st-row__description'>{description}</span>}
			</span>
		</span>
		{children && <span className='st-row__control'>{children}</span>}
	</li>
)

/** Password, linked providers, passkeys and ending other sessions. */
const SecuritySection = () => {
	const { t, language } = useI18n()
	const { authUser, checkAuth, connectSocialAccount, setSocialPassword } = useAuthStore()
	const [passwordMode, setPasswordMode] = useState(null)
	const [dialog, setDialog] = useState(null)
	const [password, setPassword] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [isBusy, setIsBusy] = useState(false)

	const primary = authUser?.provider || 'local'
	const isLocalAccount = primary === 'local'
	const hasPassword = Boolean(authUser?.hasPassword) || isLocalAccount
	const linked = authUser?.linkedProviders || []
	const passkeys = authUser?.passkeys || []
	const hasPasskey = Boolean(authUser?.passkeyEnabled) || passkeys.length > 0
	const supportsPasskeys = typeof window !== 'undefined' && Boolean(window.PublicKeyCredential)
	const formatDate = (value) => new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))

	const open = (next) => {
		setPassword('')
		setPasswordError('')
		setDialog(next)
	}
	const close = () => {
		if (!isBusy) setDialog(null)
	}
	const needsPassword = dialog && (dialog.kind === 'connect' || (dialog.kind !== 'signOutOthers' && hasPassword))

	const reauthenticate = async () => {
		await axiosInstance.post('/auth/reauthenticate', { currentPassword: password })
	}

	const failWith = (error, fallbackKey) => {
		const message = error.response?.data?.message
		if (message === REAUTH_FAILED || message === 'Current password is incorrect') setPasswordError(translateServerMessageCurrent(REAUTH_FAILED))
		else toast.error(translateServerMessageCurrent(message, fallbackKey))
	}

	const registerPasskey = async () => {
		const { data: options } = await axiosInstance.post('/auth/passkeys/options')
		const registration = await startRegistration({ optionsJSON: options })
		await axiosInstance.post('/auth/passkeys/verify', registration)
		await checkAuth()
		toast.success(t('settings.passkeys.added'))
	}

	const addPasskey = async () => {
		if (!supportsPasskeys) return
		if (hasPassword) {
			open({ kind: 'addPasskey' })
			return
		}
		setIsBusy(true)
		try {
			await registerPasskey()
		} catch (error) {
			toast.error(error.name === 'NotAllowedError' ? t('settings.passkeys.cancelled') : translateServerMessageCurrent(error.response?.data?.message, 'settings.passkeys.addError'))
		} finally {
			setIsBusy(false)
		}
	}

	const confirm = async () => {
		if (!dialog || isBusy) return
		if (needsPassword && !password) {
			setPasswordError(t('settings.password.currentRequired'))
			return
		}
		setIsBusy(true)
		try {
			if (dialog.kind === 'connect') {
				await reauthenticate()
				const result = await connectSocialAccount(dialog.provider, password)
				if (result.redirecting) return
				if (result.success) {
					await checkAuth()
					setDialog(null)
				}
			} else if (dialog.kind === 'disconnect') {
				await axiosInstance.delete(`/auth/social/${dialog.provider}`, { data: { currentPassword: password } })
				await checkAuth()
				toast.success(t('settings.methods.disconnected', { provider: PROVIDER_LABELS[dialog.provider] }))
				setDialog(null)
			} else if (dialog.kind === 'addPasskey') {
				await reauthenticate()
				setDialog(null)
				try {
					await registerPasskey()
				} catch (error) {
					toast.error(error.name === 'NotAllowedError' ? t('settings.passkeys.cancelled') : translateServerMessageCurrent(error.response?.data?.message, 'settings.passkeys.addError'))
				}
			} else if (dialog.kind === 'removePasskey') {
				await axiosInstance.delete(`/auth/passkeys/${encodeURIComponent(dialog.passkey.id)}`, { data: { currentPassword: password } })
				await checkAuth()
				toast.success(t('settings.passkeys.removed'))
				setDialog(null)
			} else if (dialog.kind === 'signOutOthers') {
				await axiosInstance.post('/auth/sessions/sign-out-others')
				toast.success(t('settings.sessions.done'))
				setDialog(null)
			}
		} catch (error) {
			failWith(error, 'auth.errors.generic')
		} finally {
			setIsBusy(false)
		}
	}

	const dialogCopy = dialog && {
		connect: { title: t('settings.methods.connectTitle', { provider: PROVIDER_LABELS[dialog.provider] }), text: t('settings.methods.connectText', { provider: PROVIDER_LABELS[dialog.provider] }), confirm: t('settings.methods.continue'), tone: 'primary' },
		disconnect: { title: t('settings.methods.disconnectTitle', { provider: PROVIDER_LABELS[dialog.provider] }), text: t('settings.methods.disconnectText', { provider: PROVIDER_LABELS[dialog.provider] }), confirm: t('settings.methods.disconnect'), tone: 'danger' },
		addPasskey: { title: t('settings.passkeys.addTitle'), text: t('settings.passkeys.addText'), confirm: t('settings.methods.continue'), tone: 'primary' },
		removePasskey: { title: t('settings.passkeys.removeTitle'), text: t('settings.passkeys.removeText'), confirm: t('settings.passkeys.remove'), tone: 'danger' },
		signOutOthers: { title: t('settings.sessions.confirmTitle'), text: t('settings.sessions.confirmText'), confirm: t('settings.sessions.confirm'), tone: 'primary' },
	}[dialog.kind]

	return (
		<>
			<ul className='st-card'>
				<Row
					className='st-row--stack'
					icon={<LockKeyhole size={16} />}
					title={t('settings.password.title')}
					description={hasPassword ? t('settings.password.isSet') : t('settings.password.notSet', { provider: PROVIDER_LABELS[primary] })}
				>
					<Button variant='secondary' size='sm' data-action='password' onClick={() => setPasswordMode(hasPassword ? 'change' : 'add')}>
						{hasPassword ? t('settings.password.change') : t('settings.password.add')}
					</Button>
				</Row>
			</ul>

			<h3 className='st-subtitle'>{t('settings.methods.title')}</h3>
			<ul className='st-card'>
				{PROVIDERS.map((provider) => {
					const isPrimary = primary === provider
					const isConnected = isPrimary || linked.some((link) => link.provider === provider)
					const canDisconnect = !isPrimary || hasPassword || hasPasskey || linked.length > 0
					const canConnect = isLocalAccount
					return (
						<Row
							key={provider}
							className={!isConnected ? 'st-row--muted' : undefined}
							icon={<ProviderIcon provider={provider} />}
							title={
								<>
									<span data-i18n-ignore>{PROVIDER_LABELS[provider]}</span>
									{isConnected && <Badge tone='success'>{t('settings.methods.connected')}</Badge>}
									{isPrimary && <Badge>{t('settings.methods.primary')}</Badge>}
								</>
							}
							description={isConnected ? (!canDisconnect ? t('settings.methods.lastMethod') : '') : t('settings.methods.notConnected')}
						>
							{isConnected && canDisconnect && (
								<Button variant='ghost' size='sm' className='st-ghost-danger' onClick={() => open({ kind: 'disconnect', provider })}>{t('settings.methods.disconnect')}</Button>
							)}
							{!isConnected && canConnect && (
								<Button variant='secondary' size='sm' onClick={() => open({ kind: 'connect', provider })}>{t('settings.methods.connect')}</Button>
							)}
						</Row>
					)
				})}
			</ul>

			<h3 className='st-subtitle'>{t('settings.passkeys.title')}</h3>
			<ul className='st-card'>
				{passkeys.map((passkey, index) => (
					<Row
						key={passkey.id}
						icon={<Fingerprint size={16} />}
						title={t('settings.passkeys.item', { number: index + 1 })}
						description={passkey.createdAt ? t('settings.passkeys.addedOn', { date: formatDate(passkey.createdAt) }) : ''}
					>
						<IconButton icon={Trash2} size='sm' label={t('settings.passkeys.removeLabel', { number: index + 1 })} onClick={() => open({ kind: 'removePasskey', passkey })} />
					</Row>
				))}
				{!passkeys.length && (
					<Row icon={<KeyRound size={16} />} title={t('settings.passkeys.none')} description={supportsPasskeys ? t('settings.passkeys.text') : t('settings.passkeys.unsupported')} />
				)}
				{supportsPasskeys && (
					<li>
						<button type='button' className='st-add' onClick={addPasskey} disabled={isBusy}>
							<Plus size={16} aria-hidden='true' />
							{t('settings.passkeys.add')}
						</button>
					</li>
				)}
			</ul>

			<ul className='st-card st-card--spaced'>
				<Row className='st-row--stack' icon={<MonitorSmartphone size={16} />} title={t('settings.sessions.title')} description={t('settings.sessions.text')}>
					<Button variant='secondary' size='sm' data-action='sign-out-others' onClick={() => open({ kind: 'signOutOthers' })}>{t('settings.sessions.action')}</Button>
				</Row>
			</ul>

			<PasswordDialog
				open={Boolean(passwordMode)}
				mode={passwordMode}
				providerLabel={PROVIDER_LABELS[primary]}
				onClose={() => setPasswordMode(null)}
				onAddPassword={async (next) => {
					const result = await setSocialPassword(next)
					if (result?.success) await checkAuth()
					return result
				}}
			/>

			<ConfirmDialog
				open={Boolean(dialog)}
				onClose={close}
				onConfirm={confirm}
				loading={isBusy}
				tone={dialogCopy?.tone}
				title={dialogCopy?.title || ''}
				description={dialogCopy?.text}
				confirmLabel={dialogCopy?.confirm}
			>
				{needsPassword && (
					<form className='st-dialog' onSubmit={(event) => { event.preventDefault(); confirm() }}>
						<Field label={t('settings.password.current')} error={passwordError}>
							<PasswordInput
								value={password}
								onChange={(event) => {
									setPassword(event.target.value)
									setPasswordError('')
								}}
								id='st-confirm-password'
								autoComplete='current-password'
								autoFocus
							/>
						</Field>
					</form>
				)}
			</ConfirmDialog>
		</>
	)
}

export default SecuritySection
