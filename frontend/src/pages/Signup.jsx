import { ArrowRight, Mail, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import { AuthHeading, PasswordRules, ProviderButtons } from '../components/auth/AuthParts'
import { useI18n } from '../i18n'
import { loadFirebase } from '../lib/firebase'
import { useAuthStore } from '../store/useAuthStore'
import { Button, Field, IconButton, Input, PasswordInput } from '../ui'
import { meetsPasswordRules } from '../utils/password'

const AUTH_EMAIL_KEY = 'kanban-auth-email'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Signup = () => {
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const signup = useAuthStore((state) => state.signup)
	const handleSocialSignup = useAuthStore((state) => state.handleSocialSignup)
	const isSigningUp = useAuthStore((state) => state.isSigningUp)
	const [email, setEmail] = useState(() => sessionStorage.getItem(AUTH_EMAIL_KEY) || '')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [errors, setErrors] = useState({})
	const [emailLocked, setEmailLocked] = useState(false)
	const emailRef = useRef(null)
	const passwordRef = useRef(null)
	const autoFocus = typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches

	// Preload social sign-in so the provider popup opens straight from the click.
	useEffect(() => {
		loadFirebase().catch(() => {})
	}, [])

	const editEmail = () => {
		setEmailLocked(false)
		setPassword('')
		setConfirmPassword('')
		setErrors({})
		requestAnimationFrame(() => emailRef.current?.focus())
	}

	useEffect(() => {
		if (!emailLocked) return undefined
		requestAnimationFrame(() => passwordRef.current?.focus())
		const handleKeyDown = (event) => {
			if (event.key === 'Escape' && !document.querySelector('[role="dialog"], [role="menu"]')) editEmail()
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [emailLocked])

	const handleSubmit = async (event) => {
		event.preventDefault()
		if (!emailLocked) {
			const trimmed = email.trim()
			if (!trimmed) return setErrors({ email: t('auth.errors.emailRequired') })
			if (!EMAIL_PATTERN.test(trimmed)) return setErrors({ email: t('auth.errors.emailInvalid') })
			setErrors({})
			setEmailLocked(true)
			return
		}
		const nextErrors = {}
		if (!password) nextErrors.password = t('auth.errors.passwordCreate')
		else if (!meetsPasswordRules(password)) nextErrors.password = t('auth.errors.passwordRules')
		if (!confirmPassword) nextErrors.confirmPassword = t('auth.errors.confirmRequired')
		else if (password !== confirmPassword) nextErrors.confirmPassword = t('auth.errors.passwordsMismatch')
		if (Object.keys(nextErrors).length) return setErrors(nextErrors)
		setErrors({})

		const result = await signup({ email: email.trim(), password, language })
		if (result?.success && result.requiresVerification) {
			navigate(`/login/verify-email?email=${encodeURIComponent(email.trim())}`)
		} else if (result?.success) {
			navigate('/setup-profile')
		}
	}

	return (
		<AuthLayout panel='signup'>
			<AuthHeading title={t('auth.signup.title')} subtitle={t('auth.signup.subtitle')} />
			<form className='auth-form' onSubmit={handleSubmit} noValidate>
				<Field label={t('auth.fields.email')} error={errors.email}>
					<Input
						ref={emailRef}
						id='email'
						name='email'
						type='email'
						icon={Mail}
						value={email}
						onChange={(event) => {
							setEmail(event.target.value)
							setErrors({})
							sessionStorage.setItem(AUTH_EMAIL_KEY, event.target.value)
						}}
						placeholder={t('auth.fields.emailPlaceholder')}
						autoComplete='username'
						inputMode='email'
						autoFocus={!emailLocked && autoFocus}
						readOnly={emailLocked}
						action={emailLocked && <IconButton icon={Pencil} label={t('auth.fields.editEmail')} size='sm' onClick={editEmail} />}
					/>
				</Field>
				{emailLocked && (
					<>
						<Field label={t('auth.fields.password')} error={errors.password}>
							<PasswordInput
								ref={passwordRef}
								id='password'
								name='password'
								value={password}
								onChange={(event) => {
									setPassword(event.target.value)
									setErrors((current) => ({ ...current, password: '' }))
								}}
								placeholder={t('auth.fields.newPasswordPlaceholder')}
								autoComplete='new-password'
								aria-describedby='signup-password-rules'
							/>
						</Field>
						<PasswordRules password={password} id='signup-password-rules' />
						<Field label={t('auth.fields.confirmPassword')} error={errors.confirmPassword}>
							<PasswordInput
								id='confirmPassword'
								name='confirmPassword'
								value={confirmPassword}
								onChange={(event) => {
									setConfirmPassword(event.target.value)
									setErrors((current) => ({ ...current, confirmPassword: '' }))
								}}
								placeholder={t('auth.fields.confirmPasswordPlaceholder')}
								autoComplete='new-password'
							/>
						</Field>
					</>
				)}
				<Button type='submit' size='lg' block loading={isSigningUp} iconRight={ArrowRight}>
					{isSigningUp ? t('auth.signup.submitting') : emailLocked ? t('auth.signup.submit') : t('auth.signup.continue')}
				</Button>
			</form>
			{!emailLocked && <ProviderButtons onSelect={handleSocialSignup} disabled={isSigningUp} />}
			<p className='auth-footer'>
				{t('auth.signup.haveAccount')} <Link className='auth-link' to='/login'>{t('auth.signup.signIn')}</Link>
			</p>
		</AuthLayout>
	)
}

export default Signup
