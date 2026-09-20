import { ArrowLeft, Camera, Clock3, LockKeyhole, Save, UserRound } from 'lucide-react'
import { useState } from 'react'
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
	const [isSaving, setIsSaving] = useState(false)
	const timezones = timezoneOptions.map((option) => option.label)

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
			await axiosInstance.patch('/auth/setup-profile', { name, jobTitle, timezone: timezoneValues[timezone], avatar })
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
			<div className='account-page-header'><Link to='/profile' className='account-back-link'><ArrowLeft size={15} /> Back to profile</Link><p className='eyebrow'>Profile settings</p><h1>Edit your profile.</h1><p>Keep the information your team sees up to date.</p></div>
			<section className='account-page-card edit-profile-card'>
				<form className='edit-profile-form' onSubmit={handleSubmit}>
					<label className='edit-avatar-upload'><img src={avatarPreview} alt='' /><span><Camera size={15} /> Change photo</span><input type='file' accept='image/*' onChange={(event) => { const file = event.target.files?.[0]; if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)) } }} /></label>
					<div className='setup-field'><label htmlFor='edit-name'>Full name</label><div className='setup-input-wrap'><UserRound size={16} /><input id='edit-name' value={name} onChange={(event) => setName(event.target.value)} required /></div></div>
					<div className='setup-field'><label htmlFor='edit-job'>Role or job title</label><input id='edit-job' className='plain-edit-input' value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder='e.g. Product designer' /></div>
					<div className='setup-field'><label htmlFor='edit-timezone'>Timezone</label><div className='setup-input-wrap'><Clock3 size={16} /><select id='edit-timezone' value={timezone} onChange={(event) => setTimezone(event.target.value)}>{timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></div></div>
					<div className='edit-profile-actions'><Link to='/profile' className='quiet-button'>Cancel</Link><button type='submit' className='primary-button' disabled={isSaving}>{isSaving ? 'Saving...' : <><Save size={16} /> Save changes</>}</button></div>
				</form>
			</section>
		</main>
	)
}

export default EditProfile
