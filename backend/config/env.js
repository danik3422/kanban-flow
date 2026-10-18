import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
dotenv.config({ path: envPath })

const isProduction = process.env.NODE_ENV === 'production'
// Only an explicit local environment may fall back to a well-known secret; a server
// that merely forgot NODE_ENV must not sign sessions with a public value.
const isLocalEnvironment = ['development', 'test'].includes(process.env.NODE_ENV)
const configuredJwtSecret = process.env.JWT_SECRET?.trim() || ''
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
	passwordResetMinutes: Number(process.env.PASSWORD_RESET_MINUTES) || 30,
	emailVerificationMinutes:
		Number(process.env.EMAIL_VERIFICATION_MINUTES) || 60,
	// Optional: with a key, board background search covers all of Unsplash.
	unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY || '',
}
