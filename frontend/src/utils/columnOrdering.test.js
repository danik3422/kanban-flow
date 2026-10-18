import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getColumnDropIndex, getColumnInsertionIndex, reorderColumns } from './columnOrdering.js'

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

	it('keeps a list where it was when it is picked up and put back', () => {
		for (const column of columns) {
			const index = columns.indexOf(column)
			assert.equal(getColumnDropIndex(columns, column._id, centers, centers[column._id]), index, column._id)
			// A little wobble either way does not move it.
			assert.equal(getColumnDropIndex(columns, column._id, centers, centers[column._id] - 60), index, `${column._id} left`)
			assert.equal(getColumnDropIndex(columns, column._id, centers, centers[column._id] + 60), index, `${column._id} right`)
		}
	})

	it('moves a list once its centre passes a neighbour', () => {
		assert.equal(getColumnDropIndex(columns, 'a', centers, 320), 1)
		assert.equal(getColumnDropIndex(columns, 'a', centers, 520), 2)
		assert.equal(getColumnDropIndex(columns, 'a', centers, 900), 3)
		assert.equal(getColumnDropIndex(columns, 'd', centers, 480), 2)
		assert.equal(getColumnDropIndex(columns, 'd', centers, 20), 0)
		assert.equal(getColumnDropIndex(columns, 'c', centers, 280), 1)
	})

	it('never puts a list in front of pinned lists', () => {
		const withPinned = [{ _id: 'p', pinned: true }, ...columns]
		assert.equal(getColumnDropIndex(withPinned, 'c', { ...centers, p: 0 }, -50), 1)
	})

	it('agrees with reorderColumns: putting a list back changes nothing', () => {
		for (const column of columns) {
			const index = getColumnDropIndex(columns, column._id, centers, centers[column._id])
			assert.deepEqual(reorderColumns(columns, column._id, index).map((item) => item._id), columns.map((item) => item._id))
		}
	})
})
