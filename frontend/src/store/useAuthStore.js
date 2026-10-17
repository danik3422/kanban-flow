import { toast } from 'sonner'
import { create } from 'zustand'
import { axiosInstance } from '../lib/axios'
import { clearBoardsCache } from '../lib/boardsCache'
import { useBoardStats } from './useBoardStats'
import { resetSocket } from '../lib/socketRegistry'
import { devUser, isDevAuthBypass } from '../lib/devMode'
import { firebaseEnabled, isFirebaseLoaded, loadFirebase } from '../lib/firebase'
import { translateCurrent, translateServerMessageCurrent } from '../i18n/translate'

const providerName = (provider) => ({ google: 'Google', microsoft: 'Microsoft', apple: 'Apple' })[provider] || provider

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
			set({ authUser: responseData })
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
				set({ authUser: res.data })
				return {
					success: true,
					requiresVerification: true,
					email: res.data.email,
				}
			}
			
			toast.success(translateCurrent('auth.toast.signedIn'))
			set({ authUser: res.data })
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
			set({ authUser: res.data })
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

			set({ authUser: response.data })
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
			set({ authUser: response.data })
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
			set({ authUser: response.data })
			toast.success(translateCurrent('auth.toast.providerConnected', { provider: providerName(provider) }))
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
			set({ authUser: response.data })
			toast.success(translateCurrent('auth.toast.providerConnected', { provider: providerName(provider) }))
			return { success: true, user: response.data }
		} catch (error) {
			sessionStorage.removeItem('pending-social-provider')
			toast.error(error.response?.data?.message || error.message || `Could not connect ${provider}`)
			return { success: false, error }
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
