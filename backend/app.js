import cookieParser from 'cookie-parser'
import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
import { csrfProtection } from './middlewares/csrf.middleware.js'
import { apiLimiter } from './middlewares/rateLimit.middleware.js'
import authRoutes from './routes/auth.routes.js'
import { isImageUploadPath } from './routes/board/attachments.routes.js'
import boardRoutes from './routes/board.routes.js'
import devRoutes from './routes/dev.routes.js'
import notificationRoutes from './routes/notifications.routes.js'

// The Express app: shared middleware, the health check and the API routes.
// index.js serves it over HTTP together with the live-update socket.
export const app = express()

app.disable('x-powered-by')
// Render and similar hosts terminate TLS at a proxy; without this every client
// shares the proxy IP and rate limits become global.
app.set('trust proxy', env.trustProxy)
// The web app's own page is served from here when self-hosting, so the content policy
// must let it run: its inline theme script, inline styles, pictures from anywhere it
// shows them, and live updates over WebSocket.
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com', 'https://www.gstatic.com'],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
			fontSrc: ["'self'", 'data:'],
			connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
			frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com', 'https://login.microsoftonline.com', 'https://appleid.apple.com'],
			workerSrc: ["'self'"],
			manifestSrc: ["'self'"],
			objectSrc: ["'none'"],
			baseUri: ["'self'"],
			frameAncestors: ["'none'"],
			formAction: ["'self'"],
			upgradeInsecureRequests: env.cookieSecure ? [] : null,
		},
	},
	// Popups for Google/Microsoft/Apple sign-in must be able to talk back.
	crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
	// Plain-http self-hosting must not be told to switch to HTTPS.
	strictTransportSecurity: env.cookieSecure,
}))
app.use(cookieParser())
app.use(
	cors({
		origin: env.corsOrigin,
		credentials: true,
	})
)

app.get('/health', (_req, res) => {
	res.status(200).json({ status: 'ok' })
})

// Pictures stored on this server (when Cloudinary is not used). Names are unique per
// upload, so they can be cached for good; other origins (the dev web app) may show them.
app.use('/uploads', (_req, res, next) => {
	res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
	next()
}, express.static(env.uploadsDir, { immutable: true, maxAge: '365d', index: false, fallthrough: false }))

// What this server offers, so one web app build adapts to it (hosted or self-hosted,
// with or without email and internet photos). Public: the sign-in screens need it.
app.get('/api/config', (_req, res) => {
	res.status(200).json({
		email: env.mailEnabled,
		emailVerification: env.emailVerificationRequired,
		photos: env.remotePhotos,
		selfHosted: Boolean(env.frontendDist),
		signup: env.signupOpen,
	})
})
// Cheap checks first, so blocked requests never get their body read.
app.use('/api', csrfProtection)
app.use('/api', apiLimiter)
// Avatar payloads are compressed client-side, but base64 adds overhead. Card images
// are the one upload that needs more room; that route parses its own body once the
// caller is signed in (routes/board/attachments.routes.js).
const jsonBody = express.json({ limit: '200kb' })
app.use((req, res, next) => (isImageUploadPath(req.path) ? next() : jsonBody(req, res, next)))

app.use('/api/auth', authRoutes)
app.use('/api/board', boardRoutes)
app.use('/api/notifications', notificationRoutes)

// Email previews and a manual run of the email jobs; local only.
if (env.isLocalEnvironment) app.use(devRoutes)

// Self-hosting: this server also serves the built web app, so everything lives at one
// address. Hashed files are cached for good; every other path gets the app's page.
if (env.frontendDist && fs.existsSync(path.join(env.frontendDist, 'index.html'))) {
	app.use('/assets', express.static(path.join(env.frontendDist, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false }))
	app.use(express.static(env.frontendDist, {
		index: false,
		setHeaders: (res, file) => {
			if (file.endsWith('sw.js') || file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
		},
	}))
	app.get(/^\/(?!api\/|socket\.io\/|uploads\/|health$).*/, (_req, res) => {
		res.setHeader('Cache-Control', 'no-cache')
		res.sendFile(path.join(env.frontendDist, 'index.html'))
	})
}
