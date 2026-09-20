import { ArrowLeft, ArrowRight, CheckCircle2, MailWarning, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'

const RESEND_COOLDOWN_KEY = 'kanban-email-resend-cooldown'

const readStoredResendCooldown = () => {
	const storedValue = window.sessionStorage.getItem(RESEND_COOLDOWN_KEY)
	if (!storedValue) return 0

	const expiresAt = Number(storedValue)
	if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
		window.sessionStorage.removeItem(RESEND_COOLDOWN_KEY)
		return 0
	}

	const remainingSeconds = Math.ceil((expiresAt - Date.now()) / 1000)
	if (remainingSeconds <= 0) {
		window.sessionStorage.removeItem(RESEND_COOLDOWN_KEY)
		return 0
	}

	return remainingSeconds
}

const persistResendCooldown = (seconds) => {
	const nextSeconds = Math.max(0, Math.ceil(seconds))
	if (nextSeconds <= 0) {
		window.sessionStorage.removeItem(RESEND_COOLDOWN_KEY)
		return
	}

	const expiresAt = Date.now() + nextSeconds * 1000
	window.sessionStorage.setItem(RESEND_COOLDOWN_KEY, String(expiresAt))
}

const getRetryAfterSeconds = (value) => {
	const numericValue = Number(value)
	if (!Number.isFinite(numericValue) || numericValue <= 0) {
		return 0
	}
	return Math.ceil(numericValue)
}

