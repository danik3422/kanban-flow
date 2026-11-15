/**
 * Copies text. The Clipboard API needs a secure page (https or localhost); a self-hosted
 * server on plain http over the network has none, so it falls back to a hidden text field.
 * Throws when neither works, so callers can say so.
 */
export const copyToClipboard = async (text) => {
	if (navigator.clipboard?.writeText && window.isSecureContext !== false) {
		await navigator.clipboard.writeText(text)
		return
	}
	const field = document.createElement('textarea')
	field.value = text
	field.setAttribute('readonly', '')
	field.style.position = 'fixed'
	field.style.opacity = '0'
	document.body.appendChild(field)
	field.select()
	const copied = document.execCommand('copy')
	field.remove()
	if (!copied) throw new Error('Copy failed')
}
