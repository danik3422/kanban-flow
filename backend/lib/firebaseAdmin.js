import * as admin from 'firebase-admin'

import '../config/env.js'

const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
	? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
	: null

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY
	? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
	: null

if (!admin.apps || !admin.apps.length) {
	if (firebaseServiceAccount) {
		admin.initializeApp({
			credential: admin.credential.cert(firebaseServiceAccount),
		})
	} else if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
		admin.initializeApp({
			credential: admin.credential.cert({
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

export default admin
