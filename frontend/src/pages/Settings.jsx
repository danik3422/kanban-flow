import { ArrowLeft, Bell, Check, Clock3, Palette, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

const Settings = () => {
	return (
		<main className='account-page'>
			<div className='account-page-header'><Link to='/workspaces' className='account-back-link'><ArrowLeft size={15} /> Back to workspace</Link><p className='eyebrow'>Account</p><h1>Settings</h1><p>Shape the way Kanban fits into your day.</p></div>
			<div className='settings-grid'>
				<section className='account-page-card settings-card'><div className='settings-card-heading'><span className='settings-icon'><Palette size={18} /></span><div><h2>Appearance</h2><p>Choose a theme that feels right for your workspace.</p></div></div><div className='settings-development'><Clock3 size={18} /><div><strong>Appearance settings are in development</strong><p>Theme controls will be available in a future update.</p></div><span>Coming soon</span></div></section>
			<section className='account-page-card settings-card'><div className='settings-card-heading'><span className='settings-icon'><Bell size={18} /></span><div><h2>Notifications</h2><p>Notification preferences will be available here.</p></div></div><div className='settings-placeholder'><Check size={16} /> Email notifications are managed by your workspace.</div></section>
				<section className='account-page-card settings-card'><div className='settings-card-heading'><span className='settings-icon'><ShieldCheck size={18} /></span><div><h2>Security</h2><p>Keep your account and workspace protected.</p></div></div><div className='settings-placeholder'>Password reset and session controls are ready for the next release.</div></section>
			</div>
		</main>
	)
}

export default Settings
