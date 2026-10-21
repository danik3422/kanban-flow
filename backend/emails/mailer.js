import * as templates from './templates.js'
import { env } from '../config/env.js'

const getRecipient = (email) => env.mailRedirectTo || email

const parseAddress = (value) => {
	const match = String(value || '').match(/^(.*?)\s*<([^>]+)>$/)
	return match
		? { name: match[1].trim(), email: match[2].trim() }
		: { email: String(value || '').trim() }
}

const sendEmail = async ({ email, subject, text, html }) => {
	if (!env.brevoApiKey || !env.mailFrom) {
		throw new Error('Brevo email API is not configured')
	}

	const sender = parseAddress(env.mailFrom)
	const payload = {
		sender,
		to: [{ email: getRecipient(email) }],
		subject,
		textContent: text,
		htmlContent: html,
		...(env.mailReplyTo ? { replyTo: parseAddress(env.mailReplyTo) } : {}),
	}
	const response = await fetch(env.brevoApiUrl, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'api-key': env.brevoApiKey,
			'content-type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const details = await response.text()
		throw new Error(`Brevo email API failed (${response.status}): ${details}`)
	}
}

// Each email is built in the reader's language by emails/templates.js.

export const sendPasswordResetEmail = ({ email, resetUrl, language }) =>
	sendEmail({ email, ...templates.resetPassword({ lang: language, email, url: resetUrl, minutes: env.passwordResetMinutes }) })

export const sendPasswordAddedEmail = ({ email, settingsUrl, language }) =>
	sendEmail({ email, ...templates.passwordAdded({ lang: language, email, url: settingsUrl }) })

const PROVIDER_NAMES = { google: 'Google', microsoft: 'Microsoft', apple: 'Apple', github: 'GitHub' }

export const sendProviderLinkedEmail = ({ email, provider, settingsUrl, language }) =>
	sendEmail({ email, ...templates.providerLinked({ lang: language, email, url: settingsUrl, provider: PROVIDER_NAMES[provider] || provider }) })

export const sendPasskeyAddedEmail = ({ email, passkeyName, settingsUrl, language }) =>
	sendEmail({ email, ...templates.passkeyAdded({ lang: language, email, url: settingsUrl, provider: passkeyName }) })

// Sign-up with a taken address: tell the owner instead of the person signing up, so sign-up never reveals accounts.
export const sendAccountExistsEmail = ({ email, signInUrl, language }) =>
	sendEmail({ email, ...templates.accountExists({ lang: language, email, url: signInUrl }) })

export const sendAccountVerificationEmail = ({ email, verificationUrl, language }) =>
	sendEmail({ email, ...templates.verifyEmail({ lang: language, email, url: verificationUrl, minutes: env.emailVerificationMinutes }) })

export const sendBoardInviteEmail = ({ email, boardName, boardUrl, inviterName, language }) =>
	sendEmail({ email, ...templates.boardInvite({ lang: language, inviter: inviterName, board: boardName, url: boardUrl }) })

/** One email for one board event. */
export const sendActivityEmail = ({ email, language, timezone, notification, url }) =>
	sendEmail({ email, ...templates.activityEmail({ lang: language, timezone, notification, url, manageUrl: `${env.frontendUrl}/settings#notifications` }) })

/** Everything since the last digest, grouped by board. */
export const sendDigestEmail = ({ email, language, timezone, notifications, since }) =>
	sendEmail({ email, ...templates.digestEmail({ lang: language, timezone, notifications, since, url: env.frontendUrl, manageUrl: `${env.frontendUrl}/settings#notifications` }) })
