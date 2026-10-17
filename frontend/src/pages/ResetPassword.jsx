import { ArrowLeft, CheckCircle2, LinkIcon, Mail, MailCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AuthLayout from '../components/auth/AuthLayout'
import { AuthHeading, AuthStatus, PasswordRules } from '../components/auth/AuthParts'
import { useI18n } from '../i18n'
import { translateServerMessage } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { Button, Field, Input, PasswordInput, Spinner } from '../ui'
import { meetsPasswordRules } from '../utils/password'

const AUTH_EMAIL_KEY = 'kanban-auth-email'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ResetPassword = () => {
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '')
	const isPasswordReset = Boolean(token)
	const [email, setEmail] = useState(() => sessionStorage.getItem(AUTH_EMAIL_KEY) || '')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [errors, setErrors] = useState({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [tokenState, setTokenState] = useState(isPasswordReset ? 'checking' : 'none')
	const [tokenError, setTokenError] = useState('')
	const validationStartedRef = useRef(false)

	// Validate the link once and take the token out of the address bar.
	useEffect(() => {
		if (!token || validationStartedRef.current) return undefined
		validationStartedRef.current = true
		const cleanUrl = new URL(window.location.href)
		cleanUrl.searchParams.delete('token')
		window.history.replaceState(window.history.state, document.title, `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`)
		let ignore = false
		axiosInstance
			.get('/auth/password-reset/validate', { params: { token } })
			.then(({ data }) => {
				if (ignore) return
				setTokenState('valid')
				setEmail(data.email || '')
				if (data.email) sessionStorage.setItem(AUTH_EMAIL_KEY, data.email)
			})
			.catch((error) => {
				if (ignore) return
				setTokenState('invalid')
				setTokenError(error.response?.data?.message || '')
			})
		return () => {
			ignore = true
			validationStartedRef.current = false
		}
	}, [token])

	useEffect(() => {
		if (isSubmitted) return undefined
		const handleKeyDown = (event) => {
			// Leave only from an empty form: Escape must never throw away what was typed.
			const typing = event.target instanceof HTMLInputElement && event.target.value
			if (event.key === 'Escape' && !typing && !document.querySelector('[role="dialog"], [role="menu"]')) navigate('/login')
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [isSubmitted, navigate])

	const handleSubmit = async (event) => {
		event.preventDefault()
		const nextErrors = {}
		if (isPasswordReset) {
			if (!password) nextErrors.password = t('auth.errors.passwordCreate')
			else if (!meetsPasswordRules(password)) nextErrors.password = t('auth.errors.passwordRules')
			if (!confirmPassword) nextErrors.confirmPassword = t('auth.errors.confirmRequired')
			else if (password !== confirmPassword) nextErrors.confirmPassword = t('auth.errors.passwordsMismatch')
		} else if (!email.trim()) {
			nextErrors.email = t('auth.errors.emailRequired')
		} else if (!EMAIL_PATTERN.test(email.trim())) {
			nextErrors.email = t('auth.errors.emailInvalid')
		}
		if (Object.keys(nextErrors).length) return setErrors(nextErrors)
		setErrors({})
		setIsSubmitting(true)
		try {
			if (isPasswordReset) {
				await axiosInstance.post('/auth/password-reset/confirm', { token, password })
				toast.success(t('auth.toast.passwordUpdated'))
				setIsSubmitted(true)
				setTimeout(() => navigate('/login', { replace: true }), 1800)
			} else {
				await axiosInstance.post('/auth/password-reset/request', { email: email.trim() })
				setIsSubmitted(true)
			}
		} catch (error) {
			toast.error(translateServerMessage(language, error.response?.data?.message))
		} finally {
			setIsSubmitting(false)
		}
	}

	const backToLogin = (
		<Button as={Link} to='/login' variant='secondary' block icon={ArrowLeft}>
			{t('auth.reset.backToLogin')}
		</Button>
	)

	let content
	if (isSubmitted && isPasswordReset) {
		content = (
			<AuthStatus icon={CheckCircle2} tone='success' title={t('auth.reset.updatedTitle')} actions={backToLogin}>
				{t('auth.reset.updatedText')}
			</AuthStatus>
		)
	} else if (isSubmitted) {
		content = (
			<AuthStatus icon={MailCheck} title={t('auth.reset.sentTitle')} actions={backToLogin}>
				{t('auth.reset.sentText', { email: email.trim() })}
			</AuthStatus>
		)
	} else if (tokenState === 'checking') {
		content = (
			<AuthStatus icon={LinkIcon} title={t('auth.reset.checking')}>
				<Spinner size={20} />
			</AuthStatus>
		)
	} else if (tokenState === 'invalid') {
		content = (
			<AuthStatus
				icon={LinkIcon}
				tone='danger'
				title={t('auth.reset.invalidTitle')}
				actions={
					<>
						<Button as={Link} to='/login/resetpassword' reloadDocument block>{t('auth.reset.requestNew')}</Button>
						{backToLogin}
					</>
				}
			>
				{tokenError ? translateServerMessage(language, tokenError, 'auth.reset.invalidText') : t('auth.reset.invalidText')}
			</AuthStatus>
		)
	} else if (isPasswordReset) {
		content = (
			<>
				<AuthHeading title={t('auth.reset.newTitle')} subtitle={t('auth.reset.newSubtitle')} />
				<form className='auth-form' onSubmit={handleSubmit} noValidate>
					{email && <input type='email' name='username' value={email} autoComplete='username' readOnly hidden />}
					<Field label={t('auth.fields.newPassword')} error={errors.password}>
						<PasswordInput
							id='new-password'
							value={password}
							onChange={(event) => {
								setPassword(event.target.value)
								setErrors((current) => ({ ...current, password: '' }))
							}}
							placeholder={t('auth.fields.newPasswordPlaceholder')}
							autoComplete='new-password'
							autoFocus
							aria-describedby='reset-password-rules'
						/>
					</Field>
					<PasswordRules password={password} id='reset-password-rules' />
					<Field label={t('auth.fields.confirmPassword')} error={errors.confirmPassword}>
						<PasswordInput
							id='confirm-reset-password'
							value={confirmPassword}
							onChange={(event) => {
								setConfirmPassword(event.target.value)
								setErrors((current) => ({ ...current, confirmPassword: '' }))
							}}
							placeholder={t('auth.fields.confirmPasswordPlaceholder')}
							autoComplete='new-password'
						/>
					</Field>
					<Button type='submit' size='lg' block loading={isSubmitting}>
						{isSubmitting ? t('common.saving') : t('auth.reset.save')}
					</Button>
				</form>
			</>
		)
	} else {
		content = (
			<>
				<AuthHeading title={t('auth.reset.requestTitle')} subtitle={t('auth.reset.requestSubtitle')} />
				<form className='auth-form' onSubmit={handleSubmit} noValidate>
					<Field label={t('auth.fields.email')} error={errors.email}>
						<Input
							id='reset-email'
							type='email'
							icon={Mail}
							value={email}
							onChange={(event) => {
								setEmail(event.target.value)
								setErrors({})
							}}
							placeholder={t('auth.fields.emailPlaceholder')}
							autoComplete='username'
							inputMode='email'
							autoFocus
						/>
					</Field>
					<Button type='submit' size='lg' block loading={isSubmitting}>
						{isSubmitting ? t('auth.reset.sending') : t('auth.reset.send')}
					</Button>
				</form>
				<p className='auth-footer'>
					<Link className='auth-link' to='/login'>{t('auth.reset.backToLogin')}</Link>
				</p>
			</>
		)
	}

	return <AuthLayout panel='recovery'>{content}</AuthLayout>
}

export default ResetPassword
