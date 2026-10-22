import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

// A small localStorage for node.
const store = new Map()
globalThis.localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) }
const { clearOutbox, enqueue, flushOutbox, isTempId, makeTempId, mustQueue, pendingCount, setOutboxSender, withRealIds } = await import('./outbox.js')

describe('outbox', () => {
	beforeEach(() => {
		store.clear()
		store.set('kanban-cache-owner', 'user-1')
		clearOutbox()
	})

	it('keeps changes in order and sends them, rewriting temporary ids', async () => {
		const temp = makeTempId()
		assert.ok(isTempId(temp))
		enqueue({ method: 'post', url: '/board/columns/c1/task', data: { title: 'A', clientId: temp }, offline: { tempId: temp } })
		enqueue({ method: 'patch', url: `/board/tasks/${temp}`, data: { completed: true } })
		enqueue({ method: 'patch', url: '/board/boards/b1/tasks/reorder', data: { columns: [{ columnId: 'c1', taskIds: [temp, 't2'] }] } })
		assert.equal(pendingCount(), 3)
		assert.equal(mustQueue({ url: '/board/tasks/t9', data: {} }), true) // waits behind the others

		const sent = []
		setOutboxSender(async (config) => {
			sent.push([config.method, config.url, JSON.stringify(config.data)])
			return { data: config.url.endsWith('/task') ? { _id: 'real-1' } : {} }
		})
		await flushOutbox()
		assert.equal(pendingCount(), 0)
		assert.deepEqual(sent.map((item) => item[1]), ['/board/columns/c1/task', '/board/tasks/real-1', '/board/boards/b1/tasks/reorder'])
		assert.ok(sent[2][2].includes('real-1') && !sent[2][2].includes(temp))
		assert.equal(withRealIds(`/x/${temp}`), '/x/real-1')
	})

	it('stops when the network fails and drops what the server refuses', async () => {
		enqueue({ method: 'patch', url: '/board/tasks/t1', data: { title: 'x' } })
		enqueue({ method: 'patch', url: '/board/tasks/t2', data: { title: 'y' } })
		setOutboxSender(async () => {
			throw Object.assign(new Error('offline'), { isOffline: true })
		})
		await flushOutbox()
		assert.equal(pendingCount(), 2)

		let calls = 0
		setOutboxSender(async () => {
			calls++
			if (calls === 1) throw Object.assign(new Error('gone'), { response: { status: 404 } })
			return { data: {} }
		})
		await flushOutbox()
		assert.equal(pendingCount(), 0)
		assert.equal(calls, 2)
	})

	it('belongs to the signed-in account', () => {
		enqueue({ method: 'patch', url: '/board/tasks/t1', data: {} })
		store.set('kanban-cache-owner', 'user-2')
		assert.equal(pendingCount(), 0)
	})
})
