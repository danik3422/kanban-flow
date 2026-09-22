import { cert, getApps, initializeApp } from 'firebase-admin/app'

import '../config/env.js'

const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
	? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
	: null

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY
	? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
	: null

if (!getApps().length) {
	if (firebaseServiceAccount) {
		initializeApp({
			credential: cert(firebaseServiceAccount),
		})
	} else if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
		initializeApp({
			credential: cert({
				projectId: firebaseProjectId,
				clientEmail: firebaseClientEmail,
				privateKey: firebasePrivateKey,
			}),
		})
	} else {
		console.warn(
			'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY to enable Google auth.'
		)
	}
}

const admin = {
	getApps,
	initializeApp,
}

export default admin
