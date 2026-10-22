// Shortcuts work in any keyboard layout. A key that types a Latin letter is taken as that
// letter (so AZERTY or Dvorak keep their own letters); a key that types something else,
// such as a Cyrillic letter, is taken by its place on the keyboard, as on an English one.
export const shortcutKey = (event) => {
	const key = (event.key || '').toLowerCase()
	if (/^[a-z0-9]$/.test(key) || key === '?' || key === '/') return key
	const code = event.code || ''
	if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
	if (/^Digit\d$/.test(code)) return code.slice(5)
	if (code === 'Slash') return event.shiftKey ? '?' : '/'
	return key
}
