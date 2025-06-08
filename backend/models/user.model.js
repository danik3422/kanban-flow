import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, unique: true },
		password: { type: String },
		name: { type: String, default: '' },
		avatar: { type: String, default: '' },
		provider: {
			type: String,
			enum: ['local', 'google', 'microsoft', 'apple'],
			default: 'local',
		},
		profileSetup: { type: Boolean, default: false },
	},
	{ timestamps: true }
)

const User = mongoose.model('User', userSchema)
export default User
