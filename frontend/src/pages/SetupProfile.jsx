import { Camera, Check, ChevronDown, UserRound, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import TimezonePicker from '../components/TimezonePicker'
import { getDetectedTimezone, timezoneOptions } from '../data/timezones'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { handleAvatarError } from '../utils/avatar'
import { prepareAvatar } from '../utils/image'

const SetupProfile = () => {
	const navigate = useNavigate()
	const { authUser, checkAuth } = useAuthStore()
	const [name, setName] = useState(() => authUser?.name || '')
	const [jobTitle, setJobTitle] = useState(() => authUser?.jobTitle || '')
	const [timezone, setTimezone] = useState(() => authUser?.timezone || getDetectedTimezone())
	const [avatarFile, setAvatarFile] = useState(null)
	const [avatarPreview, setAvatarPreview] = useState(() => authUser?.avatar || '/avatar.png')
	const avatarInputRef = useRef(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isFirstSetup = authUser?.profileSetup === false

	const handleFileChange = (event) => {
		const file = event.target.files?.[0]
		if (file) {
			if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
				toast.error('Choose a JPG, PNG, or WebP image up to 5 MB')
				event.target.value = ''
				return
			}
			setAvatarFile(file)
			setAvatarPreview(URL.createObjectURL(file))
		}
	}

	const handleRemovePhoto = () => {
		setAvatarFile(null)
		setAvatarPreview(authUser?.avatar || '/avatar.png')
		if (avatarInputRef.current) avatarInputRef.current.value = ''
	}

	const handleSubmit = async (event) => {
		event.preventDefault()
		if (!name.trim()) {
			toast.error('Name is required')
			return
		}

		try {
			setIsSubmitting(true)
			const avatar = avatarFile ? await prepareAvatar(avatarFile) : null
			await axiosInstance.patch('/auth/setup-profile', { name, jobTitle, timezone, avatar })
			toast.success('Profile updated successfully!')
			await checkAuth()
			navigate(isFirstSetup ? '/workspaces' : '/profile')
		} catch (error) {
			toast.error(error?.response?.data?.message || error?.message || 'Profile update failed')
		} finally {
			setIsSubmitting(false)
		}
	}

	if (!authUser) return null

	return (
		<div className='setup-page'>
			<div className='setup-layout'>
				<section className='setup-intro'>
					<div className='setup-kicker'><span className='brand-mark'>K</span><span>{isFirstSetup ? 'First things first' : 'Profile settings'}</span></div>
					<p className='eyebrow'>{isFirstSetup ? 'Welcome to KanbanHub' : 'Your profile'}</p>
					<h1>{isFirstSetup ? 'Make this workspace yours.' : 'Keep your profile current.'}</h1>
					<p>A few details help your team recognize you and make your workspace feel like home.</p>
					<div className='setup-perks'><span><Check size={14} /> Personal workspace</span><span><Check size={14} /> Easy to update later</span></div>
				</section>

				<section className='setup-card'>
					<div className='setup-card-heading'><div><p className='eyebrow'>{isFirstSetup ? 'Step 1 of 1' : 'Edit profile'}</p><h2>{isFirstSetup ? 'Tell us about you' : 'Your details'}</h2><p>Only your name is required. Everything else is optional.</p></div><div className='setup-step-icon'><UserRound size={20} /></div></div>
					<form className='setup-form' onSubmit={handleSubmit}>
						<div className='setup-avatar-control'><label className='setup-avatar-upload'><img src={avatarPreview} onError={handleAvatarError} alt='' /><span><Camera size={15} /> Change photo</span><input ref={avatarInputRef} type='file' accept='image/jpeg,image/png,image/webp' onChange={handleFileChange} /></label>{avatarFile && <button type='button' className='setup-avatar-remove' onClick={handleRemovePhoto} aria-label='Remove selected photo' title='Remove selected photo'><X size={15} /></button>}</div>
						<div className='setup-field'><label htmlFor='setup-name'>Full name <span>Required</span></label><div className='setup-input-wrap'><UserRound size={16} /><input id='setup-name' type='text' value={name} onChange={(event) => setName(event.target.value)} placeholder='e.g. Danylo Syloats' required /></div></div>
						<div className='setup-field'><label htmlFor='setup-job'>Role or job title <span>Optional</span></label><div className='setup-input-wrap'><input id='setup-job' type='text' value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder='e.g. Product designer' /></div></div>
						<div className='setup-field'><label htmlFor='setup-timezone'>Timezone <span>Optional</span></label><TimezonePicker id='setup-timezone' options={timezoneOptions} value={timezone} onChange={setTimezone} /></div>
						<button type='submit' className='primary-button setup-submit' disabled={isSubmitting}>{isSubmitting ? 'Saving...' : isFirstSetup ? 'Enter workspace' : 'Save changes'} <ChevronDown size={16} className='setup-submit-arrow' /></button>
					</form>
				</section>
			</div>
		</div>
	)
}

export default SetupProfile