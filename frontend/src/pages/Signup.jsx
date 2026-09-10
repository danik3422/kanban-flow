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
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { translations } from '../lib/translations'
import { useAuthStore } from '../store/useAuthStore'
import AuthButton from '../ui/AuthButton'

const Signup = () => {
	const { authUser } = useAuthStore()
	const currentLanguage = authUser?.language || document.documentElement.lang || 'en'
	const t = translations[currentLanguage] || translations.en
	const [formData, setFormData] = useState({
		email: '',
		password: '',
		confirmPassword: '',
	})

	const [emailLocked, setEmailLocked] = useState(false)
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [confirmVisible, setConfirmVisible] = useState(false)

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
	const passwordStrength = passwordScore <= 1 ? 'weak' : passwordScore <= 3 ? 'medium' : 'strong'
	const passwordsMatch = formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword
	const passwordMismatch = formData.confirmPassword.length > 0 && !passwordsMatch

	const handleChange = (e) => {
		const { name, value } = e.target
		setFormData((prev) => ({ ...prev, [name]: value }))
	}

	const handleEmailContinue = () => {
		if (formData.email.trim()) setEmailLocked(true)
	}

	const handleEditEmail = () => {
		setEmailLocked(false)
		setFormData((prev) => ({
			...prev,
			password: '',
			confirmPassword: '',
		}))
	}

	const handleSubmit = async (e) => {
		e.preventDefault()

		if (formData.password !== formData.confirmPassword) {
			toast.error('Passwords do not match')
			return
		}

		const result = await signup({
			email: formData.email,
			password: formData.password,
		})

		if (result?.success && result.requiresVerification) {
			navigate(`/login/verify-email?email=${encodeURIComponent(formData.email)}`)
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
					<div className='auth-intro-copy'><p className='eyebrow'>{t.signup.eyebrow}</p><h1>{t.signup.title}</h1><p>{t.signup.subtitle}</p></div>
					<div className='auth-preview'><div className='auth-preview-top'><span>Your first board</span><ShieldCheck size={16} /></div><div className='auth-progress'><span /><span /><span /><span /></div><strong>Build your working rhythm.</strong><p>Start with a board, then make it yours.</p><div className='auth-check-list'><span><Check size={13} /> Add your first project</span><span><Check size={13} /> Invite your team when ready</span></div></div>
					<div className='auth-trust'><LockKeyhole size={15} /> Simple setup. Private by default.</div>
				</section>

				<section className='auth-form-panel'>
					<div className='auth-form-heading'><p className='eyebrow'>Create account</p><h2>Start with the basics.</h2><p>Use your email to create a workspace you can grow into.</p></div>
						<form className='auth-form' onSubmit={handleSubmit} autoComplete='on'>
							<div className='auth-field'><label htmlFor='email'>Email address</label><div className='auth-input-wrap'><input id='email' name='email' type='email' value={formData.email} onChange={handleChange} placeholder='you@example.com' required autoComplete='username' inputMode='email' />{emailLocked && <button type='button' onClick={handleEditEmail} className='auth-input-action' aria-label='Edit email' title='Edit email'><Pencil size={16} /></button>}</div></div>
						{!emailLocked ? <button type='button' className='auth-submit' onClick={handleEmailContinue}>Continue <ArrowRight size={16} /></button> : <><div className='auth-field'><label htmlFor='password'>Password</label><div className='auth-input-wrap'><input id='password' name='password' type={passwordVisible ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder='Create a password' required /><button type='button' onClick={() => setPasswordVisible((value) => !value)} className='auth-input-action' aria-label={passwordVisible ? 'Hide password' : 'Show password'} title={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{formData.password && <div className={`password-strength ${passwordStrength}`}><div className='password-strength-heading'><span>Password strength</span><strong>{passwordStrength}</strong></div><div className='password-strength-bars'><span className={passwordScore >= 1 ? 'filled' : ''} /><span className={passwordScore >= 2 ? 'filled' : ''} /><span className={passwordScore >= 3 ? 'filled' : ''} /><span className={passwordScore >= 4 ? 'filled' : ''} /></div><div className='password-requirements'><span className={passwordChecks.length ? 'met' : ''}>{passwordChecks.length ? <CheckCircle2 size={13} /> : <Circle size={13} />} 8+ characters</span><span className={passwordChecks.uppercase ? 'met' : ''}>{passwordChecks.uppercase ? <CheckCircle2 size={13} /> : <Circle size={13} />} Uppercase letter</span><span className={passwordChecks.number ? 'met' : ''}>{passwordChecks.number ? <CheckCircle2 size={13} /> : <Circle size={13} />} Number</span><span className={passwordChecks.special ? 'met' : ''}>{passwordChecks.special ? <CheckCircle2 size={13} /> : <Circle size={13} />} Special character</span></div></div>}</div><div className='auth-field'><label htmlFor='confirmPassword'>Confirm password</label><div className='auth-input-wrap'><input id='confirmPassword' name='confirmPassword' type={confirmVisible ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange} placeholder='Repeat your password' required className={passwordMismatch ? 'password-input-mismatch' : passwordsMatch ? 'password-input-match' : ''} /><button type='button' onClick={() => setConfirmVisible((value) => !value)} className='auth-input-action' aria-label={confirmVisible ? 'Hide password' : 'Show password'} title={confirmVisible ? 'Hide password' : 'Show password'}>{confirmVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{passwordMismatch && <p className='password-match-message mismatch'>Passwords do not match</p>}{passwordsMatch && <p className='password-match-message match'>Passwords match</p>}</div><button type='submit' className='auth-submit' disabled={isSigningUp || passwordMismatch}>{isSigningUp ? 'Creating account...' : <>Create account <ArrowRight size={16} /></>}</button></>}
					</form>
					{!emailLocked && <><div className='auth-divider'><span>or sign up with</span></div><div className='auth-providers'><AuthButton provider='google' onClick={handleGoogleSignup} /><AuthButton provider='microsoft' onClick={handleMicrosoftSignIn} /><AuthButton provider='apple' onClick={handleAppleSignIn} /></div></>}
					<p className='auth-footer-copy'>Already have an account? <Link to='/login'>Log in <ArrowRight size={14} /></Link></p>
				</section>
			</div>
		</div>
	)
}

export default Signup
