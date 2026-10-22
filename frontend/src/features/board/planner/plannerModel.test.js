import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { plannerGroups, weekOf } from './plannerModel.js'

describe('planner', () => {
	it('builds the week around a day for Monday and Sunday starts', () => {
		assert.deepEqual(weekOf('2026-10-22', 1), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
		assert.equal(weekOf('2026-10-22', 7)[0], '2026-10-18')
		assert.equal(weekOf('2026-10-19', 1)[0], '2026-10-19')
		assert.equal(weekOf('2026-10-25', 1)[0], '2026-10-19')
	})

	it('places cards on their days, keeps overdue and undated apart and hides done ones', () => {
		const columns = [
			{ _id: 'a', title: 'To do', tasks: [
				{ _id: '1', title: 'Due today', dueDate: '2026-10-22T00:00:00.000Z', priority: 'low' },
				{ _id: '2', title: 'Urgent today', dueDate: '2026-10-22T00:00:00.000Z', priority: 'urgent' },
				{ _id: '3', title: 'Late', dueDate: '2026-10-01T00:00:00.000Z' },
				{ _id: '4', title: 'Someday' },
				{ _id: '5', title: 'Done today', dueDate: '2026-10-22T00:00:00.000Z', completed: true },
				{ _id: '6', title: 'Late but done', dueDate: '2026-10-02T00:00:00.000Z', completed: true },
				{ _id: '7', title: 'Next month', dueDate: '2026-11-20T00:00:00.000Z' },
			] },
		]
		const days = weekOf('2026-10-22', 1)
		const groups = plannerGroups(columns, days, '2026-10-22')
		assert.deepEqual(groups.days['2026-10-22'].map((item) => item.task._id), ['2', '1'])
		assert.deepEqual(groups.overdue.map((item) => item.task._id), ['3'])
		assert.deepEqual(groups.undated.map((item) => [item.task._id, item.columnTitle]), [['4', 'To do']])
		assert.deepEqual(plannerGroups(columns, days, '2026-10-22', { showDone: true }).days['2026-10-22'].map((item) => item.task._id), ['2', '1', '5'])
	})
})
