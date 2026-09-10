import bcrypt from 'bcrypt'

import { passwordSchema } from './validation.js'

export const assertValidPassword = (password) => {
	const result = passwordSchema.safeParse(password)
	if (!result.success) {
		const error = new Error('Password must be between 8 and 128 characters long.')
		error.statusCode = 400
		throw error
	}
	return result.data
}

export const hashPassword = async (password) => {
	const validPassword = assertValidPassword(password)
	const salt = await bcrypt.genSalt(10)
	return bcrypt.hash(validPassword, salt)
}