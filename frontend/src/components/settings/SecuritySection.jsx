import { startRegistration } from '@simplewebauthn/browser'
import { Fingerprint, KeyRound, LockKeyhole, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ProviderIcon } from '../auth/AuthParts'
import DevicesList from './DevicesList'
import PasswordDialog from './PasswordDialog'
import { useI18n } from '../../i18n'
import { intlLocale, translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { useAuthStore } from '../../store/useAuthStore'
import { Badge, Button, ConfirmDialog, Field, IconButton, Input, PasswordInput } from '../../ui'

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

/** Password, linked providers, named passkeys and the devices you are signed in on. */
const SecuritySection = () => {
	const { t, language } = useI18n()
	const { authUser, checkAuth, connectSocialAccount, setSocialPassword } = useAuthStore()
	const [passwordMode, setPasswordMode] = useState(null)
	const [dialog, setDialog] = useState(null)
	const [password, setPassword] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [passkeyName, setPasskeyName] = useState('')
	const [nameError, setNameError] = useState('')
	const nameRef = useRef(null)
	const passwordRef = useRef(null)
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
		setPasskeyName(next.kind === 'renamePasskey' ? next.passkey.name || '' : '')
		setNameError('')
		setDialog(next)
	}
	const passkeyLabel = (passkey, index) => passkey.name || t('settings.passkeys.item', { number: index + 1 })
	const close = () => {
		if (!isBusy) setDialog(null)
	}
	const needsPassword = dialog && (dialog.kind === 'connect' || (dialog.kind !== 'renamePasskey' && hasPassword))
	const asksName = dialog && (dialog.kind === 'addPasskey' || dialog.kind === 'renamePasskey')

	const reauthenticate = async () => {
		await axiosInstance.post('/auth/reauthenticate', { currentPassword: password })
	}

	const failWith = (error, fallbackKey) => {
		const message = error.response?.data?.message
		if (message === REAUTH_FAILED || message === 'Current password is incorrect') setPasswordError(translateServerMessageCurrent(REAUTH_FAILED))
		else toast.error(translateServerMessageCurrent(message, fallbackKey))
	}

	// The name rides along with the device's answer; empty means "name it after where it is saved".
	const registerPasskey = async (name) => {
		const known = new Set(passkeys.map((passkey) => passkey.id))
		const { data: options } = await axiosInstance.post('/auth/passkeys/options')
		const registration = await startRegistration({ optionsJSON: options })
		await axiosInstance.post('/auth/passkeys/verify', { ...registration, passkeyName: name.trim() || undefined })
		const user = await checkAuth()
		const added = (user?.passkeys || useAuthStore.getState().authUser?.passkeys || []).find((passkey) => !known.has(passkey.id))
		toast.success(t('settings.passkeys.added', { name: added?.name || name.trim() || t('settings.passkeys.title') }))
	}

	const addPasskey = () => {
		if (supportsPasskeys) open({ kind: 'addPasskey' })
	}

	const confirm = async () => {
		if (!dialog || isBusy) return
		if (dialog.kind === 'renamePasskey' && !passkeyName.trim()) {
			setNameError(t('settings.passkeys.nameRequired'))
			return
		}
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
				if (hasPassword) await reauthenticate()
				setDialog(null)
				try {
					await registerPasskey(passkeyName)
				} catch (error) {
					toast.error(error.name === 'NotAllowedError' ? t('settings.passkeys.cancelled') : error.name === 'InvalidStateError' ? t('settings.passkeys.exists') : translateServerMessageCurrent(error.response?.data?.message, 'settings.passkeys.addError'))
				}
			} else if (dialog.kind === 'removePasskey') {
				await axiosInstance.delete(`/auth/passkeys/${encodeURIComponent(dialog.passkey.id)}`, { data: { currentPassword: password } })
				await checkAuth()
				toast.success(t('settings.passkeys.removed'))
				setDialog(null)
			} else if (dialog.kind === 'renamePasskey') {
				await axiosInstance.patch(`/auth/passkeys/${encodeURIComponent(dialog.passkey.id)}`, { name: passkeyName.trim() })
				await checkAuth()
				toast.success(t('settings.passkeys.renamed'))
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
		addPasskey: { title: t('settings.passkeys.addTitle'), text: hasPassword ? t('settings.passkeys.addTextPassword') : t('settings.passkeys.addText'), confirm: t('settings.methods.continue'), tone: 'primary' },
		renamePasskey: { title: t('settings.passkeys.renameTitle'), confirm: t('common.save'), tone: 'primary' },
		removePasskey: { title: t('settings.passkeys.removeTitle', { name: dialog.label }), text: t('settings.passkeys.removeText'), confirm: t('settings.passkeys.remove'), tone: 'danger' },
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
				{passkeys.map((passkey, index) => {
					const label = passkeyLabel(passkey, index)
					return (
						<Row
							key={passkey.id}
							className='st-passkey'
							icon={<Fingerprint size={16} />}
							title={<span data-i18n-ignore>{label}</span>}
							description={(
								<span className='st-passkey__details'>
									{passkey.provider && passkey.provider !== label && <span data-i18n-ignore>{passkey.provider}</span>}
									{passkey.createdAt && <span>{t('settings.passkeys.addedOn', { date: formatDate(passkey.createdAt) })}</span>}
									<span>{passkey.lastUsedAt ? t('settings.passkeys.usedOn', { date: formatDate(passkey.lastUsedAt) }) : t('settings.passkeys.neverUsed')}</span>
								</span>
							)}
						>
							<span className='st-row__actions'>
								<IconButton icon={Pencil} size='sm' label={t('settings.passkeys.renameLabel', { name: label })} onClick={() => open({ kind: 'renamePasskey', passkey })} />
								<IconButton icon={Trash2} size='sm' label={t('settings.passkeys.removeLabel', { name: label })} onClick={() => open({ kind: 'removePasskey', passkey, label })} />
							</span>
						</Row>
					)
				})}
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

			<h3 className='st-subtitle'>{t('settings.sessions.title')}</h3>
			<p className='st-section__text st-devices__intro'>{t('settings.sessions.text')}</p>
			<DevicesList />

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
				initialFocusRef={asksName ? nameRef : needsPassword ? passwordRef : undefined}
			>
				{(needsPassword || asksName) && (
					<form className='st-dialog' onSubmit={(event) => { event.preventDefault(); confirm() }}>
						{asksName && (
							<Field label={t('settings.passkeys.name')} hint={dialog.kind === 'addPasskey' ? t('settings.passkeys.nameHint') : undefined} error={nameError}>
								<Input
									ref={nameRef}
									id='st-passkey-name'
									value={passkeyName}
									onChange={(event) => {
										setPasskeyName(event.target.value)
										setNameError('')
									}}
									placeholder={t('settings.passkeys.namePlaceholder')}
									maxLength={60}
									autoComplete='off'
								/>
							</Field>
						)}
						{needsPassword && (
						<Field label={t('settings.password.current')} error={passwordError}>
							<PasswordInput
								value={password}
								onChange={(event) => {
									setPassword(event.target.value)
									setPasswordError('')
								}}
								ref={passwordRef}
								id='st-confirm-password'
								autoComplete='current-password'
							/>
						</Field>
						)}
					</form>
				)}
			</ConfirmDialog>
		</>
	)
}

export default SecuritySection
