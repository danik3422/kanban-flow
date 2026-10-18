import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { allLabels, formatClock, formatDuration, labelColorKey, parseDuration } from './cardDisplay.js'

describe('card display', () => {
	it('reads the durations people type', () => {
		const cases = { '90': 90, '1:30': 90, '1.5h': 90, '1h 30m': 90, '1ч 30м': 90, '2 год': 120, '45 мин': 45, '1,5 ч': 90, '20 хв': 20, '2h': 120, '3 hours': 180 }
		for (const [input, minutes] of Object.entries(cases)) assert.equal(parseDuration(input), minutes, input)
		for (const input of ['', 'soon', '1h banana', 'h']) assert.equal(parseDuration(input), null, input)
	})

	it('formats durations and clocks', () => {
		assert.equal(formatDuration(5400), '1 h 30 m')
		assert.equal(formatDuration(3600, { h: 'ч', m: 'мин' }), '1 ч')
		assert.equal(formatDuration(59), '1 m')
		assert.equal(formatClock(3909), '1:05:09')
		assert.equal(formatClock(309), '05:09')
	})

	it('colours labels from the board, and steadily otherwise', () => {
		assert.equal(labelColorKey('Design', [{ name: 'design', color: 'purple' }]), 'purple')
		assert.equal(labelColorKey('Backend'), labelColorKey('backend'))
		const labels = allLabels([{ name: 'Design', color: 'purple' }], [{ tasks: [{ labels: ['Design', 'Legacy'] }] }])
		assert.deepEqual(labels.map((label) => [label.name, label.saved]), [['Design', true], ['Legacy', false]])
	})
})
