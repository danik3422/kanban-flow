// @name mentions in comments: finding the one being typed, who a comment calls on and
// splitting a comment into text and mentions for display.

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The @word right before the caret, or null: `{ start, query }` (start is where "@" is). */
export const mentionAt = (text, caret) => {
	const match = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret))
	return match ? { start: caret - match[2].length - 1, query: match[2] } : null
}

/** People whose name or email starts a word with the query, best matches first. */
export const matchPeople = (people, query, limit = 6) => {
	const needle = query.toLowerCase()
	const score = (person) => {
		const name = (person.name || '').toLowerCase()
		const email = (person.email || '').toLowerCase()
		if (!needle) return 1
		if (name.startsWith(needle) || email.startsWith(needle)) return 3
		if (name.split(/\s+/).some((word) => word.startsWith(needle))) return 2
		return name.includes(needle) || email.includes(needle) ? 1 : 0
	}
	return people
		.map((person) => ({ person, rank: score(person) }))
		.filter((item) => item.rank > 0 && item.person.name)
		.sort((a, b) => b.rank - a.rank || a.person.name.localeCompare(b.person.name))
		.slice(0, limit)
		.map((item) => item.person)
}

/** Ids of the people a comment calls on by "@Name". */
export const mentionIdsIn = (text, people) => people
	.filter((person) => person.name && new RegExp(`(^|\\s)@${escapeRegExp(person.name)}(?=$|[\\s.,!?;:)])`, 'u').test(text))
	.map((person) => String(person._id))

/** The comment as parts: `{ text }` or `{ text, person }` for each "@Name" of someone mentioned. */
export const splitMentions = (text, people = []) => {
	const named = people.filter((person) => person?.name).sort((a, b) => b.name.length - a.name.length)
	if (!named.length) return [{ text }]
	const byName = new Map(named.map((person) => [`@${person.name}`, person]))
	const pattern = new RegExp(`(${named.map((person) => escapeRegExp(`@${person.name}`)).join('|')})`, 'gu')
	return text.split(pattern).filter(Boolean).map((part) => (byName.has(part) ? { text: part, person: byName.get(part) } : { text: part }))
}
