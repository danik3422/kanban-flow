import {
	ArrowLeft,
	Bell,
	ClipboardList,
	Clock3,
	Languages,
	KeyRound,
	LockKeyhole,
	Mail,
	MessageCircle,
	Palette,
	ShieldCheck,
	Smartphone,
	Trash2,
	X,
} from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import ChangePasswordPanel from '../components/ChangePasswordPanel'
import ThemeSelector from '../components/ThemeSelector'
import { axiosInstance } from '../lib/axios'
import { isDevAuthBypass } from '../lib/devMode'
import { translations } from '../lib/translations'
import { useAuthStore } from '../store/useAuthStore'
import { applyTheme } from '../utils/theme'

const SettingToggle = ({ checked, title, description, onChange, disabled = false }) => (
	<label className={`settings-toggle-row ${disabled ? 'is-disabled' : ''}`}>
		<span>
			<strong>{title}</strong>
			<small>{description}</small>
		</span>
		<input type='checkbox' checked={checked} onChange={onChange} disabled={disabled} />
		<span className='settings-switch' />
	</label>
)

const getInitialSettings = (authUser) => {
	const savedSettings = isDevAuthBypass
		? localStorage.getItem('kanban-dev-settings')
		: null
	let parsedSettings = {}
	try {
		parsedSettings = savedSettings ? JSON.parse(savedSettings) : {}
	} catch {
		localStorage.removeItem('kanban-dev-settings')
	}
	return {
		emailNotifications:
			parsedSettings.emailNotifications ?? authUser?.emailNotifications ?? true,
		taskNotifications:
			parsedSettings.taskNotifications ?? authUser?.taskNotifications ?? true,
		weeklyDigest:
			parsedSettings.weeklyDigest ?? authUser?.weeklyDigest ?? false,
		language: parsedSettings.language || authUser?.language || 'en',
	}
}

