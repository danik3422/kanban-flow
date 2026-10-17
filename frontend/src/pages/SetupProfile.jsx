import { ArrowRight, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AuthLayout from '../components/auth/AuthLayout'
import { AuthHeading } from '../components/auth/AuthParts'
import { ProfileScene } from '../components/auth/AuthScenes'
import { getDetectedTimezone, timezoneOptions } from '../data/timezones'
import { useI18n } from '../i18n'
import { translateServerMessage } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { Avatar, Button, Field, Input, Select } from '../ui'
import { prepareAvatar } from '../utils/image'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const SetupProfile = () => {
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const { authUser, checkAuth } = useAuthStore()
	const [name, setName] = useState(() => authUser?.name || '')
	const [jobTitle, setJobTitle] = useState(() => authUser?.jobTitle || '')
	const [timezone, setTimezone] = useState(() => authUser?.timezone || getDetectedTimezone())
	const [avatarFile, setAvatarFile] = useState(null)
	const [avatarPreview, setAvatarPreview] = useState(() => authUser?.avatar || '')
	const [nameError, setNameError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const avatarInputRef = useRef(null)
	const isFirstSetup = authUser?.profileSetup === false

	// Free the temporary preview URL when it is replaced or the page closes.
	useEffect(() => () => {
		if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
	}, [avatarPreview])

	const handleFileChange = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		if (!ACCEPTED_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) {
			toast.error(t('auth.setup.photoInvalid'))
			event.target.value = ''
			return
		}
		setAvatarFile(file)
		setAvatarPreview(URL.createObjectURL(file))
	}

	const handleRemovePhoto = () => {
		setAvatarFile(null)
		setAvatarPreview(authUser?.avatar || '')
		if (avatarInputRef.current) avatarInputRef.current.value = ''
	}

	const handleSubmit = async (event) => {
		event.preventDefault()
		if (!name.trim()) {
			setNameError(t('auth.errors.nameRequired'))
			return
		}
		setIsSubmitting(true)
		try {
			const avatar = avatarFile ? await prepareAvatar(avatarFile) : null
			await axiosInstance.patch('/auth/setup-profile', { name: name.trim(), jobTitle, timezone, avatar })
			toast.success(t('auth.setup.saved'))
			await checkAuth()
			navigate(isFirstSetup ? '/workspaces' : '/profile')
		} catch (error) {
			toast.error(translateServerMessage(language, error?.response?.data?.message))
		} finally {
			setIsSubmitting(false)
		}
	}

	if (!authUser) return null

	return (
		<AuthLayout panel='setup' scene={<ProfileScene name={name} jobTitle={jobTitle} avatar={avatarPreview} fallbackName={authUser.email} />}>
			<AuthHeading title={t('auth.setup.title')} subtitle={t('auth.setup.subtitle')} />
			<form className='auth-form' onSubmit={handleSubmit} noValidate>
				<div className='setup-avatar'>
					<Avatar name={name || authUser.email} src={avatarPreview} size={64} decorative />
					<div className='setup-avatar__actions'>
						<Button variant='secondary' size='sm' icon={Upload} onClick={() => avatarInputRef.current?.click()}>
							{avatarPreview ? t('auth.setup.changePhoto') : t('auth.setup.addPhoto')}
						</Button>
						{avatarFile && (
							<Button variant='ghost' size='sm' icon={X} onClick={handleRemovePhoto}>{t('auth.setup.removePhoto')}</Button>
						)}
						<input
							ref={avatarInputRef}
							type='file'
							accept={ACCEPTED_TYPES.join(',')}
							onChange={handleFileChange}
							aria-label={t('auth.setup.photo')}
							hidden
						/>
						<span className='ui-field__hint setup-avatar__hint'>{t('auth.setup.photoHint')}</span>
					</div>
				</div>
				<Field label={t('auth.setup.name')} error={nameError}>
					<Input
						id='setup-name'
						value={name}
						onChange={(event) => {
							setName(event.target.value)
							setNameError('')
						}}
						placeholder={t('auth.setup.namePlaceholder')}
						autoComplete='name'
						autoFocus
					/>
				</Field>
				<Field label={t('auth.setup.job')} optional>
					<Input id='setup-job' value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder={t('auth.setup.jobPlaceholder')} autoComplete='organization-title' />
				</Field>
				<Field label={t('auth.setup.timezone')} hint={t('auth.setup.timezoneHint')}>
					<Select id='setup-timezone' value={timezone} onChange={(event) => setTimezone(event.target.value)} options={timezoneOptions} />
				</Field>
				<Button type='submit' className='setup-submit' size='lg' block loading={isSubmitting} iconRight={ArrowRight}>
					{isSubmitting ? t('common.saving') : isFirstSetup ? t('auth.setup.submit') : t('common.save')}
				</Button>
			</form>
		</AuthLayout>
	)
}

export default SetupProfile
