import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { markdownToHtml, parseBoardFile } from './parseBoardFile.js'

const trello = {
	name: 'Website',
	desc: 'Our site',
	labels: [{ id: 'l1', name: 'Bug', color: 'red_dark' }, { id: 'l2', name: '', color: 'green' }, { id: 'l3', name: 'Ink', color: 'black' }],
	lists: [{ id: 'b', name: 'Doing', pos: 2 }, { id: 'a', name: 'To do', pos: 1 }, { id: 'c', name: 'Old', pos: 3, closed: true }],
	cards: [
		{ id: 'c2', name: 'Second', idList: 'a', pos: 20, desc: '', idLabels: [] },
		{ id: 'c1', name: 'First', idList: 'a', pos: 10, desc: 'Hello **world**\n\n- one\n- two', due: '2026-03-04T15:00:00.000Z', dueComplete: true, idLabels: ['l1', 'l2'] },
		{ id: 'c3', name: 'Gone', idList: 'b', pos: 1, closed: true, idLabels: ['l3'] },
	],
	checklists: [{ id: 'k', idCard: 'c1', pos: 1, checkItems: [{ name: 'B', state: 'incomplete', pos: 2 }, { name: 'A', state: 'complete', pos: 1 }] }],
	actions: [
		{ type: 'commentCard', date: '2026-01-02T00:00:00.000Z', data: { text: 'Newer', card: { id: 'c1' } }, memberCreator: { fullName: 'Ann' } },
		{ type: 'commentCard', date: '2026-01-01T00:00:00.000Z', data: { text: 'Older', card: { id: 'c1' } }, memberCreator: { fullName: 'Bob' } },
		{ type: 'updateCard', data: { card: { id: 'c1' } } },
	],
}

describe('board files', () => {
	it('reads a Trello export: order, labels, checklists, comments and closed items', () => {
		const board = parseBoardFile(JSON.stringify(trello))
		assert.equal(board.source, 'trello')
		assert.deepEqual(board.columns.map((column) => [column.title, column.archived]), [['To do', false], ['Doing', false], ['Old', true]])
		assert.deepEqual(board.labels, [{ name: 'Bug', color: 'red' }, { name: 'Green', color: 'green' }, { name: 'Ink', color: 'gray' }])
		const first = board.columns[0].cards[0]
		assert.equal(first.title, 'First')
		assert.equal(first.dueDate, '2026-03-04')
		assert.equal(first.completed, true)
		assert.deepEqual(first.labels, ['Bug', 'Green'])
		assert.deepEqual(first.checklist, [{ text: 'A', completed: true }, { text: 'B', completed: false }])
		assert.deepEqual(first.comments.map((comment) => [comment.text, comment.author]), [['Older', 'Bob'], ['Newer', 'Ann']])
		assert.equal(first.description, '<p>Hello <strong>world</strong></p><ul><li>one</li><li>two</li></ul>')
		assert.equal(board.columns[1].cards[0].archived, true)
		assert.deepEqual(board.summary, { lists: 2, cards: 2, archived: 2, labels: 3, comments: 2 })
	})

	it('reads its own export back', () => {
		const file = { format: 'kanbanhub-board', name: 'Mine', labels: [{ name: 'Bug', color: 'red' }], columns: [{ title: 'To do', cards: [{ title: 'A', priority: 'high', members: ['x'], checklist: [{ text: 'x', completed: true }] }] }] }
		const board = parseBoardFile(JSON.stringify(file))
		assert.equal(board.source, 'kanbanhub')
		assert.equal(board.columns[0].cards[0].priority, 'high')
		assert.equal('members' in board.columns[0].cards[0], false)
	})

	it('explains files it cannot use', () => {
		assert.throws(() => parseBoardFile('{oops'), { code: 'json' })
		assert.throws(() => parseBoardFile('{"hello":1}'), { code: 'unknown' })
		assert.throws(() => parseBoardFile(JSON.stringify({ lists: [], cards: [] })), { code: 'empty' })
	})

	it('escapes HTML in Markdown', () => {
		assert.equal(markdownToHtml('<script>x</script>\nline two'), '<p>&lt;script&gt;x&lt;/script&gt;<br>line two</p>')
	})
})
