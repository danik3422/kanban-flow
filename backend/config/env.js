import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
dotenv.config({ path: envPath })

const isProduction = process.env.NODE_ENV === 'production'
const configuredJwtSecret = process.env.JWT_SECRET?.trim() || ''
const jwtSecret = configuredJwtSecret || 'dev-secret-change-me'

if (isProduction && configuredJwtSecret.length < 32) {
	throw new Error(
		'JWT_SECRET must be configured with at least 32 characters in production',
	)
}

const parseCorsOrigins = () => {
	const raw = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5179'
	return raw
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
}

export const env = {
	port: Number(process.env.PORT) || 5001,
	isProduction,
	allowMemoryDb: !isProduction && process.env.ALLOW_MEMORY_DB === 'true',
	jwtSecret,
	mongoUri: process.env.MONGO_URI || '',
	corsOrigin: parseCorsOrigins(),
	frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
	mailFrom: process.env.MAIL_FROM || '',
	passwordResetMinutes: Number(process.env.PASSWORD_RESET_MINUTES) || 30,
	emailVerificationMinutes:
		Number(process.env.EMAIL_VERIFICATION_MINUTES) || 60,
	smtp: {
		host: process.env.SMTP_HOST || '',
		port: Number(process.env.SMTP_PORT) || 587,
		secure: process.env.SMTP_SECURE === 'true',
		user: process.env.SMTP_USER || '',
		password: process.env.SMTP_PASSWORD || '',
	},
}
