import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
		},
		password: {
			type: String,
		},
		name: {
			type: String,
			required: true,
		},
		avatar: {
			type: String,
			default: '',
		},
		provider: {
			type: String,
			enum: ['local', 'google', 'microsoft', 'apple'],
			default: 'local',
		},
	},
	{ timestamps: true }
)

const User = mongoose.model('User', userSchema)
export default User
