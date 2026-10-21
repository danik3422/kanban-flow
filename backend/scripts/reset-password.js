import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { env } from '../config/env.js'
import Session from '../models/session.model.js'
import User from '../models/user.model.js'
import { hashPassword } from '../services/password.service.js'

// For servers without email: the admin sets a new password for someone.
//   npm run reset-password -- person@example.com            (prints a new random password)
//   npm run reset-password -- person@example.com 'NewPass1!'
// Every device of that account is signed out.
const [email, given] = process.argv.slice(2)

const run = async () => {
	if (!email) throw new Error('Usage: npm run reset-password -- person@example.com [new-password]')
	if (!env.mongoUri) throw new Error('MONGO_URI is required')
	await mongoose.connect(env.mongoUri)
	const user = await User.findOne({ email: email.trim().toLowerCase() })
	if (!user) throw new Error(`No account with the email ${email}`)
	const password = given || `${crypto.randomBytes(9).toString('base64url')}A1!`
	user.password = await hashPassword(password)
	user.hasPassword = true
	user.emailVerified = true
	user.sessionVersion = Number(user.sessionVersion || 0) + 1
	await user.save()
	await Session.deleteMany({ user: user._id })
	console.log(`New password for ${user.email}: ${password}`)
	console.log('They should change it in Settings → Sign-in & security after signing in.')
}

run()
	.catch((error) => {
		console.error(error.message)
		process.exitCode = 1
	})
	.finally(() => mongoose.disconnect())
