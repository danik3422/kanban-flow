import mongoose from 'mongoose'

// For router.param: answer 400 before a malformed id reaches a database query.
export const validateObjectIdParam = (req, res, next, value) => {
	if (!mongoose.Types.ObjectId.isValid(value)) {
		return res.status(400).json({ message: 'Invalid ID' })
	}
	next()
}

// router.param only applies to the router it is registered on, so every router
// that uses these params registers them itself.
export const validateObjectIdParams = (router, names = ['id', 'memberId', 'inviteId']) => {
	for (const name of names) router.param(name, validateObjectIdParam)
}
