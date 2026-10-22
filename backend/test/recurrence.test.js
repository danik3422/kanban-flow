import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextDueKey, nextOccurrence, normalizeRepeat } from '../services/recurrence.service.js'

describe('recurrence', () => {
	it('steps by day, weekday, week, month and year', () => {
		assert.equal(nextOccurrence({ frequency: 'daily', interval: 1 }, '2026-10-22'), '2026-10-23')
		assert.equal(nextOccurrence({ frequency: 'daily', interval: 3 }, '2026-10-30'), '2026-11-02')
		assert.equal(nextOccurrence({ frequency: 'weekdays' }, '2026-10-23'), '2026-10-26') // Friday → Monday
		assert.equal(nextOccurrence({ frequency: 'weekly', interval: 1, days: [1] }, '2026-10-19'), '2026-10-26')
		assert.equal(nextOccurrence({ frequency: 'weekly', interval: 1, days: [1, 3, 5] }, '2026-10-19'), '2026-10-21')
		assert.equal(nextOccurrence({ frequency: 'weekly', interval: 2, days: [1, 5] }, '2026-10-23'), '2026-11-02') // skips a week
		assert.equal(nextOccurrence({ frequency: 'weekly', interval: 2, days: [1, 5] }, '2026-10-19'), '2026-10-23') // same week first
		assert.equal(nextOccurrence({ frequency: 'monthly', interval: 1, dayOfMonth: 31 }, '2026-01-31'), '2026-02-28')
		assert.equal(nextOccurrence({ frequency: 'monthly', interval: 1, dayOfMonth: 31 }, '2026-02-28'), '2026-03-31')
		assert.equal(nextOccurrence({ frequency: 'yearly', interval: 1, dayOfMonth: 29 }, '2028-02-29'), '2029-02-28')
	})

	it('never lands in the past and stops after the end date', () => {
		assert.equal(nextDueKey({ frequency: 'weekly', interval: 1, days: [1] }, '2026-10-05', '2026-10-22'), '2026-10-26')
		assert.equal(nextDueKey({ frequency: 'daily', interval: 1 }, null, '2026-10-22'), '2026-10-23')
		assert.equal(nextDueKey({ frequency: 'daily', interval: 1, until: '2026-10-22' }, '2026-10-22', '2026-10-22'), null)
	})

	it('fills in the rule from the due date', () => {
		assert.deepEqual(normalizeRepeat({ frequency: 'weekly' }, '2026-10-22', '2026-10-01'), { frequency: 'weekly', interval: 1, days: [4], until: null })
		assert.deepEqual(normalizeRepeat({ frequency: 'monthly', interval: 120 }, '2026-10-31', '2026-10-01'), { frequency: 'monthly', interval: 99, dayOfMonth: 31, until: null })
		assert.equal(normalizeRepeat({ frequency: 'hourly' }, '2026-10-22', '2026-10-22'), null)
	})
})
