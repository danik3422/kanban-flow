import { ArrowLeft, Camera, CheckCircle2, Clock3, LockKeyhole, Save, UserRound, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { getDetectedTimezone, timezoneOptions } from '../data/timezones'

const EditProfile = () => {
	const navigate = useNavigate()
	const { authUser, checkAuth } = useAuthStore()
	const [name, setName] = useState(authUser?.name || '')
	const [jobTitle, setJobTitle] = useState(authUser?.jobTitle || '')
	const timezoneValues = Object.fromEntries(
		timezoneOptions.map((option) => [option.label, option.value]),
	)
	const [timezone, setTimezone] = useState(
		Object.entries(timezoneValues).find(([, value]) => value === (authUser?.timezone || getDetectedTimezone()))?.[0] || timezoneOptions[0].label
	)
	const [avatarFile, setAvatarFile] = useState(null)
	const [avatarPreview, setAvatarPreview] = useState(authUser?.avatar || '/avatar.png')
	const [removeAvatar, setRemoveAvatar] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const avatarInputRef = useRef(null)

	const convertFileToBase64 = (file) => new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result)
		reader.onerror = reject
		reader.readAsDataURL(file)
	})

	const handleSubmit = async (event) => {
		event.preventDefault()
		if (!name.trim()) {
			toast.error('Name is required')
			return
		}
		setIsSaving(true)
		try {
			const avatar = avatarFile ? await convertFileToBase64(avatarFile) : null
			await axiosInstance.patch('/auth/setup-profile', {
				name,
				jobTitle,
				timezone: timezoneValues[timezone],
				avatar,
				removeAvatar: removeAvatar && !avatarFile,
			})
			await checkAuth()
			toast.success('Profile updated successfully')
			navigate('/profile')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Profile update failed')
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<main className='account-page edit-profile-page'>
			<div className='account-page-header'><Link to='/profile' className='account-back-link'><ArrowLeft size={15} /> Back to profile</Link><p className='eyebrow'>Profile settings</p><h1>Shape your profile.</h1><p>Keep the information your team sees up to date.</p></div>
			<section className='account-page-card edit-profile-card'>
				<form className='edit-profile-form' onSubmit={handleSubmit}>
					<div className='edit-profile-identity'>
						<div className='edit-avatar-frame'>
							<img src={avatarPreview} alt='' />
							{avatarPreview !== '/avatar.png' && <button type='button' className='edit-avatar-remove' onClick={() => { setAvatarFile(null); setAvatarPreview('/avatar.png'); setRemoveAvatar(true); if (avatarInputRef.current) avatarInputRef.current.value = '' }} aria-label='Remove profile photo' title='Remove profile photo'><X size={14} /></button>}
						</div>
						<div className='edit-profile-identity-copy'><span className='profile-status'><CheckCircle2 size={13} /> Photo preview</span><strong>{avatarPreview !== '/avatar.png' ? 'Custom profile photo' : 'Default profile photo'}</strong><small>JPG or PNG, up to 5 MB.</small><label className='edit-avatar-picker'><Camera size={15} /> Choose photo<input ref={avatarInputRef} type='file' accept='image/*' onChange={(event) => { const file = event.target.files?.[0]; if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); setRemoveAvatar(false) } }} /></label></div>
					</div>
					<div className='edit-profile-fields'><div className='setup-field'><label htmlFor='edit-name'>Full name</label><div className='setup-input-wrap'><UserRound size={16} /><input id='edit-name' value={name} onChange={(event) => setName(event.target.value)} required /></div></div>
					<div className='setup-field'><label htmlFor='edit-job'>Role or job title</label><input id='edit-job' className='plain-edit-input' value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder='e.g. Product designer' /></div>
					<div className='setup-field'><label htmlFor='edit-timezone'>Timezone</label><div className='setup-input-wrap'><Clock3 size={16} /><select id='edit-timezone' value={timezone} onChange={(event) => setTimezone(event.target.value)}>{timezoneOptions.map((option) => <option key={option.value} value={option.label}>{option.label}</option>)}</select></div></div></div>
					<div className='edit-profile-actions'><Link to='/profile' className='quiet-button'>Cancel</Link><button type='submit' className='primary-button' disabled={isSaving}>{isSaving ? 'Saving...' : <><Save size={16} /> Save changes</>}</button></div>
				</form>
			</section>
		</main>
	)
}

export default EditProfile
