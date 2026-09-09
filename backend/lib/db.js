import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { env } from '../config/env.js'

let memoryServer = null

const connectToMemoryDatabase = async () => {
	memoryServer = await MongoMemoryServer.create()
	const mongoUri = memoryServer.getUri()
	const connect = await mongoose.connect(mongoUri, {
		serverSelectionTimeoutMS: 5000,
	})
	console.warn(
		`MongoMemoryServer connected ${connect.connection.host}. Data will not persist after shutdown.`,
	)
}

export const connectDB = async () => {
	if (!env.mongoUri) {
		if (!env.allowMemoryDb) {
			throw new Error('MONGO_URI is required when ALLOW_MEMORY_DB is not enabled')
		}
		await connectToMemoryDatabase()
		return
	}

	try {
		const connect = await mongoose.connect(env.mongoUri, {
			serverSelectionTimeoutMS: 5000,
		})
		console.log(`MongoDB connected ${connect.connection.host}`)
	} catch (error) {
		console.error('MongoDB connection failed:', error)
		if (!env.allowMemoryDb) throw error

		console.warn('Using the explicitly enabled in-memory database fallback.')
		await connectToMemoryDatabase()
	}
}

export const closeDB = async () => {
	try {
		await mongoose.disconnect()
		if (memoryServer) {
			await memoryServer.stop()
		}
	} catch (error) {
		console.error('Database shutdown failed:', error)
	}
}
