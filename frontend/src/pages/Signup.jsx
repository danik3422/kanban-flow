import {
	ArrowRight,
	Check,
	CheckCircle2,
	Circle,
	Eye,
	EyeOff,
	LockKeyhole,
	Pencil,
	ShieldCheck,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { translations } from '../lib/translations'
import { useAuthStore } from '../store/useAuthStore'
import AuthButton from '../ui/AuthButton'

const AUTH_EMAIL_KEY = 'kanban-auth-email'

const signupPreviewStages = [
	{ title: 'Start with one clear step.', progress: '1 of 4', task: 'Add your first project', action: 'Start with one clear task' },
	{ title: 'Shape your working rhythm.', progress: '2 of 4', task: 'Shape your workflow', action: 'Choose your columns' },
	{ title: 'Bring the right people in.', progress: '3 of 4', task: 'Invite your team', action: 'Share the workspace' },
	{ title: 'Make the workspace yours.', progress: '4 of 4', task: 'Make it yours', action: 'Keep the next step visible' },
]

const Signup = () => {
	const { authUser } = useAuthStore()
	const currentLanguage =
		authUser?.language || document.documentElement.lang || 'en'
	const t = translations[currentLanguage] || translations.en
	const [formData, setFormData] = useState(() => ({
		email: sessionStorage.getItem(AUTH_EMAIL_KEY) || '',
		password: '',
		confirmPassword: '',
	}))

	const [emailLocked, setEmailLocked] = useState(false)
	const [fieldErrors, setFieldErrors] = useState({})
	const emailInputRef = useRef(null)
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [confirmVisible, setConfirmVisible] = useState(false)
	const [previewStage, setPreviewStage] = useState(0)
	const activePreview = signupPreviewStages[previewStage]

	useEffect(() => {
		const interval = window.setInterval(() => {
			setPreviewStage((current) => (current + 1) % signupPreviewStages.length)
		}, 3200)
		return () => window.clearInterval(interval)
	}, [])

	const signup = useAuthStore((state) => state.signup)
	const handleSocialSignup = useAuthStore((state) => state.handleSocialSignup)
	const isSigningUp = useAuthStore((state) => state.isSigningUp)

	const navigate = useNavigate()
	const passwordChecks = {
		length: formData.password.length >= 8,
		uppercase: /[A-Z]/.test(formData.password),
		number: /\d/.test(formData.password),
		special: /[^A-Za-z0-9]/.test(formData.password),
	}
	const passwordScore = Object.values(passwordChecks).filter(Boolean).length
	const passwordStrength =
		passwordScore <= 1 ? 'weak' : passwordScore <= 3 ? 'medium' : 'strong'
	const passwordsMatch =
		formData.confirmPassword.length > 0 &&
		formData.password === formData.confirmPassword
	const passwordMismatch =
		formData.confirmPassword.length > 0 && !passwordsMatch

	const handleChange = (e) => {
		const { name, value } = e.target
		setFormData((prev) => ({ ...prev, [name]: value }))
		setFieldErrors((current) => ({ ...current, [name]: '' }))
		if (name === 'email') sessionStorage.setItem(AUTH_EMAIL_KEY, value)
	}

	const handleEmailContinue = () => {
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

	const handleEditEmail = () => {
		setEmailLocked(false)
		setFormData((prev) => ({
			...prev,
			password: '',
			confirmPassword: '',
		}))
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

	const handleSubmit = async (e) => {
		e.preventDefault()

		if (!emailLocked) {
			handleEmailContinue()
			return
		}

		const nextErrors = {}
		if (!formData.password) {
			nextErrors.password = 'Create a password to continue.'
		} else if (passwordScore < 4) {
			nextErrors.password = 'Use all four password requirements below.'
		}
		if (!formData.confirmPassword) {
			nextErrors.confirmPassword = 'Repeat your password.'
		} else if (formData.password !== formData.confirmPassword) {
			nextErrors.confirmPassword = 'Passwords do not match.'
		}
		if (Object.keys(nextErrors).length > 0) {
			setFieldErrors(nextErrors)
			return
		}
		setFieldErrors({})

		const result = await signup({
			email: formData.email,
			password: formData.password,
		})

		if (result?.success && result.requiresVerification) {
			navigate(
				`/login/verify-email?email=${encodeURIComponent(formData.email)}`,
			)
			return
		}

		if (result?.success) {
			navigate('/setup-profile')
		}
	}

	const handleMicrosoftSignIn = () => handleSocialSignup('microsoft')
	const handleAppleSignIn = () => handleSocialSignup('apple')
	const handleGoogleSignup = () => handleSocialSignup('google')

	return (
		<div className='auth-page'>
			<div className='auth-layout'>
				<section className='auth-intro'>
					<div className='auth-intro-copy'>
						<p className='eyebrow'>{t.signup.eyebrow}</p>
						<h1>{t.signup.title}</h1>
						<p>{t.signup.subtitle}</p>
					</div>
					<div className='auth-preview'>
						<div className='auth-preview-top'>
							<span>Your first board</span>
							<ShieldCheck size={16} />
						</div>
						<div className='auth-progress auth-progress--signup'>
							{signupPreviewStages.map((stage, index) => (
								<span className={index <= previewStage ? 'is-active' : ''} key={stage.progress} />
							))}
						</div>
						<strong key={`signup-title-${previewStage}`} className='auth-stage-swap'>
							{activePreview.title}
						</strong>
						<p key={`signup-progress-${previewStage}`} className='auth-stage-swap'>
							{activePreview.progress} · {activePreview.task}
						</p>
						<div className='auth-check-list'>
							<span key={`signup-action-${previewStage}`} className='auth-stage-swap'>
								<Check size={13} /> {activePreview.action}
							</span>
						</div>
					</div>
					<div className='auth-trust'>
						<LockKeyhole size={15} /> Simple setup. Private by default.
					</div>
				</section>

				<section className='auth-form-panel'>
					<div className='auth-form-heading'>
						<p className='eyebrow'>Create account</p>
						<h2>Start with the basics.</h2>
						<p>Use your email to create a workspace you can grow into.</p>
					</div>
					<form className='auth-form' onSubmit={handleSubmit} noValidate autoComplete='on'>
						<div className='auth-field'>
							<label htmlFor='email'>Email address</label>
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
										if (event.key === 'Enter') {
											event.preventDefault()
											handleEmailContinue()
										}
									}}
									placeholder='you@example.com'
									required
									aria-invalid={Boolean(fieldErrors.email)}
									aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
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
								<p className='auth-field-error' id='signup-email-error' role='alert'>
									{fieldErrors.email}
								</p>
							)}
						</div>
						{!emailLocked ? (
							<button
								type='button'
								className='auth-submit'
								onClick={handleEmailContinue}
							>
								Continue <ArrowRight size={16} />
							</button>
						) : (
							<>
								<div className='auth-field'>
									<label htmlFor='password'>Password</label>
									<div className='auth-input-wrap'>
										<input
											id='password'
											name='password'
											type={passwordVisible ? 'text' : 'password'}
											value={formData.password}
											onChange={handleChange}
											placeholder='Create a password'
											required
											aria-invalid={Boolean(fieldErrors.password)}
											aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
										/>
										<button
											type='button'
											onClick={() => setPasswordVisible((value) => !value)}
											className='auth-input-action'
											aria-label={
												passwordVisible ? 'Hide password' : 'Show password'
											}
											title={
												passwordVisible ? 'Hide password' : 'Show password'
											}
										>
											{passwordVisible ? (
												<EyeOff size={16} />
											) : (
												<Eye size={16} />
											)}
										</button>
									</div>
									{fieldErrors.password && (
										<p className='auth-field-error' id='signup-password-error' role='alert'>
											{fieldErrors.password}
										</p>
									)}
									{formData.password && (
										<div className={`password-strength ${passwordStrength}`}>
											<div className='password-strength-heading'>
												<span>Password strength</span>
												<strong>{passwordStrength}</strong>
											</div>
											<div className='password-strength-bars'>
												<span className={passwordScore >= 1 ? 'filled' : ''} />
												<span className={passwordScore >= 2 ? 'filled' : ''} />
												<span className={passwordScore >= 3 ? 'filled' : ''} />
												<span className={passwordScore >= 4 ? 'filled' : ''} />
											</div>
											<div className='password-requirements'>
												<span className={passwordChecks.length ? 'met' : ''}>
													{passwordChecks.length ? (
														<CheckCircle2 size={13} />
													) : (
														<Circle size={13} />
													)}{' '}
													8+ characters
												</span>
												<span className={passwordChecks.uppercase ? 'met' : ''}>
													{passwordChecks.uppercase ? (
														<CheckCircle2 size={13} />
													) : (
														<Circle size={13} />
													)}{' '}
													Uppercase letter
												</span>
												<span className={passwordChecks.number ? 'met' : ''}>
													{passwordChecks.number ? (
														<CheckCircle2 size={13} />
													) : (
														<Circle size={13} />
													)}{' '}
													Number
												</span>
												<span className={passwordChecks.special ? 'met' : ''}>
													{passwordChecks.special ? (
														<CheckCircle2 size={13} />
													) : (
														<Circle size={13} />
													)}{' '}
													Special character
												</span>
											</div>
										</div>
									)}
								</div>
								<div className='auth-field'>
									<label htmlFor='confirmPassword'>Confirm password</label>
									<div className='auth-input-wrap'>
										<input
											id='confirmPassword'
											name='confirmPassword'
											type={confirmVisible ? 'text' : 'password'}
											value={formData.confirmPassword}
											onChange={handleChange}
											placeholder='Repeat your password'
											required
											className={
												passwordMismatch
													? 'password-input-mismatch'
													: passwordsMatch
														? 'password-input-match'
															: fieldErrors.confirmPassword
																? 'password-input-mismatch'
																: ''
											}
											aria-invalid={Boolean(fieldErrors.confirmPassword)}
											aria-describedby={fieldErrors.confirmPassword ? 'signup-confirm-error' : undefined}
										/>
										<button
											type='button'
											onClick={() => setConfirmVisible((value) => !value)}
											className='auth-input-action'
											aria-label={
												confirmVisible ? 'Hide password' : 'Show password'
											}
											title={confirmVisible ? 'Hide password' : 'Show password'}
										>
											{confirmVisible ? (
												<EyeOff size={16} />
											) : (
												<Eye size={16} />
											)}
										</button>
									</div>
									{fieldErrors.confirmPassword ? (
										<p className='auth-field-error' id='signup-confirm-error' role='alert'>
											{fieldErrors.confirmPassword}
										</p>
									) : passwordMismatch && (
										<p className='password-match-message mismatch'>
											Passwords do not match
										</p>
									)}
									{passwordsMatch && (
										<p className='password-match-message match'>
											Passwords match
										</p>
									)}
								</div>
								<button
									type='submit'
									className='auth-submit'
									disabled={isSigningUp || passwordMismatch}
								>
									{isSigningUp ? (
										'Creating account...'
									) : (
										<>
											Create account <ArrowRight size={16} />
										</>
									)}
								</button>
							</>
						)}
					</form>
					{!emailLocked && (
						<>
							<div className='auth-divider'>
								<span>or sign up with</span>
							</div>
							<div className='auth-providers'>
								<AuthButton provider='google' onClick={handleGoogleSignup} />
								<AuthButton
									provider='microsoft'
									onClick={handleMicrosoftSignIn}
								/>
								<AuthButton provider='apple' onClick={handleAppleSignIn} />
							</div>
						</>
					)}
					<p className='auth-footer-copy'>
						Already have an account?{' '}
						<Link to='/login'>
							Log in <ArrowRight size={14} />
						</Link>
					</p>
				</section>
			</div>
		</div>
	)
}

export default Signup