const VerifyEmail = () => {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const token = searchParams.get('token')
	const { authUser, checkAuth, logout } = useAuthStore()
	const [status, setStatus] = useState(token ? 'pending' : 'idle')
	const [message, setMessage] = useState('')
	const [isResending, setIsResending] = useState(false)
	const [resendStatus, setResendStatus] = useState('idle')
	const [resendCooldown, setResendCooldown] = useState(() => readStoredResendCooldown())

	// Check authentication on mount - allow users with unverified email
	useEffect(() => {
		if (!authUser) {
			// Unauthenticated users are redirected without showing a logout error.
			navigate('/login', { replace: true })
		}
	}, [authUser, navigate])

	// Auto-verify if token is present
	useEffect(() => {
		if (!token || !authUser) {
			return
		}

		const cleanUrl = new URL(window.location.href)
		cleanUrl.searchParams.delete('token')
		window.history.replaceState(
			window.history.state,
			document.title,
			`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
		)

		const verify = async () => {
			try {
				await axiosInstance.post('/auth/verify-email', { token })
				await checkAuth()
				toast.success('Email verified successfully')
				navigate('/setup-profile', { replace: true })
			} catch (error) {
				setStatus('error')
				const errorMsg = error.response?.data?.message
				setMessage(
					errorMsg || 'Your verification link is invalid or expired.'
				)
				toast.error(errorMsg || 'Could not verify email')
			}
		}

		verify()
	}, [token, authUser, checkAuth, navigate])

	// Countdown timer
	useEffect(() => {
		if (resendCooldown <= 0) {
			window.sessionStorage.removeItem(RESEND_COOLDOWN_KEY)
			return undefined
		}
		const timer = window.setTimeout(() => {
			setResendCooldown(prev => {
				const next = Math.max(0, prev - 1)
				if (next <= 0) {
					window.sessionStorage.removeItem(RESEND_COOLDOWN_KEY)
					return 0
				}
				persistResendCooldown(next)
				return next
			})
		}, 1000)
		return () => window.clearTimeout(timer)
	}, [resendCooldown])

	const handleResend = async () => {
		if (!authUser || !authUser.email) {
			toast.error('Unable to resend: User information missing')
			return
		}

		setIsResending(true)
		try {
			const response = await axiosInstance.post('/auth/verify-email/resend', {
				email: authUser.email,
			})
			const retryAfter = getRetryAfterSeconds(response.data.retryAfter) || 60
			setResendStatus('cooldown')
			setResendCooldown(retryAfter)
			persistResendCooldown(retryAfter)
			toast.success('Verification link sent! Check your inbox.')
		} catch (error) {
			const errorMsg = error.response?.data?.message
			const retryAfter =
				getRetryAfterSeconds(error.response?.data?.retryAfter) ||
				getRetryAfterSeconds(error.response?.headers?.['retry-after']) ||
				60
			
			if (error.response?.status === 429) {
				setResendStatus('cooldown')
				setResendCooldown(retryAfter)
				persistResendCooldown(retryAfter)
				toast.error(`Please wait ${formatCooldown(retryAfter)} before requesting another link`)
			} else {
				toast.error(errorMsg || 'Could not send verification email. Try again later.')
			}
		} finally {
			setIsResending(false)
		}
	}

	const handleLogout = async () => {
		await logout()
		navigate('/login', { replace: true })
	}

	const heading =
		status === 'success'
			? 'Email verified'
			: status === 'error'
				? 'Verification failed'
				: 'Check your inbox'

	const description =
		status === 'success'
			? message
			: status === 'error'
				? message
				: 'We sent a verification link to your email address. Open it to activate your account.'

	if (!authUser) {
		return null // Redirect is handled in useEffect
	}

	return (
		<div className='auth-page'>
			<div className='auth-layout reset-layout'>
				<section className='auth-intro'>
					<div className='auth-intro-copy'>
						<p className='eyebrow'>Account activation</p>
						<h1>One final step before you begin.</h1>
						<p>Verify your email to activate your workspace and continue with confidence.</p>
					</div>
					<div className='auth-preview reset-preview'>
						<div className='auth-preview-top'>
							<span>Account security</span>
							<ShieldCheck size={16} />
						</div>
						<div className='reset-icon'>
							<MailWarning size={22} />
						</div>
						<strong>Email verification</strong>
						<p>{authUser?.email || 'Check your inbox for the confirmation email.'}</p>
						<div className='auth-check-list'>
							<span><CheckCircle2 size={13} /> Open the verification email</span>
							<span><CheckCircle2 size={13} /> Confirm your account</span>
							<span><CheckCircle2 size={13} /> Continue to your workspace</span>
						</div>
					</div>
				</section>

				<section className='auth-form-panel'>
					<div className='auth-form-heading'>
						<p className='eyebrow'>Verify email</p>
						<h2>{heading}</h2>
						<p>{description}</p>
					</div>

					{status === 'idle' && (
						<VerificationActions
						userEmail={authUser?.email}
							isResending={isResending}
							resendCooldown={resendCooldown}
							resendStatus={resendStatus}
							onResend={handleResend}
							onLogout={handleLogout}
						/>
					)}

					{status === 'success' && (
						<div className='reset-success'>
							<div className='reset-success-icon'>
								<CheckCircle2 size={24} />
							</div>
							<h3>Everything is ready</h3>
							<p>{message}</p>
							<Link to='/' className='auth-submit'>Go to dashboard <ArrowRight size={16} /></Link>
						</div>
					)}

					{status === 'error' && (
						<VerificationActions
						userEmail={authUser?.email}
							isResending={isResending}
							resendCooldown={resendCooldown}
							resendStatus={resendStatus}
							onResend={handleResend}
							onLogout={handleLogout}
							isExpired
						/>
					)}
				</section>
			</div>
		</div>
	)
}

const VerificationActions = ({
	userEmail,
	isExpired = false,
	isResending,
	resendCooldown,
	resendStatus,
	onResend,
	onLogout,
}) => {
	if (!userEmail) {
		return (
			<div className='reset-success'>
				<div className='reset-success-icon'><MailWarning size={24} /></div>
				<h3>Sign in to request verification</h3>
				<p>You need to be logged in to verify your email address.</p>
				<button type='button' className='auth-submit' onClick={onLogout}><ArrowLeft size={16} /> Back to login</button>
			</div>
		)
	}

	return (
		<div className='verification-actions-card'>
			<div className='verification-email-label'>Verification email</div>
			<div className='verification-email' title={userEmail}>{userEmail}</div>
			<p className='verification-help'>
				{isExpired
					? 'This link is no longer valid. We can send a fresh one to this address.'
					: 'Check your inbox and Spam folder. The link expires after one hour.'}
			</p>
			<button
				className='auth-submit'
				type='button'
				onClick={onResend}
				disabled={isResending || resendCooldown > 0}
			>
				{isResending
					? 'Sending…'
					: resendCooldown > 0
						? `Resend in ${formatCooldown(resendCooldown)}`
						: 'Resend verification email'}
			</button>
			{resendStatus === 'sent' && resendCooldown === 0 && (
				<p className='verification-sent' role='status'>A fresh link is on its way. Check your inbox and Spam folder.</p>
			)}
			<button type='button' className='verification-back-link' onClick={onLogout}><ArrowLeft size={15} /> Back to login</button>
		</div>
	)
}

const formatCooldown = (seconds) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export default VerifyEmail
