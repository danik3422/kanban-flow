import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, unique: true },
		password: { type: String },
		name: { type: String, default: '' },
		jobTitle: { type: String, default: '' },
		timezone: { type: String, default: 'UTC' },
		emailNotifications: { type: Boolean, default: true },
		taskNotifications: { type: Boolean, default: true },
		weeklyDigest: { type: Boolean, default: false },
		language: { type: String, enum: ['en', 'uk', 'ru'], default: 'en' },
		avatar: { type: String, default: '' },
		provider: {
			type: String,
			enum: ['local', 'google', 'microsoft', 'apple'],
			default: 'local',
		},
		emailVerified: { type: Boolean, default: false },
		emailVerificationTokenHash: { type: String, default: '' },
		emailVerificationTokenExpiresAt: { type: Date, default: null },
		profileSetup: { type: Boolean, default: false },
	},
	{ timestamps: true }
)

const User = mongoose.model('User', userSchema)
export default User
