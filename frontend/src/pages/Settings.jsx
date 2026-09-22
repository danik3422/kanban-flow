import {
	ArrowLeft,
	Bell,
	Clock3,
	Languages,
	KeyRound,
	LockKeyhole,
	Mail,
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
	const { authUser, checkAuth, connectSocialAccount } = useAuthStore()
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
	const isLocalAccount = authUser?.provider === 'local'
	const connectedProvider = authUser?.provider
	const linkedProviders = authUser?.linkedProviders || []
	const hasPasskey = Boolean(authUser?.passkeyEnabled)
	const passkeys = authUser?.passkeys || []
	const activeLanguage = authUser?.language || document.documentElement.lang || 'en'
	const t = translations[activeLanguage] || translations.en
	const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings)

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
		return (
			<div className={`security-provider-row ${isConnected ? 'is-connected' : !canConnect ? 'is-disabled' : ''}`}>
				<div>
					<strong>{label}</strong>
					<p>{isConnected ? `This account uses ${label} sign-in.` : `Use ${label} sign-in with the same account.`}</p>
				</div>
				<button
					type='button'
					className='quiet-button security-provider-button'
					onClick={() => connectSocialAccount(provider)}
					disabled={isConnected || !canConnect}
				>
					{isConnected ? `${label} connected` : canConnect ? `Connect ${label}` : 'Not connected'}
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
							<ChangePasswordPanel />
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
							<SettingToggle
								checked={settings.weeklyDigest}
								onChange={(event) =>
									updateSetting('weeklyDigest', event.target.checked)
								}
								title='Weekly digest'
								description='Get a summary of progress and pending work each week.'
							/>
						</div>
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