const Settings = () => {
	const { authUser, checkAuth, connectSocialAccount, completeSocialRedirect, setSocialPassword } = useAuthStore()
	const [settings, setSettings] = useState(() => getInitialSettings(authUser))
	const [savedSettings, setSavedSettings] = useState(() => getInitialSettings(authUser))
	const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system')
	const [isSaving, setIsSaving] = useState(false)
	const [activeSection, setActiveSection] = useState(() => {
		const hash = window.location.hash.replace('#', '')
		return ['appearance', 'security', 'notifications', 'language'].includes(hash) ? hash : 'appearance'
	})
	const [isPasskeySaving, setIsPasskeySaving] = useState(false)
	const [isPasskeyManagerOpen, setIsPasskeyManagerOpen] = useState(false)
	const [passkeyToRemove, setPasskeyToRemove] = useState(null)
	const [passkeyRemovePassword, setPasskeyRemovePassword] = useState('')
	const [providerToConnect, setProviderToConnect] = useState(null)
	const [providerToDisconnect, setProviderToDisconnect] = useState(null)
	const [providerPassword, setProviderPassword] = useState('')
	const [providerPasswordVisible, setProviderPasswordVisible] = useState(false)
	const [isProviderConnecting, setIsProviderConnecting] = useState(false)
	const isLocalAccount = authUser?.provider === 'local'
	const connectedProvider = authUser?.provider
	const linkedProviders = authUser?.linkedProviders || []
	const hasPasskey = Boolean(authUser?.passkeyEnabled)
	const isSocialPasswordlessAccount = Boolean(authUser && authUser.provider !== 'local' && !authUser.hasPassword)
	const passkeys = authUser?.passkeys || []
	const requiresProviderPassword = isLocalAccount || Boolean(authUser?.hasPassword)
	const activeLanguage = authUser?.language || document.documentElement.lang || 'en'
	const t = translations[activeLanguage] || translations.en
	const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings)

	useEffect(() => {
		if (!authUser || !sessionStorage.getItem('pending-social-provider')) return
		completeSocialRedirect().then((result) => {
			if (result.success) checkAuth()
		})
	}, [authUser, checkAuth, completeSocialRedirect])

	useEffect(() => {
		localStorage.setItem('theme', theme)
		applyTheme(theme)
	}, [theme])

	const updateSetting = (key, value) =>
		{
			setSettings((current) => ({ ...current, [key]: value }))
		}
	const saveSettings = async () => {
		if (!hasChanges || isSaving) return
		setIsSaving(true)
		try {
		const changedSettings = Object.fromEntries(
			Object.entries(settings).filter(([key, value]) => value !== savedSettings[key]),
		)
			const nextSettings = { ...settings }
			if (isDevAuthBypass) {
				localStorage.setItem('kanban-dev-settings', JSON.stringify(nextSettings))
			} else {
				if (Object.keys(changedSettings).length) {
					await axiosInstance.patch('/auth/settings', changedSettings)
				}
				await checkAuth()
			}
			document.documentElement.lang = nextSettings.language || activeLanguage
			setSavedSettings(nextSettings)
			toast.success('Settings saved')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not save settings')
		} finally {
			setIsSaving(false)
		}
	}
	const requestProviderConnection = (provider) => {
		setProviderToConnect(provider)
		setProviderPassword('')
		setProviderPasswordVisible(false)
	}
	const connectProvider = async () => {
		if (!providerToConnect || !providerPassword) return
		setIsProviderConnecting(true)
		try {
			await axiosInstance.post('/auth/reauthenticate', { currentPassword: providerPassword })
			const result = await connectSocialAccount(providerToConnect, providerPassword)
			if (result.redirecting) return
			if (result.success) {
				setProviderToConnect(null)
				setProviderPassword('')
				await checkAuth()
			}
		} catch (error) {
			toast.error(error.response?.data?.message || 'Current password is incorrect')
		} finally {
			setIsProviderConnecting(false)
		}
	}
	const requestProviderDisconnect = (provider) => {
		setProviderToDisconnect(provider)
		setProviderPassword('')
		setProviderPasswordVisible(false)
	}
	const disconnectProvider = async () => {
		if (!providerToDisconnect || (requiresProviderPassword && !providerPassword)) return
		setIsProviderConnecting(true)
		try {
			await axiosInstance.delete(`/auth/social/${providerToDisconnect}`, { data: { currentPassword: providerPassword } })
			await checkAuth()
			setProviderToDisconnect(null)
			setProviderPassword('')
			toast.success('Provider disconnected')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not disconnect provider')
		} finally {
			setIsProviderConnecting(false)
		}
	}
	const addPasskey = async () => {
		if (!window.PublicKeyCredential) {
			toast.error('Passkeys are not supported in this browser')
			return
		}
		setIsPasskeySaving(true)
		try {
			const { data: options } = await axiosInstance.post('/auth/passkeys/options')
			const registration = await startRegistration({ optionsJSON: options })
			await axiosInstance.post('/auth/passkeys/verify', registration)
			await checkAuth()
			toast.success('Passkey added')
		} catch (error) {
			if (error.name === 'NotAllowedError') {
				toast.error('Passkey setup was cancelled')
			} else {
				toast.error(error.response?.data?.message || 'Could not add passkey')
			}
		} finally {
			setIsPasskeySaving(false)
		}
	}
	const requestRemovePasskey = (passkey) => {
		setPasskeyRemovePassword('')
		setPasskeyToRemove(passkey)
	}
	const removePasskey = async () => {
		if (!passkeyToRemove) return
		setIsPasskeySaving(true)
		try {
			await axiosInstance.delete(`/auth/passkeys/${encodeURIComponent(passkeyToRemove.id)}`, { data: { currentPassword: passkeyRemovePassword } })
			await checkAuth()
			setPasskeyToRemove(null)
			toast.success('Passkey removed')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not remove passkey')
		} finally {
			setIsPasskeySaving(false)
		}
	}
	const renderSocialProvider = (provider, label) => {
		const isConnected = connectedProvider === provider || linkedProviders.some((link) => link.provider === provider)
		const canConnect = isLocalAccount
		const isPrimaryProvider = connectedProvider === provider
		const canDisconnect = !isPrimaryProvider || Boolean(authUser?.hasPassword || hasPasskey || linkedProviders.length)
		return (
			<div className={`security-provider-row ${isConnected ? 'is-connected' : !canConnect ? 'is-disabled' : ''}`}>
				<div>
					<strong>{label}</strong>
					<p>{isConnected ? canDisconnect ? `This account uses ${label} sign-in.` : `Add another sign-in method before disconnecting ${label}.` : `Use ${label} sign-in with the same account.`}</p>
				</div>
				<button
					type='button'
					className='quiet-button security-provider-button'
					onClick={() => isConnected ? requestProviderDisconnect(provider) : requestProviderConnection(provider)}
					disabled={isConnected ? !canDisconnect : !canConnect}
				>
					{isConnected ? canDisconnect ? 'Disconnect' : 'Required' : canConnect ? `Connect ${label}` : 'Not connected'}
				</button>
			</div>
		)
	}

	return (
		<main className='account-page'>
			<div className='account-page-header'>
				<Link to='/workspaces' className='account-back-link'>
					<ArrowLeft size={15} /> Back to workspace
				</Link>
				<p className='eyebrow'>{t.settings.account}</p>
				<h1>{t.settings.title}</h1>
				<p>{t.settings.description}</p>
			</div>
			<nav className='settings-menu' aria-label='Settings sections'>
				{[['appearance', Palette, 'Appearance'], ['security', ShieldCheck, 'Security'], ['notifications', Bell, 'Notifications'], ['language', Languages, 'Language']].map(([section, Icon, label]) => (
					<a key={section} className={activeSection === section ? 'is-active' : ''} href={`#${section}`} onClick={(event) => { event.preventDefault(); setActiveSection(section); window.history.replaceState(null, '', `#${section}`) }}><Icon size={15} /> {label}</a>
				))}
			</nav>
			<div className='settings-grid settings-grid--single' data-active={activeSection}>
				<div className='settings-column settings-column--left'>
					<section id='appearance' className='account-page-card settings-card settings-card--appearance'>
						<div className='settings-card-heading'>
							<span className='settings-icon'>
								<Palette size={18} />
							</span>
							<div>
								<h2>{t.settings.appearance}</h2>
								<p>Choose a theme that feels right for your workspace.</p>
							</div>
						</div>
						<div className='settings-development'>
							<Clock3 size={18} />
							<div>
								<strong>Appearance settings are active</strong>
								<p>Choose a theme for this browser and keep your workspace comfortable.</p>
							</div>
						</div>
						<ThemeSelector selected={theme} onChange={setTheme} />
					</section>
					<section id='security' className='account-page-card settings-card settings-card--security security-settings-card'>
						<div className='settings-card-heading security-card-head'>
							<span className='settings-icon'>
								<ShieldCheck size={18} />
							</span>
							<div>
								<h2>{t.settings.security}</h2>
								<p>Keep your account and workspace protected.</p>
							</div>
						</div>
						<div className='security-row security-password-row'>
							<ChangePasswordPanel isAddPassword={isSocialPasswordlessAccount} onSetSocialPassword={setSocialPassword} />
						</div>
						<div className='security-provider-list'>
							<div className='security-provider-header'>
								<strong>Connected sign-in methods</strong>
							</div>
							{renderSocialProvider('google', 'Google')}
							{renderSocialProvider('microsoft', 'Microsoft')}
							{renderSocialProvider('apple', 'Apple')}
						</div>
						<div className='security-provider-list'>
							<div className='security-provider-header'>
									<strong>Passkey</strong>
							</div>
							<div className='security-provider-row'>
								<div>
									<strong>{hasPasskey ? 'Passkey enabled' : 'Use a passkey'}</strong>
									<p>{hasPasskey ? `${passkeys.length} device credential${passkeys.length === 1 ? '' : 's'} connected.` : 'Sign in with Face ID, Touch ID, or a device-based credential.'}</p>
								</div>
								<button type='button' className='quiet-button security-provider-button' onClick={() => setIsPasskeyManagerOpen(true)}>
									<KeyRound size={14} /> Manage passkeys
								</button>
							</div>
						</div>
					</section>
				</div>
				<div className='settings-column settings-column--right'>
					<section id='notifications' className='account-page-card settings-card settings-card--notifications'>
						<div className='settings-card-heading'>
							<span className='settings-icon'>
								<Bell size={18} />
							</span>
							<div>
								<h2>{t.settings.notifications}</h2>
								<p>Choose what deserves your attention.</p>
							</div>
						</div>
						<div className='settings-toggle-list'>
							<SettingToggle
								checked={settings.emailNotifications}
								onChange={(event) =>
									updateSetting('emailNotifications', event.target.checked)
								}
								title='Email notifications'
								description='Receive account and workspace updates by email.'
							/>
							<SettingToggle
								checked={settings.taskNotifications}
								onChange={(event) =>
									updateSetting('taskNotifications', event.target.checked)
								}
								title='Task activity'
								description='Keep a pulse on task changes, comments, and assignments.'
							/>
						</div>
						{(settings.emailNotifications || settings.taskNotifications) && <div className='notification-preview'>
							<div className='notification-preview-heading'><span><Bell size={14} /> Preview</span><small>Examples of what you will receive</small></div>
							{settings.taskNotifications && <div className='notification-preview-item'><span className='notification-preview-icon'><ClipboardList size={15} /></span><div><strong>You were assigned a task</strong><small>Alex assigned “Review launch brief” to you.</small></div><em>now</em></div>}
							{settings.taskNotifications && <div className='notification-preview-item'><span className='notification-preview-icon'><MessageCircle size={15} /></span><div><strong>New task update</strong><small>Someone commented on “Review launch brief”.</small></div><em>2m</em></div>}
							{settings.emailNotifications && <div className='notification-preview-item'><span className='notification-preview-icon'><Mail size={15} /></span><div><strong>Workspace activity email</strong><small>You have new updates waiting in your workspace.</small></div><em>email</em></div>}
						</div>}
					</section>
					<section id='language' className='account-page-card settings-card settings-card--language'>
						<div className='settings-card-heading'>
							<span className='settings-icon'>
								<Languages size={18} />
							</span>
							<div>
								<h2>{t.settings.language}</h2>
								<p>Choose the language for future interface translations.</p>
							</div>
						</div>
						<div className='settings-language-options'>
							<button
								className={settings.language === 'en' ? 'active' : ''}
								onClick={() => updateSetting('language', 'en')}
							>
								<span>EN</span>English
							</button>
							<button
								className={settings.language === 'uk' ? 'active' : ''}
								onClick={() => updateSetting('language', 'uk')}
							>
								<span>UK</span>Українська
							</button>
							<button
								className={settings.language === 'ru' ? 'active' : ''}
								onClick={() => updateSetting('language', 'ru')}
							>
								<span>RU</span>Русский
							</button>
						</div>
					</section>
				</div>
			</div>
			{isPasskeyManagerOpen && <div className='passkey-manager-backdrop' role='presentation' onMouseDown={() => setIsPasskeyManagerOpen(false)}>
				<section className='passkey-manager' role='dialog' aria-modal='true' aria-labelledby='passkey-manager-title' onMouseDown={(event) => event.stopPropagation()}>
					<div className='passkey-manager-header'><div><p className='eyebrow'>Security</p><h2 id='passkey-manager-title'>Manage passkeys</h2><p>Use a device credential for faster, safer sign-in.</p></div><button type='button' className='icon-button' onClick={() => setIsPasskeyManagerOpen(false)} aria-label='Close passkey manager' title='Close'><X size={17} /></button></div>
					<div className='passkey-manager-list'>{passkeys.length ? passkeys.map((passkey, index) => <div className='passkey-manager-row' key={passkey.id}><div className='passkey-manager-icon'><KeyRound size={17} /></div><div><strong>Passkey {index + 1}</strong><small>Added {passkey.createdAt ? new Date(passkey.createdAt).toLocaleDateString() : 'recently'}</small></div><button type='button' className='passkey-remove-button' onClick={() => requestRemovePasskey(passkey)} disabled={isPasskeySaving}><Trash2 size={14} /> Remove</button></div>) : <div className='passkey-manager-empty'><KeyRound size={20} /><p>No passkeys connected yet.</p></div>}</div>
					<button type='button' className='primary-button passkey-manager-add' onClick={addPasskey} disabled={isPasskeySaving}><KeyRound size={16} /> {isPasskeySaving ? 'Adding...' : 'Add new passkey'}</button>
				</section>
			</div>}
			{passkeyToRemove && <div className='passkey-confirm-backdrop' role='presentation' onMouseDown={() => setPasskeyToRemove(null)}>
				<section className='passkey-confirm-modal' role='dialog' aria-modal='true' aria-labelledby='passkey-confirm-title' onMouseDown={(event) => event.stopPropagation()}>
					<div className='passkey-confirm-icon'><Trash2 size={19} /></div>
					<p className='eyebrow'>Revoke access</p>
					<h2 id='passkey-confirm-title'>Remove this passkey?</h2>
					<p>This device will no longer be able to sign in with this credential.</p>
					{authUser?.hasPassword && <label className='passkey-confirm-field'><span><LockKeyhole size={14} /> Current password</span><input type='password' value={passkeyRemovePassword} onChange={(event) => setPasskeyRemovePassword(event.target.value)} autoFocus placeholder='Enter your password' /></label>}
					<div className='passkey-confirm-actions'><button type='button' className='quiet-button' onClick={() => setPasskeyToRemove(null)}>Cancel</button><button type='button' className='passkey-confirm-danger' onClick={removePasskey} disabled={isPasskeySaving || (authUser?.hasPassword && !passkeyRemovePassword)}>{isPasskeySaving ? 'Removing...' : 'Remove passkey'}</button></div>
				</section>
			</div>}
			{(providerToConnect || providerToDisconnect) && <div className='passkey-confirm-backdrop provider-connect-backdrop' role='presentation' onMouseDown={() => { setProviderToConnect(null); setProviderToDisconnect(null) }}>
				<section className='passkey-confirm-modal provider-connect-modal' role='dialog' aria-modal='true' aria-labelledby='provider-connect-title' onMouseDown={(event) => event.stopPropagation()}>
					<div className='passkey-confirm-icon'><ShieldCheck size={19} /></div>
					<p className='eyebrow'>{providerToDisconnect ? 'Disconnect provider' : 'Re-authentication'}</p>
					<h2 id='provider-connect-title'>{providerToDisconnect ? 'Disconnect' : 'Connect'} {(providerToDisconnect || providerToConnect)[0].toUpperCase() + (providerToDisconnect || providerToConnect).slice(1)}</h2>
					<p>{providerToDisconnect ? 'This sign-in method will be removed from your account.' : 'Confirm your current password before linking this sign-in method.'}</p>
					{(providerToConnect || requiresProviderPassword) && <label className='passkey-confirm-field'><span><LockKeyhole size={14} /> Current password</span><div className='provider-password-input'><input type={providerPasswordVisible ? 'text' : 'password'} value={providerPassword} onChange={(event) => setProviderPassword(event.target.value)} autoFocus autoComplete='current-password' placeholder='Enter your password' /><button type='button' onClick={() => setProviderPasswordVisible((value) => !value)} aria-label={providerPasswordVisible ? 'Hide password' : 'Show password'}>{providerPasswordVisible ? 'Hide' : 'Show'}</button></div></label>}
					<div className='passkey-confirm-actions'><button type='button' className='quiet-button' onClick={() => { setProviderToConnect(null); setProviderToDisconnect(null) }}>Cancel</button><button type='button' className={providerToDisconnect ? 'passkey-confirm-danger' : 'primary-button'} onClick={providerToDisconnect ? disconnectProvider : connectProvider} disabled={isProviderConnecting || (requiresProviderPassword && !providerPassword)}>{isProviderConnecting ? providerToDisconnect ? 'Disconnecting...' : 'Connecting...' : providerToDisconnect ? 'Disconnect' : 'Continue'}</button></div>
				</section>
			</div>}
			{['notifications', 'language'].includes(activeSection) && <div className='settings-save-bar'>
				<span>
					<Mail size={15} /> {hasChanges ? 'Unsaved changes' : t.settings.changes}
				</span>
				<button
					type='button'
					className='primary-button'
					onClick={(event) => {
						event.preventDefault()
						saveSettings()
					}}
					disabled={isSaving || !hasChanges}
				>
					{isSaving ? 'Saving...' : t.settings.save}
				</button>
			</div>}
		</main>
	)
}

export default Settings
