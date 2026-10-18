import mongoose from 'mongoose'

// One signed-in device. The session cookie names it (sid), so each device can be
// listed and signed out on its own; it expires with the cookie.
const sessionSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	sid: { type: String, required: true, unique: true },
	userAgent: { type: String, default: '' },
	ip: { type: String, default: '' },
	// How it signed in: password, passkey, signup, restored or a provider (google, github…).
	method: { type: String, default: 'password', maxlength: 20 },
	lastSeenAt: { type: Date, default: Date.now },
	expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: { createdAt: true, updatedAt: false } })

const Session = mongoose.model('Session', sessionSchema)
export default Session
