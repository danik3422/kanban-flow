import { signInWithPopup } from 'firebase/auth'
import { Eye, EyeOff, Pencil } from 'lucide-react'
import { useState } from 'react'
import { FaApple, FaMicrosoft } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { Link } from 'react-router-dom'
import { axiosInstance } from '../lib/axios'
import { auth, googleProvider } from '../lib/firebase'

const Signup = () => {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [emailLocked, setEmailLocked] = useState(false)
	const [passwordVisible, setPasswordVisible] = useState(false)
	const [confirmVisible, setConfirmVisible] = useState(false)

	const handleEmailContinue = () => {
		if (email.trim()) setEmailLocked(true)
	}

	const handleEditEmail = () => {
		setEmailLocked(false)
		setPassword('')
		setConfirmPassword('')
	}

	const handleSubmit = (e) => {
		e.preventDefault()
	}

	const handleGoogleSignup = async () => {
		try {
			const result = await signInWithPopup(auth, googleProvider)
			const idToken = await result.user.getIdToken()

			const response = await axiosInstance.post(
				'/auth/google',
				{ idToken },
				{ withCredentials: true }
			)

			console.log('User signed in successfully:', response.data)
			alert('Google Sign-in successful')
		} catch (error) {
			console.error('Google Sign-in error:', error)
			alert('Google Sign-in failed')
		}
	}

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

					{!emailLocked && (
						<button
							type='button'
							className='btn btn-primary w-full mb-4'
							onClick={handleEmailContinue}
						>
							Continue
						</button>
					)}

					{emailLocked && (
						<>
							<div className='form-control mb-4'>
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

							<div className='form-control mb-6'>
								<label className='label' htmlFor='confirm'>
									<span className='label-text font-medium'>
										Confirm Password <span className='text-red-500'>*</span>
									</span>
								</label>
								<div className='relative'>
									<input
										id='confirm'
										type={confirmVisible ? 'text' : 'password'}
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
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

							<button type='submit' className='btn btn-primary w-full mb-4'>
								Sign Up
							</button>
						</>
					)}
				</form>

				{!emailLocked && (
					<>
						<div className='divider'>Or sign up with</div>
						<div className='space-y-3'>
							<button
								onClick={handleGoogleSignup}
								className='btn w-full bg-white text-black border border-gray-300 hover:bg-gray-100 justify-center gap-3'
							>
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
