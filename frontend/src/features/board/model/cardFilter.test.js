import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { activeFilterCount, boardLabels, EMPTY_FILTER, matchesCardFilter, NO_MEMBER, toggleIn } from './cardFilter.js'

const now = new Date(2026, 9, 18, 12)
const card = (fields) => ({ title: 'Card', labels: [], assignees: [], priority: 'none', dueDate: null, ...fields })
const filter = (fields) => ({ ...EMPTY_FILTER, ...fields })
const at = (day) => new Date(Date.UTC(2026, 9, day)).toISOString()

describe('card filter', () => {
	it('matches everything when empty', () => {
		assert.equal(matchesCardFilter(card({}), EMPTY_FILTER, { now }), true)
		assert.equal(activeFilterCount(EMPTY_FILTER), 0)
	})

	it('finds words in the title, description and labels, all words required', () => {
		const task = card({ title: 'Landing page', description: 'Hero and pricing', labels: ['Design'] })
		assert.equal(matchesCardFilter(task, filter({ text: 'landing' }), { now }), true)
		assert.equal(matchesCardFilter(task, filter({ text: 'pricing design' }), { now }), true)
		assert.equal(matchesCardFilter(task, filter({ text: 'pricing backend' }), { now }), false)
	})

	it('members: any of the picked people, or no one', () => {
		const mine = card({ assignees: [{ _id: 'me' }] })
		const nobody = card({})
		assert.equal(matchesCardFilter(mine, filter({ members: ['me'] }), { now }), true)
		assert.equal(matchesCardFilter(mine, filter({ members: ['ana'] }), { now }), false)
		assert.equal(matchesCardFilter(nobody, filter({ members: [NO_MEMBER] }), { now }), true)
		assert.equal(matchesCardFilter(mine, filter({ members: ['ana', 'me'] }), { now }), true)
	})

	it('due dates: overdue, today, this week, none; finished cards are never overdue', () => {
		assert.equal(matchesCardFilter(card({ dueDate: at(10) }), filter({ due: ['overdue'] }), { now }), true)
		assert.equal(matchesCardFilter(card({ dueDate: at(10) }), filter({ due: ['overdue'] }), { now, done: true }), false)
		assert.equal(matchesCardFilter(card({ dueDate: at(18) }), filter({ due: ['today'] }), { now }), true)
		assert.equal(matchesCardFilter(card({ dueDate: at(23) }), filter({ due: ['week'] }), { now }), true)
		assert.equal(matchesCardFilter(card({ dueDate: at(26) }), filter({ due: ['week'] }), { now }), false)
		assert.equal(matchesCardFilter(card({}), filter({ due: ['none'] }), { now }), true)
		assert.equal(matchesCardFilter(card({ dueDate: at(10) }), filter({ due: ['none', 'overdue'] }), { now }), true)
	})

	it('priority and labels, and all groups together', () => {
		const task = card({ priority: 'high', labels: ['Design'], assignees: ['me'] })
		assert.equal(matchesCardFilter(task, filter({ priority: ['high', 'urgent'] }), { now }), true)
		assert.equal(matchesCardFilter(card({}), filter({ priority: ['none'] }), { now }), true)
		assert.equal(matchesCardFilter(task, filter({ labels: ['Backend'] }), { now }), false)
		assert.equal(matchesCardFilter(task, filter({ labels: ['Design'], members: ['me'], priority: ['high'] }), { now }), true)
		assert.equal(matchesCardFilter(task, filter({ labels: ['Design'], members: ['ana'] }), { now }), false)
		assert.equal(activeFilterCount(filter({ text: 'x', labels: ['a', 'b'] })), 3)
	})

	it('lists labels by use and toggles choices', () => {
		assert.deepEqual(boardLabels([{ tasks: [card({ labels: ['B', 'A'] }), card({ labels: ['B'] })] }]), ['B', 'A'])
		assert.deepEqual(toggleIn(['a'], 'b'), ['a', 'b'])
		assert.deepEqual(toggleIn(['a', 'b'], 'a'), ['b'])
	})
})
