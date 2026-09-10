import { ArrowRight, CheckCircle2, MailWarning, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'

const VerifyEmail = () => {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const email = searchParams.get('email') || ''
	const token = searchParams.get('token')
	const [status, setStatus] = useState(token ? 'pending' : 'idle')
	const [message, setMessage] = useState('')

	useEffect(() => {
		if (!token) {
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
				setStatus('success')
				setMessage('Your email has been verified successfully.')
				toast.success('Email verified successfully')
				setTimeout(() => navigate('/login', { replace: true }), 1800)
			} catch (error) {
				setStatus('error')
				setMessage(
					error.response?.data?.message ||
						'Your verification link is invalid or expired.'
				)
				toast.error('Could not verify email')
			}
		}

		verify()
	}, [token, navigate])

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
						<p>{email || 'Check your inbox for the confirmation email.'}</p>
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
						<div className='reset-success'>
							<div className='reset-success-icon'>
								<MailWarning size={24} />
							</div>
							<h3>Verification link needed</h3>
							<p>
								{email
									? `We need to verify ${email} before you can continue.`
									: 'Please check the email you used to create the account.'}
							</p>
							<div className='auth-actions'>
								<Link to='/login' className='auth-submit'>Back to login <ArrowRight size={16} /></Link>
							</div>
						</div>
					)}

					{status === 'success' && (
						<div className='reset-success'>
							<div className='reset-success-icon'>
								<CheckCircle2 size={24} />
							</div>
							<h3>Everything is ready</h3>
							<p>{message}</p>
							<Link to='/login' className='auth-submit'>Go to login <ArrowRight size={16} /></Link>
						</div>
					)}

					{status === 'error' && (
						<div className='reset-success'>
							<div className='reset-success-icon'>
								<MailWarning size={24} />
							</div>
							<h3>Unable to verify</h3>
							<p>{message}</p>
							<div className='auth-actions'>
								<Link to='/login' className='auth-submit'>Back to login <ArrowRight size={16} /></Link>
							</div>
						</div>
					)}
				</section>
			</div>
		</div>
	)
}

export default VerifyEmail
