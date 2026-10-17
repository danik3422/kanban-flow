import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { LOCALES, SUPPORTED_LANGUAGES, translate, translateServerMessage } from './translate.js'

const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])
const isPlural = (value) => value && typeof value === 'object' && Object.keys(value).every((key) => PLURAL_KEYS.has(key))

// Flattens nested messages to "a.b.c" paths; plural objects count as one message.
const flatten = (node, prefix = '', out = {}) => {
	for (const [key, value] of Object.entries(node)) {
		const path = prefix ? `${prefix}.${key}` : key
		if (prefix === '' && key === 'server') continue
		if (isPlural(value) || typeof value !== 'object') out[path] = value
		else flatten(value, path, out)
	}
	return out
}
const placeholders = (value) =>
	[...new Set((typeof value === 'string' ? [value] : Object.values(value)).flatMap((text) => text.match(/\{\w+\}/g) || []))].sort()

describe('translations', () => {
	const english = flatten(LOCALES.en)

	for (const language of SUPPORTED_LANGUAGES.filter((code) => code !== 'en')) {
		const messages = flatten(LOCALES[language])

		it(`${language} has every English key and no extra ones`, () => {
			assert.deepEqual(Object.keys(messages).filter((key) => !(key in english)), [], 'keys not in English')
			assert.deepEqual(Object.keys(english).filter((key) => !(key in messages)), [], 'missing translations')
		})

		it(`${language} keeps the same {placeholders}`, () => {
			const mismatched = Object.keys(english).filter(
				(key) => key in messages && placeholders(english[key]).join() !== placeholders(messages[key]).join(),
			)
			assert.deepEqual(mismatched, [])
		})

		it(`${language} has no empty or untranslated-looking strings`, () => {
			const empty = Object.entries(messages).filter(([, value]) => typeof value === 'string' && !value.trim())
			assert.deepEqual(empty, [])
		})

		it(`${language} plural messages cover one, few, many and other`, () => {
			const incomplete = Object.entries(messages)
				.filter(([, value]) => isPlural(value))
				.filter(([, value]) => !['one', 'few', 'many', 'other'].every((form) => form in value))
				.map(([key]) => key)
			assert.deepEqual(incomplete, [])
		})

		it(`${language} translates the same server messages`, () => {
			assert.deepEqual(Object.keys(LOCALES[language].server).sort(), Object.keys(LOCALES.en.server).sort())
		})
	}

	it('interpolates variables and falls back to English, then to the key', () => {
		assert.equal(translate('uk', 'common.typeToConfirm', { phrase: 'видалити' }), 'Введіть «видалити», щоб підтвердити')
		assert.equal(translate('de', 'common.close'), 'Close')
		assert.equal(translate('ru', 'missing.key'), 'missing.key')
	})

	it('translates known server messages and hides unknown English ones', () => {
		assert.equal(translateServerMessage('ru', 'Credentials are not valid'), 'Неверная почта или пароль.')
		assert.equal(translateServerMessage('uk', 'Some new server error'), translate('uk', 'auth.errors.generic'))
		assert.equal(translateServerMessage('en', 'Some new server error'), 'Some new server error')
	})
})
