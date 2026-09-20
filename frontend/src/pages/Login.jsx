import {
	ArrowRight,
	Check,
	Eye,
	EyeOff,
	LockKeyhole,
	Pencil,
	ShieldCheck,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { translations } from '../lib/translations'
import { useAuthStore } from '../store/useAuthStore'
import AuthButton from '../ui/AuthButton'

const AUTH_EMAIL_KEY = 'kanban-auth-email'

const Login = () => {
	const { authUser, login, handleSocialSignin, isLoggingIn } = useAuthStore()
	const currentLanguage =
		authUser?.language || document.documentElement.lang || 'en'
	const t = translations[currentLanguage] || translations.en

	const [formData, setFormData] = useState(() => ({
		email: sessionStorage.getItem(AUTH_EMAIL_KEY) || '',
		password: '',
	}))
	const emailInputRef = useRef(null)
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [emailLocked, setEmailLocked] = useState(false)

	const handleChange = (e) => {
		const { name, value } = e.target
		setFormData((prev) => ({ ...prev, [name]: value }))
		if (name === 'email') sessionStorage.setItem(AUTH_EMAIL_KEY, value)
	}

	const handleContinue = (e) => {
		e.preventDefault()
		if (formData.email.trim()) {
			setEmailLocked(true)
		}
	}

	const handleLogin = async (e) => {
		e.preventDefault()
		await login(formData)
		// App.jsx will handle redirect to /verify-email if email not verified
	}

	const handleEditEmail = () => {
		setEmailLocked(false)
		setFormData((prev) => ({ ...prev, password: '' }))
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
						<div className='auth-progress'>
							<span />
							<span />
							<span />
							<span />
						</div>
						<strong>Make progress visible.</strong>
						<p>4 focused tasks · 1 board</p>
						<div className='auth-check-list'>
							<span>
								<Check size={13} /> Review priorities
							</span>
							<span>
								<Check size={13} /> Move one card forward
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
						autoComplete='on'
					>
						<div className='auth-field'>
							<label htmlFor='email'>{t.login.email}</label>
							<div className='auth-input-wrap'>
								<input
									ref={emailInputRef}
									autoFocus={!emailLocked}
									id='email'
									name='email'
									type='email'
									value={formData.email}
									onChange={handleChange}
									onKeyDown={(event) => {
										if (
											event.key === 'Enter' &&
											event.currentTarget.checkValidity()
										) {
											event.preventDefault()
											handleContinue(event)
										}
									}}
									placeholder='you@example.com'
									required
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
							</div>
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
