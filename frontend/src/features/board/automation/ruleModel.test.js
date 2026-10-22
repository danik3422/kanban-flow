import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { translate } from '../../../i18n/translate.js'
import { blankRule, describeRule, describeRun, draftOf, freshIdeas, ideasFor, problemsOf, toPayload } from './ruleModel.js'

const ru = (key, vars) => translate('ru', key, vars)
const en = (key, vars) => translate('en', key, vars)
const columns = [{ _id: 'c1', title: 'К выполнению' }, { _id: 'c2', title: 'В работе' }, { _id: 'c3', title: 'Готово' }]
const members = [{ _id: 'u1', name: 'Олена' }]
const weekdays = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

describe('automation rules in words', () => {
	it('says a card rule in one sentence', () => {
		const rule = { trigger: { type: 'card_added', column: 'c3' }, actions: [{ type: 'complete' }, { type: 'set_due', days: 3 }, { type: 'add_label', label: 'Готово' }, { type: 'assign', users: ['u1', 'gone'] }, { type: 'move', column: 'c1', position: 'top' }] }
		const { when, then } = describeRule(ru, rule, { columns, members })
		assert.equal(when, 'Когда карточку добавляют в «Готово»')
		assert.deepEqual(then, ['отметить выполненной', 'поставить срок через 3 дня', 'добавить метку «Готово»', 'назначить: Олена, бывший участник', 'переместить в начало «К выполнению»'])
		assert.equal(describeRule(ru, { trigger: { type: 'card_completed', column: null }, actions: [{ type: 'set_due', days: 0 }] }, { columns }).when, 'Когда карточку отмечают выполненной')
		assert.deepEqual(describeRule(en, { trigger: { type: 'card_moved', column: 'zz' }, actions: [{ type: 'set_due', days: 1 }, { type: 'set_priority', priority: 'urgent' }] }, { columns }), { when: 'When a card is moved to a deleted list', then: ['make it due in 1 day', 'set priority “Urgent”'] })
	})

	it('says a schedule with its days and time', () => {
		const weekly = { trigger: { type: 'schedule', schedule: { frequency: 'weekly', days: [3, 1], time: '09:00' } }, actions: [{ type: 'archive_list', column: 'c3', onlyDone: true }, { type: 'create_card', column: 'c1', title: 'Планёрка {date}' }, { type: 'move_list', from: 'c2', column: 'c1' }] }
		const { when, then } = describeRule(ru, weekly, { columns, weekdays })
		assert.equal(when, 'Каждую неделю — пн, ср, в 09:00')
		assert.deepEqual(then, ['убрать в архив выполненные карточки «Готово»', 'создать карточку «Планёрка {date}» в «К выполнению»', 'перенести все карточки из «В работе» в «К выполнению»'])
		assert.equal(describeRule(ru, { trigger: { type: 'schedule', schedule: { frequency: 'monthly', dayOfMonth: 31, time: '18:00' } }, actions: [] }, {}).when, 'Каждый месяц, 31 числа, в 18:00')
	})

	it('says what a rule did in a card’s history', () => {
		assert.equal(describeRun(ru, { message: 'Готово', fields: ['move', 'complete'], toColumn: 'Готово' }), 'автоматизация «Готово»: перемещение в «Готово», отметка «выполнено»')
		assert.equal(describeRun(en, { message: '', fields: ['assign_actor', 'set_due'] }), 'automation: members, due date')
		assert.equal(describeRun(en, { message: 'Ship', fields: ['move'], toColumn: 'Done' }), 'automation “Ship”: moved to “Done”')
		assert.equal(describeRule(en, { trigger: { type: 'card_added', column: 'c3' }, actions: [{ type: 'add_label', label: 'Bug' }] }, { columns }).then[0], 'add the label “Bug”')
	})
})

describe('automation rule editing', () => {
	it('sends only what each part needs', () => {
		const draft = blankRule('schedule', { columns })
		draft.trigger.schedule = { frequency: 'weekly', days: [5, 1], dayOfMonth: 1, time: '08:15' }
		draft.actions[0] = { ...draft.actions[0], title: '  Отчёт  ', days: '2' }
		assert.deepEqual(toPayload(draft), {
			name: '',
			enabled: true,
			trigger: { type: 'schedule', schedule: { frequency: 'weekly', time: '08:15', days: [1, 5] } },
			actions: [{ type: 'create_card', column: 'c1', position: 'bottom', title: 'Отчёт', labels: [], users: [], days: 2 }],
		})
		const card = blankRule('card', { columns })
		assert.deepEqual(toPayload(card).trigger, { type: 'card_added', column: 'c3' })
	})

	it('keeps a schedule in every draft, so a card rule can switch to one', () => {
		assert.equal(blankRule('card', { columns }).trigger.schedule.frequency, 'weekdays')
		assert.equal(draftOf({ trigger: { type: 'card_added', column: 'c1' }, actions: [] }).trigger.schedule.time, '09:00')
		const switched = blankRule('card', { columns })
		switched.trigger.type = 'schedule'
		assert.deepEqual(toPayload(switched).trigger, { type: 'schedule', schedule: { frequency: 'weekdays', time: '09:00' } })
	})

	it('reads a saved rule back into the editor', () => {
		const saved = { name: 'X', enabled: false, trigger: { type: 'card_moved', column: 'c2' }, actions: [{ type: 'assign', users: [{ _id: 'u1' }] }, { type: 'move', column: 'c3', position: 'top' }] }
		const draft = draftOf(saved)
		assert.equal(draft.enabled, false)
		assert.deepEqual(draft.actions[0].users, ['u1'])
		assert.deepEqual(toPayload(draft), { name: 'X', enabled: false, trigger: { type: 'card_moved', column: 'c2' }, actions: [{ type: 'assign', users: ['u1'] }, { type: 'move', column: 'c3', position: 'top' }] })
	})

	it('points at what is missing', () => {
		const draft = { name: '', enabled: true, trigger: { type: 'card_added', column: null }, actions: [{ type: 'comment', text: ' ' }, { type: 'assign', users: [] }, { type: 'complete' }] }
		assert.deepEqual(problemsOf(draft), { trigger: 'automation.needList', 0: 'automation.needText', 1: 'automation.pickPeople' })
		assert.deepEqual(problemsOf(blankRule('card', { columns })), {})
		const weekly = blankRule('schedule', { columns })
		weekly.trigger.schedule.frequency = 'weekly'
		weekly.trigger.schedule.days = []
		assert.equal(problemsOf(weekly).trigger, 'automation.needDays')
	})

	it('offers ideas that fit the board, minus the ones it already has', () => {
		const ideas = ideasFor(ru, columns)
		assert.deepEqual(ideas.map((idea) => idea.key), ['finish', 'file', 'claim', 'checklist', 'cleanup', 'standup'])
		assert.equal(ideas[0].title, 'В «Готово» — значит выполнено')
		const saved = [{ ...ideas[0].rule, name: 'Something else', _id: 'r1', actions: [...ideas[0].rule.actions, { type: 'add_label', label: 'Готово' }] }]
		assert.deepEqual(freshIdeas(ideas, saved).map((idea) => idea.key), ['file', 'claim', 'checklist', 'cleanup', 'standup'])
		assert.deepEqual(ideasFor(ru, [columns[0]]).map((idea) => idea.key), ['claim', 'checklist', 'standup'])
		assert.deepEqual(ideasFor(ru, []), [])
	})
})
