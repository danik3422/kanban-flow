import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { translate } from '../i18n/translate.js'
import { describeNotification } from './notificationText.js'

const inLanguage = (language) => (key, vars) => translate(language, key, vars)

describe('notification text', () => {
	it('keeps the server text for notifications saved before facts were stored', () => {
		const legacy = { type: 'task_assigned', title: 'You were assigned a task', message: 'You were assigned “Plan” in Launch.' }
		assert.deepEqual(describeNotification(inLanguage('ru'), legacy), { title: legacy.title, message: legacy.message, context: '', actor: '' })
	})

	it('builds every type in the interface language from the stored facts', () => {
		const data = { taskTitle: 'Plan', boardName: 'Launch', actorName: 'Olena', fromColumn: 'To do', toColumn: 'Done' }
		const ru = inLanguage('ru')
		assert.deepEqual(describeNotification(ru, { type: 'task_assigned', data }), { title: 'Вам назначена задача', message: '«Plan»', context: 'Launch', actor: 'Olena' })
		assert.equal(describeNotification(ru, { type: 'task_commented', data }).title, 'Новый комментарий')
		assert.equal(describeNotification(ru, { type: 'task_moved', data }).context, 'To do → Done')
		assert.equal(describeNotification(inLanguage('uk'), { type: 'task_updated', data }).title, 'Задачу оновлено')
	})

	it('works without an author or columns', () => {
		const moved = describeNotification(inLanguage('en'), { type: 'task_moved', data: { taskTitle: 'Plan', boardName: 'Launch' } })
		assert.deepEqual(moved, { title: 'Task moved', message: '«Plan»', context: 'Launch', actor: '' })
	})
})
