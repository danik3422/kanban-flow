import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sortTasks } from './taskSorting.js'

const tasks = [
	{ _id: 'a', title: 'Zebra', createdAt: '2026-01-02T00:00:00.000Z', position: 0 },
	{ _id: 'b', title: 'Alpha', createdAt: '2026-01-03T00:00:00.000Z', position: 2 },
	{ _id: 'c', title: 'Middle', createdAt: '2026-01-01T00:00:00.000Z', position: 1 },
]

describe('sortTasks', () => {
	it('sorts by name without mutating the source list', () => {
		const original = [...tasks]
		assert.deepEqual(sortTasks(tasks, 'name-alpha').map((task) => task._id), ['b', 'c', 'a'])
		assert.deepEqual(tasks, original)
	})

	it('sorts newest and oldest by creation date', () => {
		assert.deepEqual(sortTasks(tasks, 'date-newest').map((task) => task._id), ['b', 'a', 'c'])
		assert.deepEqual(sortTasks(tasks, 'date-oldest').map((task) => task._id), ['c', 'a', 'b'])
	})

	it('uses position for custom and unknown modes', () => {
		assert.deepEqual(sortTasks(tasks, 'custom').map((task) => task._id), ['a', 'c', 'b'])
		assert.deepEqual(sortTasks(tasks, undefined).map((task) => task._id), ['a', 'c', 'b'])
	})

	it('keeps local sorting when a remote task receives a new position', () => {
		const updatedTasks = tasks.map((task) =>
			task._id === 'a' ? { ...task, position: 2 } : task,
		)
		assert.deepEqual(
			sortTasks(updatedTasks, 'name-alpha').map((task) => task._id),
			['b', 'c', 'a'],
		)
	})
})

it('sorts by due date with undated cards last, and by priority', () => {
	const tasks = [
		{ _id: 'a', title: 'A', position: 0, dueDate: null, priority: 'low' },
		{ _id: 'b', title: 'B', position: 1, dueDate: '2026-10-20T00:00:00.000Z', priority: 'urgent' },
		{ _id: 'c', title: 'C', position: 2, dueDate: '2026-10-18T00:00:00.000Z' },
	]
	assert.deepEqual(sortTasks(tasks, 'due-date').map((task) => task._id), ['c', 'b', 'a'])
	assert.deepEqual(sortTasks(tasks, 'priority').map((task) => task._id), ['b', 'a', 'c'])
})
