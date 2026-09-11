import { signInWithPopup } from 'firebase/auth'
import { toast } from 'sonner'
import { create } from 'zustand'
import { axiosInstance } from '../lib/axios'
import { devUser, isDevAuthBypass } from '../lib/devMode'
import {
	appleProvider,
	auth,
	firebaseEnabled,
	microsoftProvider,
	googleProvider,
} from '../lib/firebase'

export const useAuthStore = create((set) => ({
	authUser: null,
	clearAuth: () => set({ authUser: null }),
	isSigningIn: false,
	isSigningUp: false,
	isCheckingAuth: true,
	isLoggingIn: false,
	socket: null,

	checkAuth: async () => {
		set({ isCheckingAuth: true })
		if (isDevAuthBypass) {
			set({ authUser: devUser, isCheckingAuth: false })
			return
		}
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
			const responseData = res.data

			if (responseData.requiresVerification) {
				toast.success('Account created. Check your email to verify it.')
				return { success: true, requiresVerification: true, email: responseData.email }
			}

			toast.success('Account created successfully')
			set({ authUser: responseData })
			return { success: true, requiresVerification: false }
		} catch (error) {
			toast.error(error.response?.data?.message || 'Signup failed')
			return { success: false, requiresVerification: false }
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
		if (isDevAuthBypass) {
			set({ authUser: devUser })
			toast.info('Dev auth bypass is enabled')
			return
		}
		try {
			await axiosInstance.post('/auth/logout')
			set({ authUser: null })
			toast.success('Logged out successfully')
		} catch (error) {
			toast.error(error.response?.data?.message || 'Logout failed')
		}
	},

	handleSocialSignin: async (provider) => {
		if (!firebaseEnabled) {
			toast.error('Social sign-in is not configured yet')
			return { success: false }
		}
		const providers = {
			google: googleProvider,
			microsoft: microsoftProvider,
			apple: appleProvider,
		}
		const firebaseProvider = providers[provider]
		if (!firebaseProvider) return { success: false }

		try {
			const result = await signInWithPopup(auth, firebaseProvider)
			const idToken = await result.user.getIdToken()
			const response = await axiosInstance.post(
				'/auth/social/login',
				{ idToken, provider },
				{ withCredentials: true },
			)

			set({ authUser: response.data })
			toast.success(`${provider[0].toUpperCase()}${provider.slice(1)} sign-in successful`)
			return { success: true, user: response.data }
		} catch (error) {
			console.error(`${provider} Sign-in Error:`, error)
			toast.error(error.response?.data?.message || `${provider} sign-in failed`)
			return { success: false, error }
		}
	},

	handleSocialSignup: async (provider) => {
		if (!firebaseEnabled) {
			toast.error('Social sign-up is not configured yet')
			return { success: false }
		}
		const providers = { google: googleProvider, microsoft: microsoftProvider, apple: appleProvider }
		const firebaseProvider = providers[provider]
		if (!firebaseProvider) return { success: false }
		try {
			const result = await signInWithPopup(auth, firebaseProvider)
			const idToken = await result.user.getIdToken()
			const response = await axiosInstance.post('/auth/social/signup', { idToken, provider }, { withCredentials: true })
			set({ authUser: response.data })
			toast.success('Account created successfully')
			return { success: true, user: response.data }
		} catch (error) {
			console.error(`${provider} Signup Error:`, error)
			toast.error(error.response?.data?.message || `${provider} signup failed`)
			return { success: false, error }
		}
	},

	connectSocialAccount: async (provider) => {
		if (!firebaseEnabled) {
			toast.error('Social sign-in is not configured yet')
			return { success: false }
		}
		const providers = { google: googleProvider, microsoft: microsoftProvider, apple: appleProvider }
		const firebaseProvider = providers[provider]
		if (!firebaseProvider) return { success: false }
		try {
			const result = await signInWithPopup(auth, firebaseProvider)
			const idToken = await result.user.getIdToken()
			const response = await axiosInstance.post('/auth/social/connect', { idToken, provider }, { withCredentials: true })
			set({ authUser: response.data })
			toast.success(`${provider[0].toUpperCase()}${provider.slice(1)} connected successfully`)
			return { success: true, user: response.data }
		} catch (error) {
			console.error(`${provider} Connect Error:`, error)
			toast.error(error.response?.data?.message || `Could not connect ${provider}`)
			return { success: false, error }
		}
	},
}))
