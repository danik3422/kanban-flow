const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean)

let firebasePromise = null

// Firebase Auth is several hundred KB, so it stays out of the main bundle and is
// loaded only where social sign-in is offered (pages preload it on mount so the
// popup still opens straight from the click).
export const loadFirebase = () => {
	if (!firebaseEnabled) return Promise.resolve(null)
	firebasePromise ??= Promise.all([import('firebase/app'), import('firebase/auth')])
		.then(([{ initializeApp }, firebaseAuth]) => ({
			...firebaseAuth,
			auth: firebaseAuth.getAuth(initializeApp(firebaseConfig)),
			providers: {
				google: new firebaseAuth.GoogleAuthProvider(),
				microsoft: new firebaseAuth.OAuthProvider('microsoft.com'),
				apple: new firebaseAuth.OAuthProvider('apple.com'),
			},
		}))
		.catch((error) => {
			firebasePromise = null
			throw error
		})
	return firebasePromise
}

export const isFirebaseLoaded = () => firebasePromise !== null
