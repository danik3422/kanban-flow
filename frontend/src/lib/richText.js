import DOMPurify from 'dompurify'

// Links opened in a new tab must not get a handle on this window.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A' && node.hasAttribute('target')) {
		node.setAttribute('target', '_blank')
		node.setAttribute('rel', 'noopener noreferrer')
	}
})

export const sanitizeDescription = (value = '') =>
	DOMPurify.sanitize(value, {
		ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'ul', 'ol', 'li', 'a'],
		ALLOWED_ATTR: ['href', 'target', 'rel'],
		FORBID_ATTR: ['style', 'class', 'id'],
		ALLOW_DATA_ATTR: false,
	})

// DOMParser builds an inert document, so this never runs markup from the description.
export const toPlainText = (value = '') => {
	if (!value) return ''
	const text = new DOMParser().parseFromString(value, 'text/html').body.textContent || ''
	return text.replace(/\s+/g, ' ').trim()
}
