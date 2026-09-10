import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import mongoose from 'mongoose'

import { env } from '../config/env.js'
import User from '../models/user.model.js'

const socialProviders = ['google', 'microsoft', 'apple']
const migrationLogPath =
	process.env.PASSWORD_FLAG_MIGRATION_LOG ||
	'backend/logs/password-flag-migration.jsonl'

const writeMigrationLog = async (event) => {
	await mkdir(dirname(migrationLogPath), { recursive: true })
	await appendFile(
		migrationLogPath,
		`${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`,
	)
}

const run = async () => {
	if (!env.mongoUri) throw new Error('MONGO_URI is required')
	await mongoose.connect(env.mongoUri)

	const localWithPasswordResult = await User.updateMany(
		{
			provider: 'local',
			password: { $exists: true, $nin: [null, ''] },
			hasPassword: { $ne: true },
		},
		{ $set: { hasPassword: true } },
	)
	const localWithoutPasswordResult = await User.updateMany(
		{
			provider: 'local',
			$or: [
				{ password: { $exists: false } },
				{ password: null },
				{ password: '' },
			],
			hasPassword: { $ne: false },
		},
		{ $set: { hasPassword: false } },
	)

	const socialUsers = await User.find({
		provider: { $in: socialProviders },
		hasPassword: { $exists: false },
	}).select('_id password')

	const socialUsersWithPasswords = socialUsers.filter((user) => user.password)
	if (socialUsersWithPasswords.length) {
		const warning = `Found ${socialUsersWithPasswords.length} social users with an existing password hash; preserving password access.`
		console.warn(warning)
		await writeMigrationLog({
			event: 'social_users_with_password_hash',
			count: socialUsersWithPasswords.length,
			message: warning,
		})
	}

	if (socialUsers.length) {
		await User.bulkWrite(
			socialUsers.map((user) => ({
				updateOne: {
					filter: { _id: user._id, hasPassword: { $exists: false } },
					update: { $set: { hasPassword: Boolean(user.password) } },
				},
			})),
		)
	}

	const summary = {
		event: 'password_flag_migration_complete',
		localWithPassword: localWithPasswordResult.modifiedCount,
		localWithoutPassword: localWithoutPasswordResult.modifiedCount,
		socialInitialized: socialUsers.length,
	}
	await writeMigrationLog(summary)
	console.log(JSON.stringify(summary))
}

run()
	.catch((error) => {
		console.error('Password flag migration failed:', error)
		process.exitCode = 1
	})
	.finally(() => mongoose.disconnect())