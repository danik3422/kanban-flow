import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cardDropIndex, isSamePlace, moveCardInColumns } from './cardOrdering.js'

const board = () => [
	{ _id: 'a', tasks: [{ _id: '1' }, { _id: '2' }, { _id: '3' }] },
	{ _id: 'b', tasks: [{ _id: '4' }] },
	{ _id: 'c', tasks: [] },
]
const ids = (columns) => columns.map((column) => column.tasks.map((task) => task._id).join('')).join('|')

describe('card ordering', () => {
	it('finds the slot from the dragged card’s middle', () => {
		assert.equal(cardDropIndex([50, 150, 250], 10), 0)
		assert.equal(cardDropIndex([50, 150, 250], 120), 1)
		assert.equal(cardDropIndex([50, 150, 250], 400), 3)
		assert.equal(cardDropIndex([], 99), 0)
	})

	it('moves within a list and across lists', () => {
		assert.equal(ids(moveCardInColumns(board(), '1', 'a', 2)), '231|4|')
		assert.equal(ids(moveCardInColumns(board(), '3', 'a', 0)), '312|4|')
		assert.equal(ids(moveCardInColumns(board(), '2', 'b', 0)), '13|24|')
		assert.equal(ids(moveCardInColumns(board(), '2', 'b', 9)), '13|42|')
		assert.equal(ids(moveCardInColumns(board(), '4', 'c', 0)), '123||4')
		const moved = moveCardInColumns(board(), '2', 'b', 0)
		assert.equal(moved[1].tasks[0].column, 'b')
		assert.deepEqual(moved[0].tasks.map((task) => task.position), [0, 1])
	})

	it('knows a drop in the same place changes nothing', () => {
		assert.equal(isSamePlace(board(), '2', 'a', 1), true)
		assert.equal(isSamePlace(board(), '2', 'a', 0), false)
		assert.equal(isSamePlace(board(), '2', 'b', 1), false)
	})
})
