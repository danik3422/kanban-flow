import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { env } from '../config/env.js'

let memoryServer = null

export const connectDB = async () => {
	try {
		if (!env.mongoUri) {
			memoryServer = await MongoMemoryServer.create()
			const mongoUri = memoryServer.getUri()
			const connect = await mongoose.connect(mongoUri)
			console.log(
				`MongoMemoryServer connected ${connect.connection.host}`
			)
			return
		}

		const connect = await mongoose.connect(env.mongoUri)
		console.log(`MongoDB connected ${connect.connection.host}`)
	} catch (error) {
		console.log('MongoDB connection failed, falling back to in-memory database...')
		try {
			memoryServer = await MongoMemoryServer.create()
			const mongoUri = memoryServer.getUri()
			const connect = await mongoose.connect(mongoUri)
			console.log(
				`MongoMemoryServer connected ${connect.connection.host}`
			)
		} catch (memoryError) {
			console.error('MongoMemoryServer fallback failed:', memoryError)
		}
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
