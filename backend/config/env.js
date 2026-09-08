import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
dotenv.config({ path: envPath })

export const env = {
	port: Number(process.env.PORT) || 5001,
	isProduction: process.env.NODE_ENV === 'production',
	jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
	mongoUri: process.env.MONGO_URI || '',
	corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
	frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
	mailFrom: process.env.MAIL_FROM || '',
	passwordResetMinutes: Number(process.env.PASSWORD_RESET_MINUTES) || 30,
	smtp: {
		host: process.env.SMTP_HOST || '',
		port: Number(process.env.SMTP_PORT) || 587,
		secure: process.env.SMTP_SECURE === 'true',
		user: process.env.SMTP_USER || '',
		password: process.env.SMTP_PASSWORD || '',
	},
}
