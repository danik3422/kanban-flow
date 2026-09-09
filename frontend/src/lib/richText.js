import DOMPurify from 'dompurify'

export const sanitizeDescription = (value = '') =>
	DOMPurify.sanitize(value, {
		ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'ul', 'ol', 'li', 'a'],
		ALLOWED_ATTR: ['href', 'target', 'rel'],
		FORBID_ATTR: ['style', 'class', 'id'],
		ALLOW_DATA_ATTR: false,
	})
