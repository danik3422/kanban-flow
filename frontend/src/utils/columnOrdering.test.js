import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getColumnInsertionIndex, reorderColumns } from './columnOrdering.js'

const columns = [
	{ _id: 'a', title: 'A', position: 0 },
	{ _id: 'b', title: 'B', position: 1 },
	{ _id: 'c', title: 'C', position: 2 },
	{ _id: 'd', title: 'D', position: 3 },
]
const centers = { a: 100, b: 300, c: 500, d: 700 }

describe('column ordering', () => {
	it('ignores the dragged column when calculating its insertion slot', () => {
		assert.equal(getColumnInsertionIndex(columns, 'a', centers, 280), 0)
		assert.equal(getColumnInsertionIndex(columns, 'a', centers, 520), 2)
	})

	it('supports inserting after the final column', () => {
		assert.equal(getColumnInsertionIndex(columns, 'a', centers, 900), 3)
	})

	it('reorders columns and normalizes positions', () => {
		const reordered = reorderColumns(columns, 'a', 2)
		assert.deepEqual(reordered.map((column) => column._id), ['b', 'c', 'a', 'd'])
		assert.deepEqual(reordered.map((column) => column.position), [0, 1, 2, 3])
	})
})
