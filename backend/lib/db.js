import mongoose from 'mongoose'

import { env } from '../config/env.js'

let memoryServer = null

const connectToMemoryDatabase = async () => {
	// Board creation and member removal use transactions, which need a replica set.
	const { MongoMemoryReplSet } = await import('mongodb-memory-server')
	memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	const mongoUri = memoryServer.getUri()
	const connect = await mongoose.connect(mongoUri, {
		serverSelectionTimeoutMS: 5000,
	})
	console.warn(
		`MongoMemoryReplSet connected ${connect.connection.host}. Data will not persist after shutdown.`,
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
