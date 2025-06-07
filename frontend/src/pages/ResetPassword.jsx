import { useState } from 'react'
import { Link } from 'react-router-dom'

const ResetPassword = () => {
	const [email, setEmail] = useState('')

	const handleSubmit = (e) => {
		e.preventDefault()
	}

	return (
		<div className='min-h-screen flex items-center justify-center px-4 bg-base-100'>
			<div className='w-full max-w-sm card bg-base-200 shadow-xl p-8'>
				<h2 className='text-center text-xl font-bold mb-6 text-base-content'>
					Reset your password
				</h2>

				<form onSubmit={handleSubmit}>
					<div className='form-control mb-4'>
						<label className='label' htmlFor='email'>
							<span className='label-text font-medium'>
								Email address<span className='text-red-500'> *</span>
							</span>
						</label>
						<input
							id='email'
							type='email'
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder='Enter your email'
							className='input input-bordered w-full'
							required
						/>
					</div>

					<button type='submit' className='btn btn-primary w-full'>
						Send Reset Link
					</button>
				</form>

				<p className='text-center text-sm text-base-content mt-6'>
					<Link to='/login' className='link link-primary'>
						← Back to login
					</Link>
				</p>
			</div>
		</div>
	)
}

export default ResetPassword
