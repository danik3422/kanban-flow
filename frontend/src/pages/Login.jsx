import { Eye, EyeOff, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../store/useAuthStore'
import AuthButton from '../ui/AuthButton'

const Login = () => {
	const { login, handleGoogleSignin } = useAuthStore()

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
		<div className='min-h-screen flex items-center justify-center px-4 bg-base-100'>
			<div className='w-full max-w-sm card bg-base-200 shadow-xl p-8'>
				<div className='flex justify-center mb-6'>
					<img
						src='https://cdn.worldvectorlogo.com/logos/trello.svg'
						alt='Trello logo'
						className='h-10'
						onError={(e) => (e.target.style.display = 'none')}
					/>
				</div>

				<h2 className='text-center text-xl font-bold text-base-content mb-6'>
					Sign in to continue
				</h2>

				<form onSubmit={emailLocked ? handleLogin : handleContinue}>
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

					{emailLocked && (
						<div className='form-control mb-6'>
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
									placeholder='Enter your password'
									required
									className='input input-bordered w-full pr-10'
								/>
								<button
									type='button'
									onClick={() => setPasswordVisible(!passwordVisible)}
									className='absolute right-2 top-1/2 -translate-y-1/2 text-base-content opacity-70 hover:opacity-100'
								>
									{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
								</button>
							</div>
						</div>
					)}

					<button type='submit' className='btn btn-primary w-full mb-4'>
						{emailLocked ? 'Log in' : 'Continue'}
					</button>
				</form>

				<div className='divider'>Or continue with</div>

				<div className='space-y-3'>
					<AuthButton provider='google' onClick={handleGoogleSignIn} />
					<AuthButton provider='microsoft' onClick={handleMicrosoftSignIn} />
					<AuthButton provider='apple' onClick={handleAppleSignIn} />
				</div>

				<p className='text-center text-sm text-base-content mt-6 flex justify-center gap-8'>
					<Link to='/login/resetpassword' className='link link-primary'>
						Can't log in?
					</Link>
					<Link to='/signup' className='link link-primary'>
						Create account
					</Link>
				</p>
			</div>
		</div>
	)
}

export default Login
