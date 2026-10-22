import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareRows, tableRows } from './tableModel.js'

const columns = [
	{ _id: 'a', title: 'To do', tasks: [
		{ _id: '1', title: 'Write copy', position: 0, priority: 'low', dueDate: '2026-10-25T00:00:00.000Z', labels: ['Copy'] },
		{ _id: '2', title: 'Fix bug', position: 1, priority: 'urgent', labels: ['Bug'], completed: true },
	] },
	{ _id: 'b', title: 'Doing', tasks: [
		{ _id: '3', title: 'Design hero', position: 0, priority: 'none', dueDate: '2026-10-21T00:00:00.000Z', checklist: [{ completed: true }, { completed: false }] },
	] },
]
const ids = (rows) => rows.map((row) => row.task._id)
const sorted = (key, direction = 1) => ids(tableRows(columns).sort((l, r) => compareRows(l, r, key, 'en', direction)))

describe('table view', () => {
	it('lists cards in board order and filters them', () => {
		assert.deepEqual(ids(tableRows(columns)), ['1', '2', '3'])
		assert.deepEqual(ids(tableRows(columns, { hideDone: true })), ['1', '3'])
		assert.deepEqual(ids(tableRows(columns, { query: 'bug' })), ['2'])
		assert.deepEqual(ids(tableRows(columns, { passes: (task) => task.priority !== 'none' })), ['1', '2'])
	})

	it('sorts by title, due date (empty last), priority and checklist', () => {
		assert.deepEqual(sorted('title'), ['3', '2', '1'])
		assert.deepEqual(sorted('due'), ['3', '1', '2'])
		assert.deepEqual(sorted('priority'), ['2', '1', '3'])
		assert.deepEqual(sorted('checklist', -1), ['3', '1', '2'])
	})
})
