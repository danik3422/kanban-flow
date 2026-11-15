import http from 'node:http'
import mongoose from 'mongoose'

import { app } from './app.js'
import { env } from './config/env.js'
import { startEmailJobs, stopEmailJobs } from './emails/jobs.js'
import { connectDB } from './lib/db.js'
import { createSocketServer } from './realtime/socketServer.js'
import { startAutomationJobs, stopAutomationJobs } from './services/automation.service.js'

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

// On `docker compose down`, a restart or an update: stop taking new work, let requests
// in flight finish, then close the database. Forced out after 10 seconds.
let shuttingDown = false
export const stopServer = async (signal) => {
	if (shuttingDown) return
	shuttingDown = true
	console.log(`${signal} received, shutting down`)
	const force = setTimeout(() => {
		console.error('Shutdown took too long, exiting')
		process.exit(1)
	}, 10_000)
	force.unref()
	try {
		stopEmailJobs()
		stopAutomationJobs()
		await new Promise((resolve) => io.close(() => resolve()))
		if (httpServer.listening) await new Promise((resolve) => httpServer.close(() => resolve()))
		await mongoose.disconnect()
		process.exitCode = 0
	} catch (error) {
		console.error('Shutdown failed:', error)
		process.exitCode = 1
	}
}

export { app, httpServer, io }

// Tests import the app without starting a server.
if (process.env.NODE_ENV !== 'test') {
	process.on('SIGTERM', () => void stopServer('SIGTERM'))
	process.on('SIGINT', () => void stopServer('SIGINT'))
	process.on('unhandledRejection', (reason) => {
		console.error('Unhandled promise rejection:', reason)
	})
	process.on('uncaughtException', (error) => {
		console.error('Uncaught exception, exiting:', error)
		process.exit(1)
	})
	startServer().catch((error) => {
		console.error('Server startup failed:', error)
		process.exitCode = 1
	})
}
