import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	addColumn,
	addTask,
	applyColumnOrder,
	applyColumnSort,
	applyTaskUpdate,
	mergeColumn,
	removeColumn,
	removeTask,
	replaceTask,
	setColumnTasks,
} from './boardColumns.js'

const board = () => [
	{
		_id: 'todo',
		position: 0,
		sortBy: 'custom',
		tasks: [
			{ _id: 'a', column: 'todo', title: 'Beta', position: 0 },
			{ _id: 'b', column: 'todo', title: 'Alpha', position: 1 },
		],
	},
	{ _id: 'done', position: 1, sortBy: 'name-alpha', tasks: [{ _id: 'c', column: 'done', title: 'Zed', position: 0 }] },
]
const ids = (columns) => columns.map((column) => `${column._id}:${column.tasks.map((task) => task._id).join('')}`)

describe('board column transitions', () => {
	it('adds a task once, in the column sort order', () => {
		const once = addTask(board(), { _id: 'd', column: 'done', title: 'Apple', position: 1 })
		assert.deepEqual(ids(once), ['todo:ab', 'done:dc'])
		assert.deepEqual(ids(addTask(once, { _id: 'd', column: 'done', title: 'Apple' })), ['todo:ab', 'done:dc'])
	})

	it('moves an updated task into its new column and out of the old one', () => {
		const moved = replaceTask(board(), { _id: 'a', column: 'done', title: 'Beta', position: 1 })
		assert.deepEqual(ids(moved), ['todo:b', 'done:ac'])
	})

	it('removes a task from every column', () => {
		assert.deepEqual(ids(removeTask(board(), 'b')), ['todo:a', 'done:c'])
	})

	it('replaces a column task list using the column sort', () => {
		const next = setColumnTasks(board(), 'done', [
			{ _id: 'c', title: 'Zed' },
			{ _id: 'e', title: 'Ant' },
		])
		assert.deepEqual(ids(next), ['todo:ab', 'done:ec'])
	})

	it('merges column fields and re-sorts tasks when the sort changes', () => {
		assert.equal(mergeColumn(board(), { _id: 'todo', title: 'Doing' })[0].title, 'Doing')
		const sorted = applyColumnSort(board(), { _id: 'todo', sortBy: 'name-alpha' })
		assert.deepEqual(ids(sorted), ['todo:ba', 'done:c'])
		assert.equal(sorted[0].sortBy, 'name-alpha')
	})

	it('adds a column once by position and removes it', () => {
		const added = addColumn(board(), { _id: 'mid', position: 0.5 })
		assert.deepEqual(ids(added), ['todo:ab', 'mid:', 'done:c'])
		assert.equal(addColumn(added, { _id: 'mid', position: 0.5 }), added)
		assert.deepEqual(ids(removeColumn(added, 'mid')), ['todo:ab', 'done:c'])
	})

	it('reorders columns and keeps their loaded tasks', () => {
		const next = applyColumnOrder(board(), [{ _id: 'done', position: 0 }, { _id: 'todo', position: 1 }])
		assert.deepEqual(ids(next), ['done:c', 'todo:ab'])
	})

	it('replaces an edited task in place or appends it to a new column', () => {
		const inPlace = applyTaskUpdate(board(), { _id: 'a', title: 'Edited' }, 'todo')
		assert.equal(inPlace[0].tasks[0].title, 'Edited')
		assert.deepEqual(ids(applyTaskUpdate(board(), { _id: 'a' }, 'done')), ['todo:b', 'done:ca'])
	})
})
