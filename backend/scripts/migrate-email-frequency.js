import mongoose from 'mongoose'

import { env } from '../config/env.js'
import User from '../models/user.model.js'

// One-off: people who had email turned off keep it off under the newer
// emailFrequency setting. Safe to run more than once.
const run = async () => {
	if (!env.mongoUri) throw new Error('MONGO_URI is required')
	await mongoose.connect(env.mongoUri)
	const result = await User.updateMany(
		{ emailNotifications: false, emailFrequency: { $exists: false } },
		{ $set: { emailFrequency: 'never' } },
	)
	console.log(JSON.stringify({ event: 'email_frequency_migration_complete', updated: result.modifiedCount }))
}

run()
	.catch((error) => {
		console.error('Email frequency migration failed:', error)
		process.exitCode = 1
	})
	.finally(() => mongoose.disconnect())
