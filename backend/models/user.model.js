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
		// Email about board activity: never, an hourly digest, or one email per event.
		emailFrequency: { type: String, enum: ['never', 'periodic', 'instant'], default: 'instant' },
		// Which kinds of board activity email covers. Being added to a card, invites and
		// account security always email (unless the frequency is "never" for activity).
		emailPreferences: {
			type: new mongoose.Schema({
				comments: { type: Boolean, default: true },
				dueDates: { type: Boolean, default: true },
				removed: { type: Boolean, default: true },
				cardsCreated: { type: Boolean, default: true },
				cardsMoved: { type: Boolean, default: true },
			}, { _id: false }),
			default: () => ({}),
		},
		lastDigestSentAt: { type: Date, default: null },
		// Pop-ups on the desktop; each browser still has to allow them once.
		desktopNotifications: { type: Boolean, default: true },
		taskNotifications: { type: Boolean, default: true },
		taskNotificationEmailLastSentAt: { type: Date, default: null },
		weeklyDigest: { type: Boolean, default: false },
		language: { type: String, enum: ['en', 'uk', 'ru'], default: 'en' },
		avatar: { type: String, default: '' },
		provider: {
			type: String,
			enum: ['local', 'google', 'microsoft', 'apple'],
			default: 'local',
		},
		providerUid: { type: String, sparse: true, index: true },
		linkedProviders: [{
			provider: { type: String, enum: ['google', 'microsoft', 'apple'], required: true },
			providerUid: { type: String, required: true },
			linkedAt: { type: Date, default: Date.now },
		}],
		emailVerified: { type: Boolean, default: false },
		emailVerificationTokenHash: { type: String, default: '' },
		emailVerificationTokenExpiresAt: { type: Date, default: null },
		emailVerificationLastSentAt: { type: Date, default: null },
		profileSetup: { type: Boolean, default: false },
		sessionVersion: { type: Number, default: 0 },
		lastReauthenticatedAt: { type: Date, default: null },
		passkeys: [{
			credentialID: { type: String, required: true },
			publicKey: { type: Buffer, required: true },
			counter: { type: Number, default: 0 },
			transports: [{ type: String }],
			// What the owner called it, and which password manager or device holds it.
			name: { type: String, default: '', maxlength: 60 },
			provider: { type: String, default: '' },
			createdAt: { type: Date, default: Date.now },
			lastUsedAt: { type: Date, default: null },
		}],
		passkeyRegistrationChallenge: { type: String, default: '' },
		// The secret calendar link (services/calendarFeed.service.js): a hash of its token,
		// and a counter that makes a new token when the old link is reset.
		calendarTokenHash: { type: String, default: undefined, select: false },
		calendarTokenVersion: { type: Number, default: 0 },
		passkeyRegistrationChallengeExpiresAt: { type: Date, default: null },
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

userSchema.index(
	{ 'linkedProviders.provider': 1, 'linkedProviders.providerUid': 1 },
	{
		unique: true,
		partialFilterExpression: {
			'linkedProviders.providerUid': { $exists: true, $type: 'string' },
		},
	},
)

// Calendar apps fetch the feed by its token.
userSchema.index({ calendarTokenHash: 1 }, { sparse: true })

// Passkey sign-in looks the account up by credential.
userSchema.index({ 'passkeys.credentialID': 1 }, { sparse: true })

const User = mongoose.model('User', userSchema)
export default User
