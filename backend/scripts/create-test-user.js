import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { connectDB } from '../lib/db.js'
import User from '../models/user.model.js'

await connectDB()

const salt = await bcrypt.genSalt(10)
const hashedPassword = await bcrypt.hash('password123', salt)

const user = await User.findOneAndUpdate(
	{ email: 'demo@example.com' },
	{
		email: 'demo@example.com',
		password: hashedPassword,
		name: 'Demo User',
		emailVerified: false,
		profileSetup: false,
	},
	{ upsert: true, new: true }
)

console.log('User created:', user.email, 'EmailVerified:', user.emailVerified)
process.exit(0)
