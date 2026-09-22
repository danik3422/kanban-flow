import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, Globe2, Mail, Pencil, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { handleAvatarError } from '../utils/avatar'

const Profile = () => {
	const authUser = useAuthStore((state) => state.authUser)
	const profileFields = [authUser?.name, authUser?.email, authUser?.jobTitle, authUser?.timezone]
	const completion = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100)

	return (
		<main className='account-page'>
			<div className='account-page-header'><Link to='/workspaces' className='account-back-link'><ArrowLeft size={15} /> Back to workspace</Link><p className='eyebrow'>Account / Profile</p><h1>Your profile.</h1><p>Make it easier for your team to know who is behind the work.</p></div>
			<div className='profile-layout'>
				<section className='account-page-card profile-card'>
					<div className='profile-hero'>
						<div className='profile-large-avatar'><img className={!authUser?.avatar ? 'is-default-avatar' : ''} src={authUser?.avatar || '/avatar.png'} onError={handleAvatarError} alt='' /></div>
						<div className='profile-hero-copy'><span className='profile-status'><span /> Active account</span><h2>{authUser?.name || 'Your profile'}</h2><p>{authUser?.jobTitle || 'Add a role so your team knows your focus.'}</p><span className='profile-provider'><ShieldCheck size={14} /> {authUser?.provider === 'local' ? 'Email account' : `${authUser?.provider || 'Connected'} account`}</span></div>
					</div>
					{completion < 100 && <div className='profile-completion'><div><span>Profile completeness</span><strong>{completion}%</strong></div><div className='profile-progress'><span style={{ width: `${completion}%` }} /></div><small>Add the missing details to complete your profile.</small></div>}
					<div className='profile-fields'><div><span><UserRound size={15} /> Name</span><strong>{authUser?.name || 'Not set yet'}</strong></div><div><span><Mail size={15} /> Email</span><strong>{authUser?.email || 'Not set yet'}</strong></div><div><span><BriefcaseBusiness size={15} /> Role</span><strong>{authUser?.jobTitle || 'Not set yet'}</strong></div><div><span><Clock3 size={15} /> Timezone</span><strong>{authUser?.timezone || 'UTC'}</strong></div></div>
					<div className='profile-card-actions'><Link to='/profile/edit' className='primary-button'><Pencil size={16} /> Edit profile <ArrowRight size={15} /></Link><Link to='/settings' className='quiet-button'>Account settings</Link></div>
				</section>
				<aside className='profile-aside'>
					<section className='profile-snapshot'><div className='profile-section-heading'><div><p className='eyebrow'>Snapshot</p><h3>Account overview</h3></div><CheckCircle2 size={19} /></div><div className='profile-snapshot-row'><Globe2 size={16} /><div><span>Timezone</span><strong>{authUser?.timezone || 'UTC'}</strong></div></div><div className='profile-snapshot-row'><ShieldCheck size={16} /><div><span>Security</span><strong>Protected account</strong></div></div><div className='profile-snapshot-row'><UsersRound size={16} /><div><span>Collaboration</span><strong>Team member</strong></div></div></section>
					<section className='profile-quick-actions'><p className='eyebrow'>Keep moving</p><h3>Useful next steps</h3><Link to='/team'><UsersRound size={16} /><span>View your team</span><ArrowRight size={14} /></Link><Link to='/settings'><ShieldCheck size={16} /><span>Review security</span><ArrowRight size={14} /></Link></section>
				</aside>
			</div>
		</main>
	)
}

export default Profile
