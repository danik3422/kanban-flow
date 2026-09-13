import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Eye,
	EyeOff,
	LockKeyhole,
	Mail,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'

const AUTH_EMAIL_KEY = 'kanban-auth-email'

const ResetPassword = () => {
	const navigate = useNavigate()
	const [email, setEmail] = useState(
		() => sessionStorage.getItem(AUTH_EMAIL_KEY) || '',
	)
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isValidatingToken, setIsValidatingToken] = useState(false)
	const [tokenError, setTokenError] = useState('')
	const [tokenStatus, setTokenStatus] = useState('')
	const [isTokenValid, setIsTokenValid] = useState(false)

	const token = new URLSearchParams(window.location.search).get('token')
	const isPasswordReset = Boolean(token)
	const validationStartedRef = useRef(false)

	useEffect(() => {
		if (!token) {
			return
		}

		if (validationStartedRef.current) return

		validationStartedRef.current = true

		const cleanUrl = new URL(window.location.href)
		cleanUrl.searchParams.delete('token')
		window.history.replaceState(
			window.history.state,
			document.title,
			`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
		)

		let ignore = false

		const validateToken = async () => {
			setIsValidatingToken(true)
			try {
				const { data } = await axiosInstance.get(
					'/auth/password-reset/validate',
					{
						params: { token },
					},
				)

				if (!ignore) {
					setIsTokenValid(true)
					setEmail(data.email || '')
					if (data.email) sessionStorage.setItem(AUTH_EMAIL_KEY, data.email)
				}
			} catch (error) {
				if (!ignore) {
					setIsTokenValid(false)
					setTokenStatus(error.response?.data?.code || 'invalid')
					setTokenError(
						error.response?.data?.message ||
							'Reset link is invalid or expired.',
					)
				}
			} finally {
				if (!ignore) setIsValidatingToken(false)
			}
		}

		validateToken()

		return () => {
			ignore = true
			validationStartedRef.current = false
		}
	}, [token])

	useEffect(() => {
		if (isSubmitted) return undefined

		const handleKeyDown = (event) => {
			if (event.key === 'Escape') navigate('/login')
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [isSubmitted, navigate])

	const showTokenErrorState =
		isPasswordReset && !isTokenValid && !isValidatingToken && tokenError
	const tokenErrorTitle =
		tokenStatus === 'expired' ? 'Reset link expired' : 'Reset link expired'

	const shouldShowPasswordForm = isPasswordReset && isTokenValid && !isSubmitted
	const shouldShowCheckingState =
		isPasswordReset && !isTokenValid && isValidatingToken

	const handleSubmit = async (e) => {
		e.preventDefault()

		if (isPasswordReset) {
			if (!token) {
				toast.error('Reset token is missing.')
				return
			}

			if (!isTokenValid) {
				toast.error(tokenError || 'This reset link is no longer valid.')
				return
			}

			if (password !== confirmPassword) {
				toast.error('Passwords do not match')
				return
			}
		}

		setIsSubmitting(true)
		try {
			if (isPasswordReset) {
				await axiosInstance.post('/auth/password-reset/confirm', {
					token,
					password,
				})

				toast.success('Password updated successfully')
				setIsSubmitted(true)
				setTimeout(() => navigate('/login', { replace: true }), 1800)
			} else {
				await axiosInstance.post('/auth/password-reset/request', { email })
				setIsSubmitted(true)
				toast.success(
					'If an account exists for this email, a reset link has been sent.',
				)
			}
		} catch (error) {
			toast.error(error.response?.data?.message || 'Password reset failed')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div className='auth-page'>
			<div className='auth-layout reset-layout'>
				<section className='auth-intro'>
					<div className='auth-intro-copy'>
						<p className='eyebrow'>Account recovery</p>
						<h1>A clear path back to your workspace.</h1>
						<p>
							We will help you get back in without losing the rhythm of your
							work.
						</p>
					</div>
					<div className='auth-preview reset-preview'>
						<div className='auth-preview-top'>
							<span>Account security</span>
							<LockKeyhole size={16} />
						</div>
						<div className='reset-icon'>
							<Mail size={22} />
						</div>
						<strong>One step at a time.</strong>
						<p>Use the email connected to your KanbanHub account.</p>
					</div>
				</section>

				<section className='auth-form-panel'>
					<div className='auth-form-heading'>
						<p className='eyebrow'>
							{isPasswordReset ? 'New password' : 'Reset password'}
						</p>
						<h2>
							{isPasswordReset
								? 'Choose a new password.'
								: 'Need a fresh start?'}
						</h2>
						<p>
							{isPasswordReset
								? 'Create a new password for your KanbanHub account.'
								: 'Enter your email and we will send you a secure reset link.'}
						</p>
					</div>

					{isSubmitted ? (
						<div className='reset-success'>
							<div className='reset-success-icon'>
								<CheckCircle2 size={24} />
							</div>
							<h3>
								{isPasswordReset ? 'Password updated' : 'Request submitted'}
							</h3>
							<p>
								{isPasswordReset
									? 'Your password has been changed. You can now sign in with the new password.'
									: 'If an account exists for this email, a reset link has been sent.'}
							</p>
							<Link to='/login' className='auth-secondary-button'>
								<ArrowLeft size={16} /> Back to login
							</Link>
						</div>
					) : showTokenErrorState ? (
						<div className='reset-success'>
							<div className='reset-success-icon'>
								<LockKeyhole size={24} />
							</div>
							<h3>{tokenErrorTitle}</h3>
							<p>{tokenError}</p>
							<Link to='/login' className='auth-secondary-button'>
								<ArrowLeft size={16} /> Back to login
							</Link>
						</div>
					) : shouldShowCheckingState ? (
						<div className='reset-success'>
							<div className='reset-success-icon'>
								<LockKeyhole size={24} />
							</div>
							<h3>Reset link expired</h3>
							<p>Please wait while we verify your secure link.</p>
						</div>
					) : (
						<form className='auth-form' onSubmit={handleSubmit}>
							{shouldShowPasswordForm ? (
								<>
									<div className='auth-field'>
										<label htmlFor='new-password'>New password</label>
										<div className='auth-input-wrap'>
											<input
												id='new-password'
												type={showPassword ? 'text' : 'password'}
												value={password}
												onChange={(event) => setPassword(event.target.value)}
												placeholder='At least 8 characters'
												minLength={8}
												autoComplete='new-password'
												required
											/>
											<button
												type='button'
												className='auth-input-action'
												onClick={() => setShowPassword((value) => !value)}
												aria-label={
													showPassword ? 'Hide password' : 'Show password'
												}
												title={showPassword ? 'Hide password' : 'Show password'}
											>
												{showPassword ? (
													<EyeOff size={16} />
												) : (
													<Eye size={16} />
												)}
											</button>
										</div>
									</div>

									<div className='auth-field'>
										<label htmlFor='confirm-reset-password'>
											Confirm new password
										</label>
										<div className='auth-input-wrap'>
											<input
												id='confirm-reset-password'
												type={showConfirmPassword ? 'text' : 'password'}
												value={confirmPassword}
												onChange={(event) =>
													setConfirmPassword(event.target.value)
												}
												placeholder='Repeat your password'
												minLength={8}
												autoComplete='new-password'
												required
											/>
											<button
												type='button'
												className='auth-input-action'
												onClick={() =>
													setShowConfirmPassword((value) => !value)
												}
												aria-label={
													showConfirmPassword
														? 'Hide password'
														: 'Show password'
												}
												title={
													showConfirmPassword
														? 'Hide password'
														: 'Show password'
												}
											>
												{showConfirmPassword ? (
													<EyeOff size={16} />
												) : (
													<Eye size={16} />
												)}
											</button>
										</div>
									</div>

									<button
										type='submit'
										className='auth-submit'
										disabled={isSubmitting}
									>
										{isSubmitting ? 'Updating...' : 'Update password'}
										<ArrowRight size={16} />
									</button>
								</>
							) : (
								<>
									<div className='auth-field'>
										<label htmlFor='reset-email'>Email address</label>
										<div className='auth-input-wrap'>
											<input
												id='reset-email'
												type='email'
												name='email'
												value={email}
												onChange={(event) => {
													setEmail(event.target.value)
													sessionStorage.setItem(
														AUTH_EMAIL_KEY,
														event.target.value,
													)
												}}
												placeholder='you@example.com'
												autoComplete='email'
												autoFocus={!isPasswordReset}
												required
											/>
										</div>
									</div>

									<button
										type='submit'
										className='auth-submit'
										disabled={isSubmitting}
									>
										{isSubmitting ? 'Sending...' : 'Send reset link'}
										<ArrowRight size={16} />
									</button>
								</>
							)}
						</form>
					)}

					{!isSubmitted && !showTokenErrorState && !shouldShowCheckingState && (
						<p className='auth-footer-copy'>
							<Link to='/login' className='auth-secondary-link'>
								<ArrowLeft size={16} /> Back to login
							</Link>
						</p>
					)}
				</section>
			</div>
		</div>
	)
}

export default ResetPassword
