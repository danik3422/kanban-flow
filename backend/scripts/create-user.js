import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { env } from '../config/env.js'
import User from '../models/user.model.js'
import { hashPassword } from '../services/password.service.js'

// For servers with sign-up closed (SIGNUP=closed): the admin adds an account.
//   npm run create-user -- person@example.com              (prints a random password)
//   npm run create-user -- person@example.com 'Pass1234!'
// The account is ready to use; the person sets their name on first sign-in.
const [email, given] = process.argv.slice(2)

const run = async () => {
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: npm run create-user -- person@example.com [password]')
	if (!env.mongoUri) throw new Error('MONGO_URI is required')
	await mongoose.connect(env.mongoUri)
	const normalized = email.trim().toLowerCase()
	if (await User.exists({ email: normalized })) throw new Error(`An account with ${normalized} already exists (use npm run reset-password to change its password)`)
	const password = given || `${crypto.randomBytes(9).toString('base64url')}A1!`
	await User.create({ email: normalized, password: await hashPassword(password), hasPassword: true, provider: 'local', emailVerified: true, profileSetup: false })
	console.log(`Account created for ${normalized} with the password: ${password}`)
	console.log('They should change it in Settings → Sign-in & security after signing in.')
}

run()
	.catch((error) => {
		console.error(error.message)
		process.exitCode = 1
	})
	.finally(() => mongoose.disconnect())
