import {
	ArrowLeft,
	Bell,
	Clock3,
	Languages,
	Mail,
	Palette,
	ShieldCheck,
	Smartphone,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import ChangePasswordPanel from '../components/ChangePasswordPanel'
import { axiosInstance } from '../lib/axios'
import { isDevAuthBypass } from '../lib/devMode'
import { translations } from '../lib/translations'
import { useAuthStore } from '../store/useAuthStore'

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
	const { authUser, checkAuth, connectGoogleAccount } = useAuthStore()
	const [settings, setSettings] = useState(() => getInitialSettings(authUser))
	const [isSaving, setIsSaving] = useState(false)
	const isLocalAccount = authUser?.provider === 'local'
	const activeLanguage = authUser?.language || document.documentElement.lang || 'en'
	const t = translations[activeLanguage] || translations.en
	const updateSetting = (key, value) =>
		setSettings((current) => ({ ...current, [key]: value }))
	const saveSettings = async () => {
		setIsSaving(true)
		try {
			if (isDevAuthBypass) {
				localStorage.setItem('kanban-dev-settings', JSON.stringify(settings))
			} else {
				await axiosInstance.patch('/auth/settings', settings)
				await checkAuth()
			}
			document.documentElement.lang = settings.language || activeLanguage
			toast.success('Settings saved')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not save settings')
		} finally {
			setIsSaving(false)
		}
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
			<div className='settings-grid'>
				<div className='settings-column settings-column--left'>
					<section className='account-page-card settings-card settings-card--appearance'>
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
								<strong>Appearance settings are in development</strong>
								<p>Theme controls will be available in a future update.</p>
							</div>
							<span>Coming soon</span>
						</div>
					</section>
					<section className='account-page-card settings-card settings-card--security security-settings-card'>
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
							<div className='security-provider-row'>
								<div>
									<strong>Google</strong>
									<p>Use Google sign-in with the same account.</p>
								</div>
								<button
									type='button'
									className='quiet-button security-provider-button'
									onClick={connectGoogleAccount}
									disabled={!isLocalAccount}
								>
									{isLocalAccount ? 'Connect Google' : 'Google connected'}
								</button>
							</div>
							<div className='security-provider-row is-disabled'>
								<div>
									<strong>Microsoft</strong>
									<p>Coming soon.</p>
								</div>
								<button type='button' className='quiet-button security-provider-button' disabled>
									Connect Microsoft
								</button>
							</div>
							<div className='security-provider-row is-disabled'>
								<div>
									<strong>Apple</strong>
									<p>Coming soon.</p>
								</div>
								<button type='button' className='quiet-button security-provider-button' disabled>
									Connect Apple
								</button>
							</div>
						</div>
						<div className='security-provider-list'>
							<div className='security-provider-header'>
								<strong>Passkey</strong>
							</div>
							<div className='security-provider-row'>
								<div>
									<strong>Use a passkey</strong>
									<p>Sign in with Face ID, Touch ID, or a device-based credential.</p>
								</div>
								<button type='button' className='quiet-button security-provider-button' disabled>
									Add passkey
								</button>
							</div>
						</div>
						<div className='security-2fa'>
							<div>
								<strong>Two-factor authentication</strong>
								<p>
									Authenticator app setup will be available once email delivery is
									configured.
								</p>
							</div>
							<span>Coming soon</span>
						</div>
					</section>
				</div>
				<div className='settings-column settings-column--right'>
					<section className='account-page-card settings-card settings-card--notifications'>
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
								disabled
								title='Email notifications'
								description='In development. Email updates will be available soon.'
							/>
							<SettingToggle
								checked={settings.taskNotifications}
								onChange={(event) =>
									updateSetting('taskNotifications', event.target.checked)
								}
								disabled
								title='Task activity'
								description='In development. Task alerts will be available soon.'
							/>
						</div>
					</section>
					<section className='account-page-card settings-card settings-card--language'>
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
			<div className='settings-save-bar'>
				<span>
					<Mail size={15} /> {t.settings.changes}
				</span>
				<button
					type='button'
					className='primary-button'
					onClick={(event) => {
						event.preventDefault()
						saveSettings()
					}}
					disabled={isSaving}
				>
					{isSaving ? 'Saving...' : t.settings.save}
				</button>
			</div>
		</main>
	)
}

export default Settings
