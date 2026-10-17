export const cx = (...classes) => classes.filter(Boolean).join(' ')

export const initialsOf = (name = '') =>
	name
		.trim()
		.split(/[\s@._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join('') || '?'
