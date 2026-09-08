import { Camera, Check, ChevronDown, Clock3, LockKeyhole, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'

const SetupProfile = () => {
	const navigate = useNavigate()
	const { authUser, checkAuth } = useAuthStore()

	const [name, setName] = useState(() => authUser?.name || '')
	const [jobTitle, setJobTitle] = useState(() => authUser?.jobTitle || '')
	const [timezone, setTimezone] = useState(() => authUser?.timezone || 'UTC')
	const [password, setPassword] = useState('')
	const [avatarFile, setAvatarFile] = useState(null)
	const [avatarPreview, setAvatarPreview] = useState(
		() => authUser?.avatar || '/avatar.png'
	)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isFirstSetup = authUser.profileSetup === false
	const timezones = ['UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Kyiv', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo']

	const handleFileChange = (e) => {
		const file = e.target.files[0]
		if (file) {
			setAvatarFile(file)
			setAvatarPreview(URL.createObjectURL(file))
		}
	}

	const convertFileToBase64 = (file) => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.readAsDataURL(file)
			reader.onload = () => resolve(reader.result)
			reader.onerror = (error) => reject(error)
		})
	}

	const handleSubmit = async (e) => {
		e.preventDefault()

		if (!name.trim()) {
			toast.error('Name is required')
			return
		}

		try {
			setIsSubmitting(true)

			let avatarBase64 = null
			if (avatarFile) {
				avatarBase64 = await convertFileToBase64(avatarFile)
			}

			await axiosInstance.patch('/auth/setup-profile', {
				name,
				jobTitle,
				timezone,
				password,
				avatar: avatarBase64,
			})

			toast.success('Profile updated successfully!')
			await checkAuth()
			navigate(isFirstSetup ? '/workspaces' : '/profile')
		} catch (err) {
			toast.error(err?.response?.data?.message || 'Profile update failed')
		} finally {
			setIsSubmitting(false)
		}
	}

	if (!authUser) return null

	return (
		<div className='setup-page'>
			<div className='setup-layout'>
				<section className='setup-intro'><div className='setup-kicker'><span className='brand-mark'>K</span><span>{isFirstSetup ? 'First things first' : 'Profile settings'}</span></div><p className='eyebrow'>{isFirstSetup ? 'Welcome to Kanban' : 'Your profile'}</p><h1>{isFirstSetup ? 'Make this workspace yours.' : 'Keep your profile current.'}</h1><p>{isFirstSetup ? 'A few details help your team recognize you and make your workspace feel like home.' : 'Update the details your teammates see across the workspace.'}</p><div className='setup-perks'><span><Check size={14} /> Personal workspace</span><span><Check size={14} /> Easy to update later</span></div></section>
				<section className='setup-card'><div className='setup-card-heading'><div><p className='eyebrow'>{isFirstSetup ? 'Step 1 of 1' : 'Edit profile'}</p><h2>{isFirstSetup ? 'Tell us about you' : 'Your details'}</h2><p>Only your name is required. Everything else is optional.</p></div><div className='setup-step-icon'><UserRound size={20} /></div></div><form className='setup-form' onSubmit={handleSubmit}><label className='setup-avatar-upload'><img src={avatarPreview || '/avatar.png'} alt='' /><span><Camera size={15} /> Change photo</span><input type='file' accept='image/*' onChange={handleFileChange} /></label><div className='setup-field'><label htmlFor='setup-name'>Full name <span>Required</span></label><div className='setup-input-wrap'><UserRound size={16} /><input id='setup-name' type='text' value={name} onChange={(event) => setName(event.target.value)} placeholder='e.g. Danylo Syloats' required /></div></div><div className='setup-field'><label htmlFor='setup-job'>Role or job title <span>Optional</span></label><div className='setup-input-wrap'><input id='setup-job' type='text' value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder='e.g. Product designer' /></div></div><div className='setup-field'><label htmlFor='setup-timezone'>Timezone <span>Optional</span></label><div className='setup-input-wrap'><Clock3 size={16} /><select id='setup-timezone' value={timezone} onChange={(event) => setTimezone(event.target.value)}>{timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select><ChevronDown size={15} className='setup-select-icon' /></div></div>{authUser.provider !== 'local' && <div className='setup-field'><label htmlFor='setup-password'>Set a local password <span>Optional</span></label><div className='setup-input-wrap'><LockKeyhole size={16} /><input id='setup-password' type='password' value={password} onChange={(event) => setPassword(event.target.value)} placeholder='At least 6 characters' /></div><small>Use it to sign in without Google next time.</small></div>}<button type='submit' className='primary-button setup-submit' disabled={isSubmitting}>{isSubmitting ? 'Saving...' : isFirstSetup ? 'Enter workspace' : 'Save changes'} <ChevronDown size={16} className='setup-submit-arrow' /></button></form></section>
			</div>
		</div>
	)
}

export default SetupProfile
