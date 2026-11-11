import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import en from './content/en.js'
import ru from './content/ru.js'
import uk from './content/uk.js'
import { GUIDE_ICONS } from './guideIcons.js'
import { parseRich, PLAY_CARDS, playRules, runPlayRules, searchSections } from './guideModel.js'

// Everything but the words: section ids, icons, demos, links and list lengths. Plural
// texts (search results, the repeat demo's units) may be one word or plural forms.
const pluralForms = (units) => Object.fromEntries(Object.keys(units).map((key) => [key, 'plural']))
const shape = (value) => {
	if (Array.isArray(value)) return value.map(shape)
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'results' ? 'plural' : key === 'units' ? pluralForms(item) : ['id', 'icon', 'demo', 'to'].includes(key) || (key === 'minutes' && typeof item === 'number') || (key === 'keys' && Array.isArray(item)) || key === 'state' ? item : shape(item)]))
	return typeof value
}
const placeholders = (text) => (String(text).match(/\{\w+\}|\[\[[^\]]+\]\]|`[^`]+`/g) || []).sort()
const strings = (value, path = '') => {
	if (typeof value === 'string') return [[path, value]]
	if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => strings(item, `${path}.${key}`))
	return []
}

describe('guide content', () => {
	for (const [name, content] of Object.entries({ uk, ru })) {
		it(`${name} has the same sections, demos and lists as English`, () => {
			assert.deepEqual(shape(content), shape(en))
		})
		it(`${name} keeps the same keys, code and placeholders`, () => {
			const english = new Map(strings(en))
			for (const [path, text] of strings(content)) {
				assert.ok(text.trim(), `${path} is empty`)
				if (english.has(path) && !path.startsWith('.ui.results')) assert.deepEqual(placeholders(text), placeholders(english.get(path)), path)
			}
		})
	}

	it('has unique section ids and only known demos', () => {
		const ids = en.sections.map((section) => section.id)
		assert.equal(new Set(ids).size, ids.length)
		const icons = JSON.stringify(en).match(/"icon":"\w+"/g).map((item) => item.slice(8, -1))
		for (const icon of icons) assert.ok(GUIDE_ICONS[icon], `icon ${icon} is not in guideIcons.js`)
		for (const section of en.sections) if (section.demo) assert.ok(['board', 'views', 'repeat', 'rules', 'calendarApps', 'keys'].includes(section.demo), section.demo)
	})
})

describe('guide text markup', () => {
	it('picks out code, keys and bold', () => {
		assert.deepEqual(parseRich('Press [[N]] or type `{date}` in **bold** now'), [
			{ type: 'text', value: 'Press ' },
			{ type: 'key', value: 'N' },
			{ type: 'text', value: ' or type ' },
			{ type: 'code', value: '{date}' },
			{ type: 'text', value: ' in ' },
			{ type: 'bold', value: 'bold' },
			{ type: 'text', value: ' now' },
		])
		assert.deepEqual(parseRich('plain'), [{ type: 'text', value: 'plain' }])
	})
})

describe('guide search', () => {
	it('finds sections by every word, in any case, ё or е', () => {
		assert.deepEqual(searchSections(ru.sections, ''), ru.sections.map((section) => section.id))
		assert.ok(searchSections(ru.sections, 'повтор').includes('repeat'))
		assert.ok(searchSections(ru.sections, 'ЖЁЛТЫЙ ЖИРАФ').length === 0)
		assert.ok(searchSections(en.sections, 'trello import').includes('start'))
		assert.ok(searchSections(ru.sections, 'запустить сейчас').includes('automation'))
		assert.ok(searchSections(uk.sections, 'outlook').includes('calendarSync'))
	})
})

describe('automation playground', () => {
	const rules = playRules('Done')
	const on = (...ids) => rules.filter((rule) => ids.includes(rule.id))
	const moved = (cards, id, column) => runPlayRules(cards.map((card) => (card.id === id ? { ...card, column } : card)), on('finish', 'file', 'start', 'back'), id, { type: 'moved', column })

	it('completes and labels a card dropped in Done', () => {
		const { cards, fired } = moved(PLAY_CARDS, 'a', 'done')
		assert.deepEqual(fired, ['finish'])
		assert.deepEqual(cards.find((card) => card.id === 'a'), { id: 'a', column: 'done', completed: true, labels: ['Done'], assigned: false, due: false })
	})

	it('files a completed card into Done, and the Done rule finishes the job once', () => {
		const completed = PLAY_CARDS.map((card) => (card.id === 'b' ? { ...card, completed: true } : card))
		const { cards, fired } = runPlayRules(completed, on('finish', 'file'), 'b', { type: 'completed', column: 'todo' })
		assert.deepEqual(fired, ['file', 'finish'])
		assert.equal(cards.find((card) => card.id === 'b').column, 'done')
		assert.deepEqual(cards.find((card) => card.id === 'b').labels, ['Done'])
	})

	it('assigns and dates a card started, and resets one sent back to To do', () => {
		const started = moved(PLAY_CARDS, 'a', 'doing')
		assert.deepEqual(started.fired, ['start'])
		const back = moved(started.cards.map((card) => (card.id === 'a' ? { ...card, completed: true } : card)), 'a', 'todo')
		assert.deepEqual(back.fired, ['back'])
		assert.deepEqual(back.cards.find((card) => card.id === 'a'), { id: 'a', column: 'todo', completed: false, labels: [], assigned: true, due: false })
	})

	it('does nothing when no rule is on', () => {
		assert.deepEqual(runPlayRules(PLAY_CARDS, [], 'a', { type: 'moved', column: 'done' }).fired, [])
	})
})
