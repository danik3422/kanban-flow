import { ArrowRight, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AuthLayout from '../features/auth/AuthLayout'
import { AuthHeading } from '../features/auth/AuthParts'
import { ProfileScene } from '../features/auth/AuthScenes'
import AvatarEditor from '../features/profile/AvatarEditor'
import TimezonePicker from '../features/profile/timezone/TimezonePicker'
import { getDetectedTimezone } from '../features/profile/timezone/timezones'
import { useI18n } from '../i18n'
import { translateServerMessage } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { Avatar, Button, Field, Input } from '../ui'
import { canAutoFocusTyping } from '../lib/autoFocus'


const SetupProfile = () => {
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const { authUser, checkAuth } = useAuthStore()
	const [name, setName] = useState(() => authUser?.name || '')
	const [jobTitle, setJobTitle] = useState(() => authUser?.jobTitle || '')
	// A first setup starts from this device's timezone; the account's is only a default until then.
	const [timezone, setTimezone] = useState(() => (authUser?.profileSetup && authUser?.timezone) || getDetectedTimezone())
	// A cropped, compressed photo ready to upload; the saved one shows until then.
	const [avatarData, setAvatarData] = useState('')
	const [isEditorOpen, setIsEditorOpen] = useState(false)
	const avatarPreview = avatarData || authUser?.avatar || ''
	const [nameError, setNameError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isFirstSetup = authUser?.profileSetup === false

	const handleSubmit = async (event) => {
		event.preventDefault()
		if (!name.trim()) {
			setNameError(t('auth.errors.nameRequired'))
			return
		}
		setIsSubmitting(true)
		try {
			await axiosInstance.patch('/auth/setup-profile', { name: name.trim(), jobTitle, timezone, avatar: avatarData || null })
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
						<Button variant='secondary' size='sm' icon={Upload} onClick={() => setIsEditorOpen(true)}>
							{avatarPreview ? t('auth.setup.changePhoto') : t('auth.setup.addPhoto')}
						</Button>
						{avatarData && (
							<Button variant='ghost' size='sm' icon={X} onClick={() => setAvatarData('')}>{t('auth.setup.removePhoto')}</Button>
						)}
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
						autoFocus={canAutoFocusTyping()}
					/>
				</Field>
				<Field label={t('auth.setup.job')} optional>
					<Input id='setup-job' value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder={t('auth.setup.jobPlaceholder')} autoComplete='organization-title' />
				</Field>
				<Field label={t('auth.setup.timezone')} hint={t('auth.setup.timezoneHint')}>
					<TimezonePicker id='setup-timezone' value={timezone} onChange={setTimezone} />
				</Field>
				<Button type='submit' className='setup-submit' size='lg' block loading={isSubmitting} iconRight={ArrowRight}>
					{isSubmitting ? t('common.saving') : isFirstSetup ? t('auth.setup.submit') : t('common.save')}
				</Button>
			</form>
			<AvatarEditor
				open={isEditorOpen}
				name={name || authUser.email}
				onClose={() => setIsEditorOpen(false)}
				onSave={(dataUrl) => {
					setAvatarData(dataUrl)
					return true
				}}
			/>
		</AuthLayout>
	)
}

export default SetupProfile
