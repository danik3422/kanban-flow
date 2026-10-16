import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	addDaysToKey,
	formatDueDate,
	getDueDateKey,
	getDueDateState,
	getLocalDateKey,
} from './dueDate.js'

describe('due dates', () => {
	it('keeps the stored calendar day regardless of the time of day', () => {
		assert.equal(getDueDateKey('2026-10-16T00:00:00.000Z'), '2026-10-16')
		assert.equal(getDueDateKey(null), '')
		assert.equal(getDueDateKey('not a date'), '')
	})

	it('compares the due day with the local calendar day', () => {
		const lateEvening = new Date(2026, 9, 16, 23, 30)
		const earlyMorning = new Date(2026, 9, 16, 0, 30)
		for (const now of [lateEvening, earlyMorning]) {
			assert.equal(getLocalDateKey(now), '2026-10-16')
			assert.equal(getDueDateState('2026-10-16T00:00:00.000Z', now), 'today')
			assert.equal(getDueDateState('2026-10-15T00:00:00.000Z', now), 'overdue')
			assert.equal(getDueDateState('2026-10-17T00:00:00.000Z', now), 'upcoming')
		}
		assert.equal(getDueDateState(''), null)
	})

	it('adds days across month boundaries', () => {
		assert.equal(addDaysToKey('2026-10-29', 7), '2026-11-05')
	})

	it('formats the stored day without shifting it', () => {
		const label = formatDueDate('2026-10-16T00:00:00.000Z', { day: 'numeric' })
		assert.equal(label, '16')
	})
})
