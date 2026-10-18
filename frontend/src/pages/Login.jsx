import { startAuthentication } from '@simplewebauthn/browser'
import { ArrowRight, Fingerprint, Mail, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import { AuthHeading, ProviderButtons } from '../components/auth/AuthParts'
import { useI18n } from '../i18n'
import { translateServerMessage } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { loadFirebase } from '../lib/firebase'
import { useAuthStore } from '../store/useAuthStore'
import { Button, Field, IconButton, Input, PasswordInput } from '../ui'
import { canAutoFocusTyping } from '../utils/autoFocus'

const AUTH_EMAIL_KEY = 'kanban-auth-email'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Login = () => {
	const { t, language } = useI18n()
	const { login, passkeyLogin, handleSocialSignin, isLoggingIn } = useAuthStore()
	const [email, setEmail] = useState(() => sessionStorage.getItem(AUTH_EMAIL_KEY) || '')
	const [password, setPassword] = useState('')
	const [errors, setErrors] = useState({})
	const [emailLocked, setEmailLocked] = useState(false)
	const [isPasskeyPending, setIsPasskeyPending] = useState(false)
	const emailRef = useRef(null)
	const passwordRef = useRef(null)
	const autoFocus = canAutoFocusTyping()

	// Preload social sign-in so the provider popup opens straight from the click.
	useEffect(() => {
		loadFirebase().catch(() => {})
	}, [])

	const editEmail = () => {
		setEmailLocked(false)
		setPassword('')
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
		if (!password) return setErrors({ password: t('auth.errors.passwordRequired') })
		setErrors({})
		// App.jsx routes to email verification or the workspace once signed in.
		await login({ email: email.trim(), password })
	}

	const handlePasskey = async () => {
		setIsPasskeyPending(true)
		try {
			const { data: options } = await axiosInstance.post('/auth/passkeys/auth-options', { email: email.trim() })
			const assertion = await startAuthentication({ optionsJSON: options })
			await passkeyLogin(assertion)
		} catch (error) {
			if (error.name !== 'NotAllowedError') {
				setErrors({ password: translateServerMessage(language, error.response?.data?.message) })
			}
		} finally {
			setIsPasskeyPending(false)
		}
	}

	return (
		<AuthLayout panel='login'>
			<AuthHeading title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />
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
						<div>
							<div className='auth-form__row'>
								<label className='ui-field__label' htmlFor='password'>{t('auth.fields.password')}</label>
								<Link className='auth-link' to='/login/resetpassword'>{t('auth.login.forgot')}</Link>
							</div>
							<Field error={errors.password}>
								<PasswordInput
									ref={passwordRef}
									id='password'
									name='password'
									value={password}
									onChange={(event) => {
										setPassword(event.target.value)
										setErrors({})
									}}
									placeholder={t('auth.fields.passwordPlaceholder')}
									autoComplete='current-password'
								/>
							</Field>
						</div>
					</>
				)}
				<Button type='submit' size='lg' block loading={isLoggingIn} iconRight={ArrowRight}>
					{isLoggingIn ? t('auth.login.submitting') : emailLocked ? t('auth.login.submit') : t('auth.login.continue')}
				</Button>
				{emailLocked && (
					<Button variant='ghost' block icon={Fingerprint} onClick={handlePasskey} disabled={isLoggingIn} loading={isPasskeyPending}>
						{t('auth.login.passkey')}
					</Button>
				)}
			</form>
			<ProviderButtons onSelect={handleSocialSignin} disabled={isLoggingIn} />
			<p className='auth-footer'>
				{t('auth.login.newHere')} <Link className='auth-link' to='/signup'>{t('auth.login.createAccount')}</Link>
			</p>
		</AuthLayout>
	)
}

export default Login
