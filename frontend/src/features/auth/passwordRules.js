// The same rules the sign-up and reset forms show; the server enforces length.
export const passwordChecksFor = (password = '') => ({
	length: password.length >= 8,
	uppercase: /[A-Z]/.test(password),
	number: /\d/.test(password),
	special: /[^A-Za-z0-9]/.test(password),
})

export const meetsPasswordRules = (password) => Object.values(passwordChecksFor(password)).every(Boolean)
