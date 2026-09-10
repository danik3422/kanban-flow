import mongoose from 'mongoose'

const boardInviteSchema = new mongoose.Schema(
	{
		board: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Board',
			required: true,
		},
		email: { type: String, lowercase: true, trim: true, default: '' },
		role: { type: String, enum: ['admin', 'member'], default: 'member' },
		tokenVersion: { type: Number, default: 0 },
		visibilityVersion: { type: Number, default: 0 },
		tokenHash: { type: String, required: true, unique: true },
		expiresAt: { type: Date, required: true, index: { expires: 0 } },
		usedAt: { type: Date, default: null },
		acceptedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true },
)

const BoardInvite = mongoose.model('BoardInvite', boardInviteSchema)
export default BoardInvite
