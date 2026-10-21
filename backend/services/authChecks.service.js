import bcrypt from 'bcrypt'
import { getAuth } from 'firebase-admin/auth'

import User from '../models/user.model.js'

// Identity checks shared by the sign-in, password, social and passkey handlers.

const REAUTH_WINDOW_MS = 5 * 60 * 1000

export const hasRecentReauthentication = (user) =>
	Boolean(user.lastReauthenticatedAt) && Date.now() - user.lastReauthenticatedAt.getTime() <= REAUTH_WINDOW_MS

export const assertCurrentPassword = async (user, currentPassword) => {
	if (
		!currentPassword ||
		!user.password ||
		!(await bcrypt.compare(currentPassword, user.password))
	) {
		const error = new Error('Re-authentication required.')
		error.statusCode = 401
		throw error
	}
}

// Sensitive changes: the current password, or for accounts without one, a recent
// provider sign-in recorded by /reauthenticate.
export const assertReauthenticated = async (user, currentPassword) => {
	if (user.password) return assertCurrentPassword(user, currentPassword)
	if (hasRecentReauthentication(user)) return
	const error = new Error('Sign in again to confirm this change.')
	error.statusCode = 401
	error.code = 'reauth_required'
	throw error
}

export const assertFreshProviderToken = (decodedToken) => {
	const now = Math.floor(Date.now() / 1000)
	const tokenAge = now - Number(decodedToken.iat)
	if (
		!Number.isFinite(Number(decodedToken.iat)) ||
		tokenAge < -60 ||
		tokenAge > 5 * 60
	) {
		const error = new Error('A fresh provider token is required.')
		error.statusCode = 401
		throw error
	}
}

export const assertProviderEmailVerified = (decodedToken) => {
	if (decodedToken.email_verified !== true) {
		const error = new Error(
			'Provider email must be verified before continuing.',
		)
		error.statusCode = 403
		throw error
	}
}

export const assertProviderIdentityAvailable = async ({
	provider,
	providerUid,
	userId,
}) => {
	const existingProviderUser = await User.findOne({
		$or: [
			{ provider, providerUid },
			{ 'linkedProviders.provider': provider, 'linkedProviders.providerUid': providerUid },
		],
	}).select('_id')
	if (
		existingProviderUser &&
		String(existingProviderUser._id) !== String(userId)
	) {
		const error = new Error(
			'This provider is already linked to another account.',
		)
		error.statusCode = 409
		throw error
	}
}

export const getDuplicateAuthErrorMessage = (error) =>
	error?.code === 11000
		? 'Email or provider identity is already registered.'
		: null

export const verifySocialProviderToken = async (idToken, provider) => {
	let decodedToken
	try {
		decodedToken = await getAuth().verifyIdToken(idToken, true)
	} catch (error) {
		if (
			error?.code === 'auth/id-token-expired' ||
			error?.code === 'auth/id-token-revoked' ||
			error?.code === 'auth/argument-error'
		) {
			const tokenError = new Error('Invalid or expired provider token.')
			tokenError.statusCode = 401
			throw tokenError
		}
		throw error
	}

	assertProviderEmailVerified(decodedToken)
	const providerByFirebaseId = {
		'google.com': 'google',
		'microsoft.com': 'microsoft',
		'apple.com': 'apple',
	}
	if (
		providerByFirebaseId[decodedToken.firebase?.sign_in_provider] !== provider
	) {
		const error = new Error('Social provider does not match the token.')
		error.statusCode = 401
		throw error
	}
	return decodedToken
}
