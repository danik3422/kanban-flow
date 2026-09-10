import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, unique: true },
		password: { type: String },
        hasPassword: { type: Boolean, default: false },
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
		providerUid: { type: String, sparse: true, index: true },
		emailVerified: { type: Boolean, default: false },
		emailVerificationTokenHash: { type: String, default: '' },
		emailVerificationTokenExpiresAt: { type: Date, default: null },
		profileSetup: { type: Boolean, default: false },
		sessionVersion: { type: Number, default: 0 },
	},
	{ timestamps: true }
)

userSchema.index(
	{ provider: 1, providerUid: 1 },
	{
		unique: true,
		partialFilterExpression: {
			providerUid: { $exists: true, $type: 'string' },
		},
	},
)

const User = mongoose.model('User', userSchema)
export default User
