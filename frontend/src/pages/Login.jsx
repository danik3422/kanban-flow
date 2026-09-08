import {
	ArrowRight,
	Check,
	Eye,
	EyeOff,
	LockKeyhole,
	Pencil,
	ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../store/useAuthStore'
import AuthButton from '../ui/AuthButton'

const Login = () => {
	const { login, handleGoogleSignin, isLoggingIn } = useAuthStore()

	const [formData, setFormData] = useState({ email: '', password: '' })
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [emailLocked, setEmailLocked] = useState(false)

	const handleChange = (e) => {
		const { name, value } = e.target
		setFormData((prev) => ({ ...prev, [name]: value }))
	}

	const handleContinue = (e) => {
		e.preventDefault()
		if (formData.email.trim()) {
			setEmailLocked(true)
		}
	}

	const handleLogin = (e) => {
		e.preventDefault()
		login(formData)
	}

	const handleEditEmail = () => {
		setEmailLocked(false)
		setFormData((prev) => ({ ...prev, password: '' }))
	}

	const handleGoogleSignIn = async () => {
		await handleGoogleSignin()
	}

	const handleMicrosoftSignIn = () =>
		toast.info('Microsoft sign-in not implemented yet')

	const handleAppleSignIn = () =>
		toast.info('Apple sign-in not implemented yet')

	return (
		<div className='auth-page'>
			<div className='auth-layout'>
				<section className='auth-intro'>
					<div className='auth-intro-copy'><p className='eyebrow'>Welcome back</p><h1>Pick up where good work left off.</h1><p>Keep your projects clear, your team aligned, and your next step easy to find.</p></div>
					<div className='auth-preview'><div className='auth-preview-top'><span>Today</span><ShieldCheck size={16} /></div><div className='auth-progress'><span /><span /><span /><span /></div><strong>Make progress visible.</strong><p>4 focused tasks · 1 board</p><div className='auth-check-list'><span><Check size={13} /> Review priorities</span><span><Check size={13} /> Move one card forward</span></div></div>
					<div className='auth-trust'><LockKeyhole size={15} /> Your workspace stays private and focused.</div>
				</section>

				<section className='auth-form-panel'>
					<div className='auth-form-heading'><p className='eyebrow'>Sign in</p><h2>Welcome back.</h2><p>Enter your email to continue to your workspace.</p></div>
					<form className='auth-form' onSubmit={emailLocked ? handleLogin : handleContinue}>
						<div className='auth-field'><label htmlFor='email'>Email address</label><div className='auth-input-wrap'><input id='email' name='email' type='email' value={formData.email} onChange={handleChange} placeholder='you@example.com' required readOnly={emailLocked} />{emailLocked && <button type='button' onClick={handleEditEmail} className='auth-input-action' aria-label='Edit email' title='Edit email'><Pencil size={16} /></button>}</div></div>
						{emailLocked && <div className='auth-field'><div className='auth-label-row'><label htmlFor='password'>Password</label><Link to='/login/resetpassword'>Forgot password?</Link></div><div className='auth-input-wrap'><input id='password' name='password' type={passwordVisible ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder='Enter your password' required /><button type='button' onClick={() => setPasswordVisible(!passwordVisible)} className='auth-input-action' aria-label={passwordVisible ? 'Hide password' : 'Show password'} title={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>}
						<button type='submit' className='auth-submit' disabled={isLoggingIn}>{isLoggingIn ? 'Signing in...' : emailLocked ? <>Sign in <ArrowRight size={16} /></> : <>Continue <ArrowRight size={16} /></>}</button>
					</form>
					<div className='auth-divider'><span>or continue with</span></div>
					<div className='auth-providers'><AuthButton provider='google' onClick={handleGoogleSignIn} /><AuthButton provider='microsoft' onClick={handleMicrosoftSignIn} /><AuthButton provider='apple' onClick={handleAppleSignIn} /></div>
					<p className='auth-footer-copy'>New to Kanban? <Link to='/signup'>Create your account <ArrowRight size={14} /></Link></p>
				</section>
			</div>
		</div>
	)
}

export default Login
