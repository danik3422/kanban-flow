import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'

const ResetPassword = () => {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const token = new URLSearchParams(window.location.search).get('token')
	const isPasswordReset = Boolean(token)

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (isPasswordReset && password !== confirmPassword) {
			toast.error('Passwords do not match')
			return
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
			} else {
				await axiosInstance.post('/auth/password-reset/request', { email })
				setIsSubmitted(true)
				toast.success('Reset link sent')
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
					<div className='auth-intro-copy'><p className='eyebrow'>Account recovery</p><h1>A clear path back to your workspace.</h1><p>We will help you get back in without losing the rhythm of your work.</p></div>
					<div className='auth-preview reset-preview'><div className='auth-preview-top'><span>Account security</span><LockKeyhole size={16} /></div><div className='reset-icon'><Mail size={22} /></div><strong>One step at a time.</strong><p>Use the email connected to your Kanban account.</p></div>
				</section>

				<section className='auth-form-panel'>
					<div className='auth-form-heading'><p className='eyebrow'>{isPasswordReset ? 'New password' : 'Reset password'}</p><h2>{isPasswordReset ? 'Choose a new password.' : 'Need a fresh start?'}</h2><p>{isPasswordReset ? 'Create a new password for your Kanban account.' : 'Enter your email and we will send you a secure reset link.'}</p></div>
					{isSubmitted ? <div className='reset-success'><div className='reset-success-icon'><CheckCircle2 size={24} /></div><h3>{isPasswordReset ? 'Password updated' : 'Check your inbox'}</h3><p>{isPasswordReset ? 'Your password has been changed. You can now sign in with the new password.' : 'If an account exists for this email, you will receive a reset link shortly.'}</p><Link to='/login' className='auth-submit'>Back to login <ArrowRight size={16} /></Link></div> : <form className='auth-form' onSubmit={handleSubmit}>{isPasswordReset ? <><div className='auth-field'><label htmlFor='new-password'>New password</label><div className='auth-input-wrap'><input id='new-password' type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder='At least 8 characters' minLength={8} required /><button type='button' className='auth-input-action' onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div><div className='auth-field'><label htmlFor='confirm-reset-password'>Confirm new password</label><div className='auth-input-wrap'><input id='confirm-reset-password' type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder='Repeat your password' minLength={8} required /><button type='button' className='auth-input-action' onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} title={showConfirmPassword ? 'Hide password' : 'Show password'}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div></> : <div className='auth-field'><label htmlFor='reset-email'>Email address</label><div className='auth-input-wrap'><input id='reset-email' type='email' value={email} onChange={(event) => setEmail(event.target.value)} placeholder='you@example.com' required /><Mail className='auth-input-icon' size={16} /></div></div>}<button type='submit' className='auth-submit' disabled={isSubmitting}>{isSubmitting ? 'Working...' : isPasswordReset ? <>Update password <ArrowRight size={16} /></> : <>Send reset link <ArrowRight size={16} /></>}</button></form>}
					<p className='auth-footer-copy'><Link to='/login'><ArrowLeft size={14} /> Back to login</Link></p>
				</section>
			</div>
		</div>
	)
}

export default ResetPassword
