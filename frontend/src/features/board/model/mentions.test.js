import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchPeople, mentionAt, mentionIdsIn, splitMentions } from './mentions.js'

const people = [
	{ _id: 'a', name: 'Olena Kovalenko', email: 'olena@example.com' },
	{ _id: 'b', name: 'Marco Rossi', email: 'marco@example.com' },
	{ _id: 'c', name: 'Olga', email: 'olga@example.com' },
]

describe('mentions', () => {
	it('finds the @word being typed', () => {
		assert.deepEqual(mentionAt('Hi @ol', 6), { start: 3, query: 'ol' })
		assert.deepEqual(mentionAt('@', 1), { start: 0, query: '' })
		assert.equal(mentionAt('mail@ol', 7), null)
		assert.equal(mentionAt('Hi @ol there', 12), null)
	})

	it('ranks people by how well they match', () => {
		assert.deepEqual(matchPeople(people, 'ol').map((person) => person._id), ['a', 'c'])
		assert.deepEqual(matchPeople(people, 'ross').map((person) => person._id), ['b'])
		assert.equal(matchPeople(people, '').length, 3)
	})

	it('collects who a comment calls on', () => {
		assert.deepEqual(mentionIdsIn('@Olena Kovalenko and @Marco Rossi, look', people), ['a', 'b'])
		assert.deepEqual(mentionIdsIn('email@Olga.com', people), [])
		assert.deepEqual(mentionIdsIn('@Olga!', people), ['c'])
	})

	it('splits a comment into text and mentions', () => {
		const parts = splitMentions('Thanks @Olena Kovalenko!', people)
		assert.deepEqual(parts.map((part) => [part.text, part.person?._id]), [['Thanks ', undefined], ['@Olena Kovalenko', 'a'], ['!', undefined]])
		assert.deepEqual(splitMentions('plain', []), [{ text: 'plain' }])
	})
})
