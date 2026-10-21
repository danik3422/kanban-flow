import cookieParser from 'cookie-parser'
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
app.use(helmet())
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
