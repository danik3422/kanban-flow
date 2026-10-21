import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addDays, monthGrid, monthTitle, weekdayNames } from './calendarDates.js'

describe('calendar grid', () => {
	it('starts weeks on Monday or Sunday and always shows six whole weeks', () => {
		const october = new Date(2026, 9, 1) // Thursday 1 October 2026
		const mondayFirst = monthGrid(october, 1)
		assert.equal(mondayFirst.length, 42)
		assert.equal(mondayFirst[0].key, '2026-09-28')
		assert.equal(mondayFirst[3].key, '2026-10-01')
		const sundayFirst = monthGrid(october, 7)
		assert.equal(sundayFirst[0].key, '2026-09-27')
		assert.equal(sundayFirst.filter((day) => day.inMonth).length, 31)
	})

	it('names weekdays and months in the interface language', () => {
		assert.equal(weekdayNames('ru', 1)[0].toLowerCase().startsWith('пн'), true)
		assert.equal(weekdayNames('en', 7)[0], 'Sun')
		assert.equal(monthTitle(new Date(2026, 9, 1), 'ru'), 'Октябрь 2026')
		assert.equal(monthTitle(new Date(2026, 9, 1), 'uk'), 'Жовтень 2026')
		assert.equal(monthTitle(new Date(2026, 9, 1), 'en'), 'October 2026')
	})

	it('steps across month ends', () => {
		assert.equal(addDays('2026-10-31', 1), '2026-11-01')
		assert.equal(addDays('2026-03-01', -1), '2026-02-28')
	})
})
