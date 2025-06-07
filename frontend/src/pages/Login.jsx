import { Eye, EyeOff, Pencil } from 'lucide-react'
import { useState } from 'react'
import { FaApple, FaMicrosoft } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { Link } from 'react-router-dom'

const Login = () => {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [emailLocked, setEmailLocked] = useState(false)

	const handleContinue = (e) => {
		e.preventDefault()
		if (email.trim()) {
			setEmailLocked(true)
		}
	}

	const handleLogin = (e) => {
		e.preventDefault()
	}

	const handleEditEmail = () => {
		setEmailLocked(false)
		setPassword('')
	}

	return (
		<div className='min-h-screen flex items-center justify-center px-4 bg-base-100'>
			<div className='w-full max-w-sm card bg-base-200 shadow-xl p-8'>
				{/* Trello Logo */}
				<div className='flex justify-center mb-6'>
					<img
						src='https://cdn.worldvectorlogo.com/logos/trello.svg'
						alt='Trello logo'
						className='h-10'
						onError={(e) => (e.target.style.display = 'none')}
					/>
				</div>

				{/* Title */}
				<h2 className='text-center text-xl font-bold text-base-content mb-6'>
					Sign in to continue
				</h2>

				<form onSubmit={emailLocked ? handleLogin : handleContinue}>
					{/* Email Input */}
					<div className='form-control mb-4 relative'>
						<label className='label' htmlFor='email'>
							<span className='label-text font-medium'>
								Email <span className='text-red-500'>*</span>
							</span>
						</label>
						<div className='relative'>
							<input
								id='email'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
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

					{/* Password Input */}
					{emailLocked && (
						<div className='form-control mb-6 relative'>
							<label className='label' htmlFor='password'>
								<span className='label-text font-medium'>
									Password <span className='text-red-500'>*</span>
								</span>
							</label>
							<div className='relative'>
								<input
									id='password'
									type={passwordVisible ? 'text' : 'password'}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
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

					{/* Submit Button */}
					<button type='submit' className='btn btn-primary w-full mb-4'>
						{emailLocked ? 'Log in' : 'Continue'}
					</button>
				</form>

				{/* Divider */}
				<div className='divider'>Or continue with</div>

				{/* OAuth Buttons */}
				<div className='space-y-3'>
					<button className='btn w-full bg-white text-black border border-gray-300 hover:bg-gray-100 justify-center gap-3'>
						<FcGoogle className='text-xl' />
						Continue with Google
					</button>

					<button className='btn w-full bg-[#2F2F2F] text-white hover:bg-[#1f1f1f] justify-center gap-3'>
						<FaMicrosoft className='text-xl' />
						Continue with Microsoft
					</button>

					<button className='btn w-full bg-black text-white hover:bg-gray-900 justify-center gap-3'>
						<FaApple className='text-xl' />
						Continue with Apple
					</button>
				</div>

				{/* Links */}
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
