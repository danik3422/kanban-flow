import { getRedirectResult, signInWithPopup, signInWithRedirect } from 'firebase/auth'
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

export const useAuthStore = create((set, get) => ({
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
		} catch {
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
			
			if (res.data.requiresVerification) {
				toast.info('Please verify your email to complete login')
				set({ authUser: res.data })
				return {
					success: true,
					requiresVerification: true,
					email: res.data.email,
				}
			}
			
			toast.success('Logged in successfully')
			set({ authUser: res.data })
			return { success: true, requiresVerification: false }
		} catch (error) {
			toast.error(error.response?.data?.message || 'Login failed')
			return { success: false }
		} finally {
			set({ isLoggingIn: false })
		}
	},

	passkeyLogin: async (response) => {
		set({ isLoggingIn: true })
		try {
			const res = await axiosInstance.post('/auth/passkeys/authenticate', response)
			set({ authUser: res.data })
			toast.success('Signed in with passkey')
			return { success: true, requiresVerification: Boolean(res.data.requiresVerification) }
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not sign in with passkey')
			return { success: false }
		} finally {
			set({ isLoggingIn: false })
		}
	},

	logout: async () => {
		if (isDevAuthBypass) {
			set({ authUser: null })
			toast.info('Logged out successfully')
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
			toast.error(error.response?.data?.message || `${provider} signup failed`)
			return { success: false, error }
		}
	},

	connectSocialAccount: async (provider, currentPassword) => {
		if (!firebaseEnabled) {
			toast.error('Social sign-in is not configured yet')
			return { success: false }
		}
		const providers = { google: googleProvider, microsoft: microsoftProvider, apple: appleProvider }
		const firebaseProvider = providers[provider]
		if (!firebaseProvider) return { success: false }
		if (!currentPassword) return { success: false }
		try {
			if (window.matchMedia?.('(max-width: 720px)').matches) {
				sessionStorage.setItem('pending-social-provider', provider)
				await signInWithRedirect(auth, firebaseProvider)
				return { success: false, redirecting: true }
			}
			const result = await signInWithPopup(auth, firebaseProvider)
			const idToken = await result.user.getIdToken(true)
			const response = await axiosInstance.post('/auth/social/connect', { idToken, provider, currentPassword }, { withCredentials: true })
			set({ authUser: response.data })
			toast.success(`${provider[0].toUpperCase()}${provider.slice(1)} connected successfully`)
			return { success: true, user: response.data }
		} catch (error) {
			const firebaseMessage = {
				'auth/unauthorized-domain': 'This production domain is not authorized in Firebase Authentication.',
				'auth/popup-blocked': 'The sign-in popup was blocked. Allow popups and try again.',
				'auth/popup-closed-by-user': 'Provider sign-in was cancelled.',
				'auth/operation-not-allowed': `${provider} sign-in is not enabled in Firebase Authentication.`,
			}[error.code]
			toast.error(error.response?.data?.message || firebaseMessage || error.message || `Could not connect ${provider}`)
			return { success: false, error }
		}
	},

	completeSocialRedirect: async () => {
		const provider = sessionStorage.getItem('pending-social-provider')
		if (!provider || !auth) return { success: false }
		try {
			const result = await getRedirectResult(auth)
			if (!result?.user) return { success: false }
			const idToken = await result.user.getIdToken(true)
			const response = await axiosInstance.post('/auth/social/connect', { idToken, provider }, { withCredentials: true })
			sessionStorage.removeItem('pending-social-provider')
			set({ authUser: response.data })
			toast.success(`${provider[0].toUpperCase()}${provider.slice(1)} connected successfully`)
			return { success: true, user: response.data }
		} catch (error) {
			sessionStorage.removeItem('pending-social-provider')
			toast.error(error.response?.data?.message || error.message || `Could not connect ${provider}`)
			return { success: false, error }
		}
	},

	setSocialPassword: async (password) => {
		if (!firebaseEnabled) {
			toast.error('Social sign-in is not configured yet')
			return { success: false }
		}
		const currentUser = get().authUser
		const provider = currentUser?.provider
		const providers = { google: googleProvider, microsoft: microsoftProvider, apple: appleProvider }
		const firebaseProvider = providers[provider]
		if (!firebaseProvider) return { success: false }
		try {
			const result = await signInWithPopup(auth, firebaseProvider)
			const idToken = await result.user.getIdToken(true)
			const response = await axiosInstance.post('/auth/social/set-password', { idToken, provider, password }, { withCredentials: true })
			set((state) => ({ authUser: { ...state.authUser, ...response.data, hasPassword: true } }))
			toast.success('Password sign-in added')
			return { success: true, user: response.data }
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not add password sign-in')
			return { success: false, error }
		}
	},
}))
