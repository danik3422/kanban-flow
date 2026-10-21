import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
dotenv.config({ path: envPath })

const isProduction = process.env.NODE_ENV === 'production'
// Only an explicit local environment may fall back to a well-known secret; a server
// that merely forgot NODE_ENV must not sign sessions with a public value.
const isLocalEnvironment = ['development', 'test'].includes(process.env.NODE_ENV)
// Docker installs keep a generated secret in their data volume (docker/entrypoint.mjs),
// so the server and admin commands run with `docker compose exec` sign the same way.
const readSecretFile = () => {
	try {
		return process.env.DATA_DIR ? fs.readFileSync(path.join(process.env.DATA_DIR, 'jwt-secret'), 'utf8').trim() : ''
	} catch {
		return ''
	}
}
const configuredJwtSecret = process.env.JWT_SECRET?.trim() || readSecretFile()
const jwtSecret = configuredJwtSecret || (isLocalEnvironment ? 'dev-secret-change-me' : '')

if (!isLocalEnvironment && configuredJwtSecret.length < 32) {
	throw new Error(
		'JWT_SECRET must be configured with at least 32 characters (set NODE_ENV=development for local work)',
	)
}

const parseCorsOrigins = () => {
	const raw =
		process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5179'
	return raw
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
}

export const env = {
	port: Number(process.env.PORT) || 5001,
	isProduction,
	isLocalEnvironment,
	allowMemoryDb: !isProduction && process.env.ALLOW_MEMORY_DB === 'true',
	jwtSecret,
	mongoUri: process.env.MONGO_URI || '',
	corsOrigin: parseCorsOrigins(),
	// Number of proxy hops in front of the app (1 on Render). 0 disables trust.
	trustProxy: Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
	frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
	mailFrom: process.env.MAIL_FROM || '',
	mailReplyTo: process.env.MAIL_REPLY_TO || '',
	mailRedirectTo: process.env.MAIL_REDIRECT_TO || '',
	brevoApiKey: process.env.BREVO_API_KEY || '',
	brevoApiUrl:
		process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email',
	// Any SMTP server (self-hosting): your mail provider, or one on your own network.
	smtpHost: process.env.SMTP_HOST || '',
	smtpPort: Number(process.env.SMTP_PORT) || 587,
	smtpSecure: process.env.SMTP_SECURE === 'true',
	smtpUser: process.env.SMTP_USER || '',
	smtpPass: process.env.SMTP_PASS || '',
	passwordResetMinutes: Number(process.env.PASSWORD_RESET_MINUTES) || 30,
	emailVerificationMinutes:
		Number(process.env.EMAIL_VERIFICATION_MINUTES) || 60,
	// Optional: with a key, board background search covers all of Unsplash.
	unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY || '',
	// Uploaded pictures (avatars, card images, board backgrounds) go to Cloudinary when it
	// is configured, otherwise to this folder on the server.
	uploadsDir: path.resolve(process.env.UPLOADS_DIR || fileURLToPath(new URL('../uploads', import.meta.url))),
	// The built web app to serve from this server (self-hosting: one container, one address).
	frontendDist: process.env.FRONTEND_DIST ? path.resolve(process.env.FRONTEND_DIST) : '',
	// Secure cookies need HTTPS; a self-hosted server on plain http (home network) turns this off.
	cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : !isLocalEnvironment,
	// Optional photo search on the internet for board backgrounds; off for servers without internet.
	remotePhotos: process.env.REMOTE_PHOTOS !== 'false',
	// SIGNUP=closed: only the first account signs up itself; the admin adds the rest
	// (npm run create-user). For servers reachable from the internet.
	signupOpen: process.env.SIGNUP !== 'closed',
}

// Email works when one way of sending is set up. Without it (a self-hosted server
// with no mail), accounts need no email confirmation and emails are skipped.
// (Getters: tests switch the mail settings while running.)
Object.defineProperty(env, 'mailEnabled', {
	get: () => Boolean(env.mailFrom && (env.brevoApiKey || env.smtpHost)),
})
// New accounts confirm their email only when email can actually be sent. EMAIL_VERIFICATION
// (required | off) overrides it; local work and tests keep confirmation on.
Object.defineProperty(env, 'emailVerificationRequired', {
	get: () => (process.env.EMAIL_VERIFICATION ? process.env.EMAIL_VERIFICATION !== 'off' : env.mailEnabled || isLocalEnvironment),
})
