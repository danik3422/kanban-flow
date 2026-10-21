// Same contrast-checked soft pairs as avatars, so every board gets a stable color in both themes.
const TONES = ['accent', 'info', 'orange', 'success', 'warning', 'danger']

export const boardToneFor = (seed = '') => {
	let hash = 0
	for (const character of String(seed)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
	return TONES[hash % TONES.length]
}
