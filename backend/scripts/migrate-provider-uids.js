import mongoose from 'mongoose'

import { env } from '../config/env.js'
import User from '../models/user.model.js'

const run = async () => {
	if (!env.mongoUri) throw new Error('MONGO_URI is required')
	await mongoose.connect(env.mongoUri)

	const result = await User.updateMany(
		{
			provider: { $in: ['google', 'microsoft', 'apple'] },
			providerUid: { $exists: false },
		},
		{ $set: { providerUid: null } },
	)
	// createIndexes adds what the schema declares; syncIndexes would also drop any index made by hand.
	await User.createIndexes()

	console.log(`Normalized ${result.modifiedCount} social users and created missing User indexes.`)
}

run()
	.catch((error) => {
		console.error('Provider UID migration failed:', error)
		process.exitCode = 1
	})
	.finally(() => mongoose.disconnect())