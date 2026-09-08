import { ArrowLeft, ArrowRight, Mail, Pencil, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const Profile = () => {
	const authUser = useAuthStore((state) => state.authUser)

	return (
		<main className='account-page'>
			<div className='account-page-header'><Link to='/workspaces' className='account-back-link'><ArrowLeft size={15} /> Back to workspace</Link><p className='eyebrow'>Account</p><h1>Profile</h1><p>Keep your personal details up to date.</p></div>
			<section className='account-page-card profile-card'>
				<div className='profile-card-top'><div className='profile-large-avatar'><img src={authUser?.avatar || '/avatar.png'} alt='' /></div><div><p className='eyebrow'>Personal details</p><h2>{authUser?.name || 'Your profile'}</h2><span className='profile-provider'><ShieldCheck size={14} /> {authUser?.provider === 'local' ? 'Email account' : `${authUser?.provider} account`}</span></div></div>
				<div className='profile-fields'><div><span><UserRound size={15} /> Name</span><strong>{authUser?.name || 'Not set yet'}</strong></div><div><span><Mail size={15} /> Email</span><strong>{authUser?.email}</strong></div></div>
				<Link to='/setup-profile' className='primary-button'><Pencil size={16} /> Edit profile <ArrowRight size={15} /></Link>
			</section>
		</main>
	)
}

export default Profile
