import http from 'node:http'

import { app } from './app.js'
import { env } from './config/env.js'
import { startEmailJobs } from './emails/jobs.js'
import { connectDB } from './lib/db.js'
import { createSocketServer } from './realtime/socketServer.js'
import { startAutomationJobs } from './services/automation.service.js'

// Entry point: one HTTP server carries both the API and the live-update socket.
const httpServer = http.createServer(app)
const io = createSocketServer(httpServer)

// Connect the database before accepting requests so auth never runs against an
// unready MongoDB connection.
export const startServer = async () => {
	await connectDB()
	startEmailJobs()
	startAutomationJobs()
	httpServer.listen(env.port, () => {
		console.log(`Server is running on port ${env.port}`)
	})
}

export { app, httpServer, io }

// Tests import the app without starting a server.
if (process.env.NODE_ENV !== 'test') {
	startServer().catch((error) => {
		console.error('Server startup failed:', error)
		process.exitCode = 1
	})
}
