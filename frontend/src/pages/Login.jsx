import {
	ArrowRight,
	Check,
	Eye,
	EyeOff,
	LockKeyhole,
	Pencil,
	ShieldCheck,
} from 'lucide-react'
import { startAuthentication } from '@simplewebauthn/browser'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { translations } from '../lib/translations'
import { useAuthStore } from '../store/useAuthStore'
import AuthButton from '../ui/AuthButton'
import { axiosInstance } from '../lib/axios'

const AUTH_EMAIL_KEY = 'kanban-auth-email'

const loginPreviewStages = [
	{ title: 'Settle into the flow.', progress: '1 of 4', task: 'Outline launch brief', action: 'Review priorities' },
	{ title: 'Keep the team moving.', progress: '2 of 4', task: 'Polish onboarding flow', action: 'Move one card forward' },
	{ title: 'Make the next handoff clear.', progress: '3 of 4', task: 'Write release notes', action: 'Share the update' },
	{ title: 'See the work move forward.', progress: '4 of 4', task: 'Set up analytics', action: 'Celebrate the launch' },
]

const Login = () => {
	const { authUser, login, passkeyLogin, handleSocialSignin, isLoggingIn } = useAuthStore()
	const currentLanguage =
		authUser?.language || document.documentElement.lang || 'en'
	const t = translations[currentLanguage] || translations.en

	const [formData, setFormData] = useState(() => ({
		email: sessionStorage.getItem(AUTH_EMAIL_KEY) || '',
		password: '',
	}))
	const [fieldErrors, setFieldErrors] = useState({})
	const emailInputRef = useRef(null)
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [emailLocked, setEmailLocked] = useState(false)
	const [previewStage, setPreviewStage] = useState(0)
	const shouldAutoFocusEmail =
		typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches
	const activePreview = loginPreviewStages[previewStage]

	useEffect(() => {
		const interval = window.setInterval(() => {
			setPreviewStage((current) => (current + 1) % loginPreviewStages.length)
		}, 3200)
		return () => window.clearInterval(interval)
	}, [])

	const handleChange = (e) => {
		const { name, value } = e.target
		setFormData((prev) => ({ ...prev, [name]: value }))
		setFieldErrors((current) => ({ ...current, [name]: '' }))
		if (name === 'email') sessionStorage.setItem(AUTH_EMAIL_KEY, value)
	}

	const handleContinue = (e) => {
		e.preventDefault()
		const email = formData.email.trim()
		if (!email) {
			setFieldErrors({ email: 'Enter your email address.' })
			return
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			setFieldErrors({ email: 'Enter a valid email address.' })
			return
		}
		setFieldErrors({})
		setEmailLocked(true)
	}

	const handleLogin = async (e) => {
		e.preventDefault()
		if (!formData.password) {
			setFieldErrors({ password: 'Enter your password.' })
			return
		}
		setFieldErrors({})
		await login(formData)
		// App.jsx will handle redirect to /verify-email if email not verified
	}

	const handlePasskeyLogin = async () => {
		try {
			const { data: options } = await axiosInstance.post('/auth/passkeys/auth-options', { email: formData.email.trim() })
			const assertion = await startAuthentication({ optionsJSON: options })
			await passkeyLogin(assertion)
		} catch (error) {
			if (error.name !== 'NotAllowedError') {
				setFieldErrors({ password: error.message || 'Could not sign in with passkey' })
			}
		}
	}

	const handleEditEmail = () => {
		setEmailLocked(false)
		setFormData((prev) => ({ ...prev, password: '' }))
		setFieldErrors({})
		requestAnimationFrame(() => emailInputRef.current?.focus())
	}

	useEffect(() => {
		if (!emailLocked) return undefined

		const handleKeyDown = (event) => {
			if (event.key === 'Escape') handleEditEmail()
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [emailLocked])

	const handleGoogleSignIn = () => handleSocialSignin('google')

	const handleMicrosoftSignIn = async () => {
		await handleSocialSignin('microsoft')
	}

	const handleAppleSignIn = async () => {
		await handleSocialSignin('apple')
	}

	return (
		<div className='auth-page'>
			<div className='auth-layout'>
				<section className='auth-intro'>
					<div className='auth-intro-copy'>
						<p className='eyebrow'>{t.login.eyebrow}</p>
						<h1>{t.login.title}</h1>
						<p>{t.login.subtitle}</p>
					</div>
					<div className='auth-preview'>
						<div className='auth-preview-top'>
							<span>Today</span>
							<ShieldCheck size={16} />
						</div>
						<div className='auth-progress auth-progress--login'>
							{loginPreviewStages.map((stage, index) => (
								<span className={index <= previewStage ? 'is-active' : ''} key={stage.progress} />
							))}
						</div>
						<strong key={`login-title-${previewStage}`} className='auth-stage-swap'>
							{activePreview.title}
						</strong>
						<p key={`login-progress-${previewStage}`} className='auth-stage-swap'>
							{activePreview.progress} · {activePreview.task}
						</p>
						<div className='auth-check-list'>
							<span key={`login-action-${previewStage}`} className='auth-stage-swap'>
								<Check size={13} /> {activePreview.action}
							</span>
						</div>
					</div>
					<div className='auth-trust'>
						<LockKeyhole size={15} /> Your workspace stays private and focused.
					</div>
				</section>

				<section className='auth-form-panel'>
					<div className='auth-form-heading'>
						<p className='eyebrow'>{t.login.signIn}</p>
						<h2>{t.login.welcome}</h2>
						<p>{t.login.intro}</p>
					</div>
					<form
						className='auth-form'
						onSubmit={emailLocked ? handleLogin : handleContinue}
						noValidate
						autoComplete='on'
					>
						<div className='auth-field'>
							<label htmlFor='email'>{t.login.email}</label>
							<div className='auth-input-wrap'>
								<input
									ref={emailInputRef}
									autoFocus={!emailLocked && shouldAutoFocusEmail}
									id='email'
									name='email'
									type='email'
									value={formData.email}
									onChange={handleChange}
									onKeyDown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault()
											handleContinue(event)
										}
									}}
									placeholder='you@example.com'
									required
									aria-invalid={Boolean(fieldErrors.email)}
									aria-describedby={fieldErrors.email ? 'email-error' : undefined}
									autoComplete='username'
									inputMode='email'
									disabled={emailLocked}
								/>
								{emailLocked && (
									<button
										type='button'
										onClick={handleEditEmail}
										className='auth-input-action'
										aria-label='Edit email'
										title='Edit email'
									>
										<Pencil size={16} />
									</button>
								)}
							</div>
							{fieldErrors.email && (
								<p className='auth-field-error' id='email-error' role='alert'>
									{fieldErrors.email}
								</p>
							)}
						</div>
						{emailLocked && (
							<div className='auth-field'>
								<div className='auth-label-row'>
									<label htmlFor='password'>{t.login.password}</label>
									<Link to='/login/resetpassword'>
										{t.login.forgotPassword}
									</Link>
								</div>
								<div className='auth-input-wrap'>
									<input
										id='password'
										name='password'
										type={passwordVisible ? 'text' : 'password'}
										value={formData.password}
										onChange={handleChange}
										placeholder='Enter your password'
										required
											aria-invalid={Boolean(fieldErrors.password)}
											aria-describedby={fieldErrors.password ? 'password-error' : undefined}
										autoComplete='current-password'
									/>
									<button
										type='button'
										onClick={() => setPasswordVisible(!passwordVisible)}
										className='auth-input-action'
										aria-label={
											passwordVisible ? 'Hide password' : 'Show password'
										}
										title={passwordVisible ? 'Hide password' : 'Show password'}
									>
										{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
									</button>
								</div>
								{fieldErrors.password && (
									<p className='auth-field-error' id='password-error' role='alert'>
										{fieldErrors.password}
									</p>
								)}
							</div>
						)}
						{emailLocked && (
							<button type='button' className='quiet-button auth-passkey-button' onClick={handlePasskeyLogin} disabled={isLoggingIn}>
								<ShieldCheck size={16} /> Use a passkey
							</button>
						)}
						<button
							type='submit'
							className='auth-submit'
							disabled={isLoggingIn}
						>
							{isLoggingIn ? (
								t.login.signingIn
							) : emailLocked ? (
								<>
									{t.login.signIn} <ArrowRight size={16} />
								</>
							) : (
								<>
									{t.login.continue} <ArrowRight size={16} />
								</>
							)}
						</button>
					</form>
					<div className='auth-divider'>
						<span>{t.login.orContinue}</span>
					</div>
					<div className='auth-providers'>
						<AuthButton provider='google' onClick={handleGoogleSignIn} />
						<AuthButton provider='microsoft' onClick={handleMicrosoftSignIn} />
						<AuthButton provider='apple' onClick={handleAppleSignIn} />
					</div>
					<p className='auth-footer-copy'>
						{t.login.newToKanban}{' '}
						<Link to='/signup'>
							{t.login.createAccount} <ArrowRight size={14} />
						</Link>
					</p>
				</section>
			</div>
		</div>
	)
}

export default Login
