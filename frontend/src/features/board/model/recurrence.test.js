import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextOccurrence, upcomingDates } from './recurrence.js'

describe('recurrence (web app)', () => {
	it('matches the server rules', () => {
		assert.equal(nextOccurrence({ frequency: 'weekdays' }, '2026-10-23'), '2026-10-26')
		assert.equal(nextOccurrence({ frequency: 'weekly', interval: 2, days: [1, 5] }, '2026-10-23'), '2026-11-02')
		assert.equal(nextOccurrence({ frequency: 'monthly', interval: 1, dayOfMonth: 31 }, '2026-01-31'), '2026-02-28')
	})

	it('lists the dates to come in a range, up to the end date', () => {
		assert.deepEqual(upcomingDates({ frequency: 'daily', interval: 1 }, '2026-10-20', '2026-10-22', '2026-10-25'), ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
		assert.deepEqual(upcomingDates({ frequency: 'daily', interval: 1, until: '2026-10-23' }, '2026-10-20', '2026-10-19', '2026-10-25'), ['2026-10-21', '2026-10-22', '2026-10-23'])
		assert.deepEqual(upcomingDates({ frequency: 'weekly', interval: 1, days: [1] }, '2026-10-19', '2026-10-19', '2026-10-25'), [])
	})
})
