import { Eye, EyeOff, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../store/useAuthStore'
import AuthButton from '../ui/AuthButton'

const Signup = () => {
	const [formData, setFormData] = useState({
		email: '',
		password: '',
		confirmPassword: '',
	})

	const [emailLocked, setEmailLocked] = useState(false)
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [confirmVisible, setConfirmVisible] = useState(false)

	const signup = useAuthStore((state) => state.signup)
	const handleGoogleSignup = useAuthStore((state) => state.handleGoogleSignup)
	const isSigningUp = useAuthStore((state) => state.isSigningUp)

	const navigate = useNavigate()

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

		const success = await signup({
			email: formData.email,
			password: formData.password,
		})

		if (success) {
			navigate('/enter-name')
		}
	}

	const handleMicrosoftSignIn = () =>
		toast.info('Microsoft sign-in not implemented yet')
	const handleAppleSignIn = () =>
		toast.info('Apple sign-in not implemented yet')

	return (
		<div className='min-h-screen flex items-center justify-center px-4 bg-base-100'>
			<div className='w-full max-w-sm card bg-base-200 shadow-xl p-8'>
				<div className='flex justify-center mb-6'>
					<img
						src='https://cdn.worldvectorlogo.com/logos/trello.svg'
						alt='Trello'
						className='h-10'
						onError={(e) => (e.target.style.display = 'none')}
					/>
				</div>

				<h2 className='text-center text-xl font-bold text-base-content mb-6'>
					Create your account
				</h2>

				<form onSubmit={handleSubmit}>
					{/* Email Input */}
					<div className='form-control mb-4'>
						<label className='label' htmlFor='email'>
							<span className='label-text font-medium'>
								Email <span className='text-red-500'>*</span>
							</span>
						</label>
						<div className='relative'>
							<input
								id='email'
								name='email'
								type='email'
								value={formData.email}
								onChange={handleChange}
								placeholder='Enter your email'
								required
								readOnly={emailLocked}
								className={`input input-bordered w-full pr-10 ${
									emailLocked ? 'opacity-80 cursor-default' : ''
								}`}
							/>
							{emailLocked && (
								<button
									type='button'
									onClick={handleEditEmail}
									className='absolute right-2 top-1/2 -translate-y-1/2 text-base-content opacity-70 hover:opacity-100'
								>
									<Pencil size={18} />
								</button>
							)}
						</div>
					</div>

					{/* Continue Button or Password Fields */}
					{!emailLocked ? (
						<button
							type='button'
							className='btn btn-primary w-full mb-4'
							onClick={handleEmailContinue}
						>
							Continue
						</button>
					) : (
						<>
							{/* Password */}
							<div className='form-control mb-4'>
								<label className='label' htmlFor='password'>
									<span className='label-text font-medium'>
										Password <span className='text-red-500'>*</span>
									</span>
								</label>
								<div className='relative'>
									<input
										id='password'
										name='password'
										type={passwordVisible ? 'text' : 'password'}
										value={formData.password}
										onChange={handleChange}
										placeholder='Enter password'
										required
										className='input input-bordered w-full pr-10'
									/>
									<button
										type='button'
										className='absolute right-2 top-1/2 -translate-y-1/2'
										onClick={() => setPasswordVisible((v) => !v)}
									>
										{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
									</button>
								</div>
							</div>

							{/* Confirm Password */}
							<div className='form-control mb-6'>
								<label className='label' htmlFor='confirmPassword'>
									<span className='label-text font-medium'>
										Confirm Password <span className='text-red-500'>*</span>
									</span>
								</label>
								<div className='relative'>
									<input
										id='confirmPassword'
										name='confirmPassword'
										type={confirmVisible ? 'text' : 'password'}
										value={formData.confirmPassword}
										onChange={handleChange}
										placeholder='Re-enter password'
										required
										className='input input-bordered w-full pr-10'
									/>
									<button
										type='button'
										className='absolute right-2 top-1/2 -translate-y-1/2'
										onClick={() => setConfirmVisible((v) => !v)}
									>
										{confirmVisible ? <EyeOff size={18} /> : <Eye size={18} />}
									</button>
								</div>
							</div>

							<button
								type='submit'
								className='btn btn-primary w-full mb-4'
								disabled={isSigningUp}
							>
								{isSigningUp ? 'Creating account...' : 'Sign Up'}
							</button>
						</>
					)}
				</form>

				{/* OAuth Buttons */}
				{!emailLocked && (
					<>
						<div className='divider'>Or sign up with</div>
						<div className='space-y-3'>
							<AuthButton provider='google' onClick={handleGoogleSignup} />
							<AuthButton
								provider='microsoft'
								onClick={handleMicrosoftSignIn}
							/>
							<AuthButton provider='apple' onClick={handleAppleSignIn} />
						</div>
					</>
				)}

				<p className='text-center text-sm text-base-content mt-6'>
					Already have an account?{' '}
					<Link to='/login' className='link link-primary'>
						Log in
					</Link>
				</p>
			</div>
		</div>
	)
}

export default Signup
