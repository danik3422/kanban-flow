import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'

const SetupProfile = () => {
	const navigate = useNavigate()
	const { authUser, checkAuth } = useAuthStore()

	const [name, setName] = useState('')
	const [password, setPassword] = useState('')
	const [avatarFile, setAvatarFile] = useState(null)
	const [avatarPreview, setAvatarPreview] = useState(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	useEffect(() => {
		if (authUser) {
			setName(authUser.name || '')
			setAvatarPreview(authUser.avatar || null)
		}
	}, [authUser])

	const handleFileChange = (e) => {
		const file = e.target.files[0]
		if (file) {
			setAvatarFile(file)
			setAvatarPreview(URL.createObjectURL(file))
		}
	}

	const convertFileToBase64 = (file) => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.readAsDataURL(file)
			reader.onload = () => resolve(reader.result)
			reader.onerror = (error) => reject(error)
		})
	}

	const handleSubmit = async (e) => {
		e.preventDefault()

		if (!name.trim()) {
			toast.error('Name is required')
			return
		}

		try {
			setIsSubmitting(true)

			let avatarBase64 = null
			if (avatarFile) {
				avatarBase64 = await convertFileToBase64(avatarFile)
			}

			await axiosInstance.patch('/auth/setup-profile', {
				name,
				password,
				avatar: avatarBase64,
			})

			toast.success('Profile updated successfully!')
			await checkAuth()
			navigate('/')
		} catch (err) {
			toast.error(err?.response?.data?.message || 'Profile update failed')
		} finally {
			setIsSubmitting(false)
		}
	}

	if (!authUser) return null

	return (
		<div className='min-h-screen bg-base-200 flex items-center justify-center px-4'>
			<div className='bg-base-100 w-full max-w-md rounded-2xl shadow-lg p-6 sm:p-8 space-y-6'>
				<div className='text-center'>
					<h1 className='text-3xl font-bold'>Set Up Profile</h1>
					<p className='text-sm text-base-content/60 mt-1'>
						Complete your profile to get started
					</p>
				</div>

				<form onSubmit={handleSubmit} className='space-y-5'>
					{/* Avatar Upload */}
					<div className='flex flex-col items-center'>
						<label className='relative group cursor-pointer'>
							<img
								src={avatarPreview || '/avatar-placeholder.png'}
								alt='Avatar'
								className='w-24 h-24 rounded-full object-cover border border-base-300 shadow-md group-hover:opacity-80 transition'
							/>
							<input
								type='file'
								accept='image/*'
								onChange={handleFileChange}
								className='hidden'
							/>
							<span className='absolute bottom-0 w-full text-xs text-center bg-black bg-opacity-60 text-white py-1 rounded-b opacity-0 group-hover:opacity-100 transition'>
								Change Photo
							</span>
						</label>
					</div>

					{/* Name Input */}
					<div>
						<label className='label'>
							<span className='label-text'>Name</span>
						</label>
						<input
							type='text'
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder='Your full name'
							className='input input-bordered w-full'
							required
						/>
					</div>

					{/* Password Input */}
					{authUser.provider !== 'local' && (
						<div>
							<label className='label'>
								<span className='label-text'>Set Password</span>
							</label>
							<input
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder='Password for local login (optional)'
								className='input input-bordered w-full'
							/>
							<p className='text-xs text-base-content/50 mt-1'>
								Set a password to log in without Google in the future
							</p>
						</div>
					)}

					{/* Submit Button */}
					<button
						type='submit'
						className='btn btn-primary w-full'
						disabled={isSubmitting}
					>
						{isSubmitting ? (
							<span className='loading loading-spinner'></span>
						) : (
							'Save Profile'
						)}
					</button>
				</form>
			</div>
		</div>
	)
}

export default SetupProfile
