import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth'

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean)

export const auth = firebaseEnabled ? getAuth(initializeApp(firebaseConfig)) : null
export const googleProvider = firebaseEnabled ? new GoogleAuthProvider() : null
export const microsoftProvider = firebaseEnabled ? new OAuthProvider('microsoft.com') : null
export const appleProvider = firebaseEnabled ? new OAuthProvider('apple.com') : null
