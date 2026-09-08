import { ArrowLeft, Bell, Clock3, Languages, Mail, Palette, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { isDevAuthBypass } from '../lib/devMode'
import { useAuthStore } from '../store/useAuthStore'

const SettingToggle = ({ checked, title, description, onChange }) => (
	<label className='settings-toggle-row'><span><strong>{title}</strong><small>{description}</small></span><input type='checkbox' checked={checked} onChange={onChange} /><span className='settings-switch' /></label>
)

const getInitialSettings = (authUser) => {
	const savedSettings = isDevAuthBypass ? localStorage.getItem('kanban-dev-settings') : null
	let parsedSettings = {}
	try {
		parsedSettings = savedSettings ? JSON.parse(savedSettings) : {}
	} catch {
		localStorage.removeItem('kanban-dev-settings')
	}
	return {
		emailNotifications: parsedSettings.emailNotifications ?? authUser?.emailNotifications ?? true,
		taskNotifications: parsedSettings.taskNotifications ?? authUser?.taskNotifications ?? true,
		weeklyDigest: parsedSettings.weeklyDigest ?? authUser?.weeklyDigest ?? false,
		language: parsedSettings.language || authUser?.language || 'en',
	}
}

const Settings = () => {
	const { authUser, checkAuth } = useAuthStore()
	const [settings, setSettings] = useState(() => getInitialSettings(authUser))
	const [isSaving, setIsSaving] = useState(false)

	const updateSetting = (key, value) => setSettings((current) => ({ ...current, [key]: value }))
	const saveSettings = async () => {
		setIsSaving(true)
		try {
			if (isDevAuthBypass) {
				localStorage.setItem('kanban-dev-settings', JSON.stringify(settings))
			} else {
				await axiosInstance.patch('/auth/settings', settings)
				await checkAuth()
			}
			toast.success('Settings saved')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not save settings')
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<main className='account-page'>
			<div className='account-page-header'><Link to='/workspaces' className='account-back-link'><ArrowLeft size={15} /> Back to workspace</Link><p className='eyebrow'>Account</p><h1>Settings</h1><p>Shape the way Kanban fits into your day.</p></div>
			<div className='settings-grid'>
				<section className='account-page-card settings-card'><div className='settings-card-heading'><span className='settings-icon'><Palette size={18} /></span><div><h2>Appearance</h2><p>Choose a theme that feels right for your workspace.</p></div></div><div className='settings-development'><Clock3 size={18} /><div><strong>Appearance settings are in development</strong><p>Theme controls will be available in a future update.</p></div><span>Coming soon</span></div></section>
				<section className='account-page-card settings-card'><div className='settings-card-heading'><span className='settings-icon'><Bell size={18} /></span><div><h2>Notifications</h2><p>Choose what deserves your attention.</p></div></div><div className='settings-toggle-list'><SettingToggle checked={settings.emailNotifications} onChange={(event) => updateSetting('emailNotifications', event.target.checked)} title='Email notifications' description='Receive important workspace updates by email.' /><SettingToggle checked={settings.taskNotifications} onChange={(event) => updateSetting('taskNotifications', event.target.checked)} title='Task activity' description='Get notified about changes to your tasks.' /><SettingToggle checked={settings.weeklyDigest} onChange={(event) => updateSetting('weeklyDigest', event.target.checked)} title='Weekly digest' description='Receive a short summary of your workspace each week.' /></div></section>
				<section className='account-page-card settings-card'><div className='settings-card-heading'><span className='settings-icon'><Languages size={18} /></span><div><h2>Language</h2><p>Choose the language for future interface translations.</p></div></div><div className='settings-language-options'><button className={settings.language === 'en' ? 'active' : ''} onClick={() => updateSetting('language', 'en')}><span>EN</span>English</button><button className={settings.language === 'uk' ? 'active' : ''} onClick={() => updateSetting('language', 'uk')}><span>UK</span>Українська</button></div></section>
				<section className='account-page-card settings-card'><div className='settings-card-heading'><span className='settings-icon'><ShieldCheck size={18} /></span><div><h2>Security</h2><p>Keep your account and workspace protected.</p></div></div><div className='settings-placeholder'>Password reset and session controls are ready for the next release.</div></section>
			</div>
			<div className='settings-save-bar'><span><Mail size={15} /> Changes apply to your account</span><button className='primary-button' onClick={saveSettings} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save settings'}</button></div>
		</main>
	)
}

export default Settings
