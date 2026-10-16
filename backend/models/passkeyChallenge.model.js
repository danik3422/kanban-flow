import mongoose from 'mongoose'

// Sign-in challenges are not tied to a user: discoverable passkeys let the
// browser pick the account, so the challenge is looked up by its own value.
const passkeyChallengeSchema = new mongoose.Schema({
	challenge: { type: String, required: true, unique: true },
	expiresAt: { type: Date, required: true, index: { expires: 0 } },
})

const PasskeyChallenge = mongoose.model('PasskeyChallenge', passkeyChallengeSchema)
export default PasskeyChallenge
