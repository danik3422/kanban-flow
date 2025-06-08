import { signInWithPopup } from 'firebase/auth'
import { toast } from 'sonner'
import { create } from 'zustand'
import { axiosInstance } from '../lib/axios'
import { auth, googleProvider } from '../lib/firebase'

export const useAuthStore = create((set) => ({
	authUser: null,
	isSigningIn: false,
	isSigningUp: false,
	isCheckingAuth: true,
	isLoggingIn: false,
	socket: null,

	checkAuth: async () => {
		set({ isCheckingAuth: true })
		try {
			const res = await axiosInstance.get('/auth/get-user')
			set({ authUser: res.data })
		} catch (error) {
			console.error('Error checking user:', error)
			set({ authUser: null })
		} finally {
			set({ isCheckingAuth: false })
		}
	},

	signup: async (data) => {
		set({ isSigningUp: true })

		try {
			const res = await axiosInstance.post('/auth/signup', data)
			toast.success('Account created successfully')
			set({ authUser: res.data })
			return true
		} catch (error) {
			toast.error(error.response?.data?.message || 'Signup failed')
			return false
		} finally {
			set({ isSigningUp: false })
		}
	},

	login: async (data) => {
		set({ isLoggingIn: true })
		try {
			const res = await axiosInstance.post('/auth/login', data)
			toast.success('Logged in successfully')
			set({ authUser: res.data })
		} catch (error) {
			toast.error(error.response?.data?.message || 'Login failed')
		} finally {
			set({ isLoggingIn: false })
		}
	},

	logout: async () => {
		try {
			await axiosInstance.post('/auth/logout')
			set({ authUser: null })
			toast.success('Logged out successfully')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Logout failed')
		}
	},

	handleGoogleSignup: async () => {
		try {
			const result = await signInWithPopup(auth, googleProvider)
			const idToken = await result.user.getIdToken()

			const response = await axiosInstance.post(
				'/auth/google',
				{ idToken },
				{ withCredentials: true }
			)

			set({ authUser: response.data })
			toast.success('Google Sign-in successful')
			return { success: true, user: response.data }
		} catch (error) {
			console.error('Google Sign-in error:', error)
			toast.error('Google Sign-in failed')
			return { success: false, error }
		}
	},
}))
