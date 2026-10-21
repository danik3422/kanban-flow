import { toast } from 'sonner'
import { create } from 'zustand'
import { axiosInstance, onSessionExpired } from '../lib/axios'
import { clearBoardsCache } from '../lib/boardsCache'
import { useBoardStats } from './useBoardStats'
import { resetSocket } from '../lib/socketRegistry'
import { devUser, isDevAuthBypass } from '../lib/devMode'
import { firebaseEnabled, isFirebaseLoaded, loadFirebase } from '../lib/firebase'
import { translateCurrent, translateServerMessageCurrent } from '../i18n/translate'

const providerName = (provider) => ({ google: 'Google', microsoft: 'Microsoft', apple: 'Apple' })[provider] || provider

// A sign-in answer has only the basics; the full profile (settings, notification
// choices, passkeys, linked accounts) follows at once, so nothing shows defaults.
const signIn = (set, user) => {
	set({ authUser: user })
	if (isDevAuthBypass) return
	axiosInstance.get('/auth/get-user')
		.then((response) => set((state) => (state.authUser?._id === response.data._id ? { authUser: response.data } : {})))
		.catch(() => {})
}

export const useAuthStore = create((set, get) => ({
	authUser: null,
	clearAuth: () => {
		resetSocket()
		useBoardStats.getState().reset()
		set({ authUser: null })
	},
	isSigningIn: false,
	isSigningUp: false,
	isCheckingAuth: true,
	isLoggingIn: false,
	socket: null,

	// Only the first check blocks the app; later refreshes (after saving a profile,
	// changing settings) update the user in place without remounting every page.
	checkAuth: async () => {
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
				toast.success(translateCurrent('auth.toast.accountCreated'))
				return { success: true, requiresVerification: true, email: responseData.email }
			}

			toast.success(translateCurrent('auth.toast.socialAccountCreated'))
			signIn(set, responseData)
			return { success: true, requiresVerification: false }
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message))
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
				toast.info(translateCurrent('auth.toast.verifyToContinue'))
				signIn(set, res.data)
				return {
					success: true,
					requiresVerification: true,
					email: res.data.email,
				}
			}
			
			toast.success(translateCurrent('auth.toast.signedIn'))
			signIn(set, res.data)
			return { success: true, requiresVerification: false }
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message))
			return { success: false }
		} finally {
			set({ isLoggingIn: false })
		}
	},

	passkeyLogin: async (response) => {
		set({ isLoggingIn: true })
		try {
			const res = await axiosInstance.post('/auth/passkeys/authenticate', response)
			signIn(set, res.data)
			toast.success(translateCurrent('auth.toast.signedInPasskey'))
			return { success: true, requiresVerification: Boolean(res.data.requiresVerification) }
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message || 'Could not sign in with passkey'))
			return { success: false }
		} finally {
			set({ isLoggingIn: false })
		}
	},

	logout: async () => {
		if (isDevAuthBypass) {
			set({ authUser: null })
			toast.info(translateCurrent('auth.toast.signedOut'))
			return
		}
		try {
			await axiosInstance.post('/auth/logout')
			resetSocket()
			clearBoardsCache()
			useBoardStats.getState().reset()
			// Only sign out of Firebase if this visit loaded it; never download it just for that.
			if (isFirebaseLoaded()) loadFirebase().then((firebase) => firebase?.signOut(firebase.auth)).catch(() => {})
			set({ authUser: null })
			toast.success(translateCurrent('auth.toast.signedOut'))
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message))
		}
	},

	handleSocialSignin: async (provider) => {
		if (!firebaseEnabled) {
			toast.error(translateCurrent('auth.toast.socialUnavailable'))
			return { success: false }
		}
		const firebase = await loadFirebase().catch(() => null)
		if (!firebase) {
			toast.error(translateCurrent('auth.toast.socialLoadFailed'))
			return { success: false }
		}
		const firebaseProvider = firebase.providers[provider]
		if (!firebaseProvider) return { success: false }

		try {
			const result = await firebase.signInWithPopup(firebase.auth, firebaseProvider)
			const idToken = await result.user.getIdToken()
			const response = await axiosInstance.post(
				'/auth/social/login',
				{ idToken, provider },
				{ withCredentials: true },
			)

			signIn(set, response.data)
			toast.success(translateCurrent('auth.toast.socialSignedIn', { provider: providerName(provider) }))
			return { success: true, user: response.data }
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'auth.toast.socialFailed').replace('{provider}', providerName(provider)))
			return { success: false, error }
		}
	},

	handleSocialSignup: async (provider) => {
		if (!firebaseEnabled) {
			toast.error(translateCurrent('auth.toast.socialUnavailable'))
			return { success: false }
		}
		const firebase = await loadFirebase().catch(() => null)
		if (!firebase) {
			toast.error(translateCurrent('auth.toast.socialLoadFailed'))
			return { success: false }
		}
		const firebaseProvider = firebase.providers[provider]
		if (!firebaseProvider) return { success: false }
		try {
			const result = await firebase.signInWithPopup(firebase.auth, firebaseProvider)
			const idToken = await result.user.getIdToken()
			const response = await axiosInstance.post('/auth/social/signup', { idToken, provider }, { withCredentials: true })
			signIn(set, response.data)
			toast.success(translateCurrent('auth.toast.socialAccountCreated'))
			return { success: true, user: response.data }
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'auth.toast.socialFailed').replace('{provider}', providerName(provider)))
			return { success: false, error }
		}
	},

	connectSocialAccount: async (provider, currentPassword) => {
		if (!firebaseEnabled) {
			toast.error(translateCurrent('auth.toast.socialUnavailable'))
			return { success: false }
		}
		const firebase = await loadFirebase().catch(() => null)
		if (!firebase) {
			toast.error(translateCurrent('auth.toast.socialLoadFailed'))
			return { success: false }
		}
		const firebaseProvider = firebase.providers[provider]
		if (!firebaseProvider) return { success: false }
		if (!currentPassword) return { success: false }
		try {
			if (window.matchMedia?.('(max-width: 720px)').matches) {
				sessionStorage.setItem('pending-social-provider', provider)
				await firebase.signInWithRedirect(firebase.auth, firebaseProvider)
				return { success: false, redirecting: true }
			}
			const result = await firebase.signInWithPopup(firebase.auth, firebaseProvider)
			const idToken = await result.user.getIdToken(true)
			const response = await axiosInstance.post('/auth/social/connect', { idToken, provider, currentPassword }, { withCredentials: true })
			signIn(set, response.data)
			toast.success(translateCurrent('auth.toast.providerConnected', { provider: providerName(provider) }))
			return { success: true, user: response.data }
		} catch (error) {
			const firebaseKey = {
				'auth/unauthorized-domain': 'auth.toast.socialUnavailable',
				'auth/operation-not-allowed': 'auth.toast.socialUnavailable',
				'auth/popup-blocked': 'auth.toast.popupBlocked',
				'auth/popup-closed-by-user': 'auth.toast.socialCancelled',
			}[error.code]
			toast.error(error.response?.data?.message ? translateServerMessageCurrent(error.response.data.message, 'auth.errors.generic') : translateCurrent(firebaseKey || 'auth.errors.generic'))
			return { success: false, error }
		}
	},

	completeSocialRedirect: async () => {
		const provider = sessionStorage.getItem('pending-social-provider')
		if (!provider) return { success: false }
		const firebase = await loadFirebase().catch(() => null)
		if (!firebase) return { success: false }
		try {
			const result = await firebase.getRedirectResult(firebase.auth)
			const redirectUser = result?.user || firebase.auth.currentUser
			if (!redirectUser) {
				console.warn('Firebase redirect completed without a user result', { provider })
				toast.error(translateCurrent('auth.toast.socialNoAccount'))
				return { success: false }
			}
			const idToken = await redirectUser.getIdToken(true)
			const response = await axiosInstance.post('/auth/social/connect', { idToken, provider }, { withCredentials: true })
			sessionStorage.removeItem('pending-social-provider')
			signIn(set, response.data)
			toast.success(translateCurrent('auth.toast.providerConnected', { provider: providerName(provider) }))
			return { success: true, user: response.data }
		} catch (error) {
			sessionStorage.removeItem('pending-social-provider')
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'auth.errors.generic'))
			return { success: false, error }
		}
	},

	// Accounts without a password confirm sensitive changes by signing in with their provider again.
	reauthenticateWithProvider: async () => {
		const { provider, linkedProviders = [] } = get().authUser || {}
		const providerKey = provider && provider !== 'local' ? provider : linkedProviders[0]?.provider
		const firebase = firebaseEnabled ? await loadFirebase().catch(() => null) : null
		const firebaseProvider = firebase?.providers[providerKey]
		if (!firebaseProvider) {
			toast.error(translateCurrent('auth.toast.socialUnavailable'))
			return false
		}
		try {
			const result = await firebase.signInWithPopup(firebase.auth, firebaseProvider)
			const idToken = await result.user.getIdToken(true)
			await axiosInstance.post('/auth/reauthenticate', { idToken, provider: providerKey })
			return true
		} catch (error) {
			if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
				toast.error(translateServerMessageCurrent(error.response?.data?.message, 'auth.errors.generic'))
			}
			return false
		}
	},

	setSocialPassword: async (password) => {
		if (!firebaseEnabled) {
			toast.error(translateCurrent('auth.toast.socialUnavailable'))
			return { success: false }
		}
		const currentUser = get().authUser
		const provider = currentUser?.provider
		const firebase = await loadFirebase().catch(() => null)
		if (!firebase) {
			toast.error(translateCurrent('auth.toast.socialLoadFailed'))
			return { success: false }
		}
		const firebaseProvider = firebase.providers[provider]
		if (!firebaseProvider) return { success: false }
		try {
			const result = await firebase.signInWithPopup(firebase.auth, firebaseProvider)
			const idToken = await result.user.getIdToken(true)
			const response = await axiosInstance.post('/auth/social/set-password', { idToken, provider, password }, { withCredentials: true })
			set((state) => ({ authUser: { ...state.authUser, ...response.data, hasPassword: true } }))
			toast.success(translateCurrent('auth.toast.passwordAdded'))
			return { success: true, user: response.data }
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'auth.toast.passwordAddFailed'))
			return { success: false, error }
		}
	},
}))

// Signed out from another device (or the password was reset): leave cleanly once.
onSessionExpired(() => {
	if (!useAuthStore.getState().authUser) return
	resetSocket()
	clearBoardsCache()
	useBoardStats.getState().reset()
	useAuthStore.setState({ authUser: null })
	toast.info(translateCurrent('auth.toast.sessionEnded'))
})
