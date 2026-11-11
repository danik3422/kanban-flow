import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

// A small localStorage for node.
const store = new Map()
globalThis.localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) }
const { clearOutbox, enqueue, flushOutbox, isTempId, makeTempId, mustQueue, outboxVerdict, pendingCount, selectPending, setOutboxSender, setOutboxSessionCheck, syncOutboxOwner, useOutbox, withRealIds } = await import('./outbox.js')

const MINUTE = 60 * 1000
const failWith = (status) => async () => {
	throw Object.assign(new Error(`HTTP ${status}`), { response: { status } })
}

describe('outbox', () => {
	beforeEach(() => {
		store.clear()
		store.set('kanban-cache-owner', 'user-1')
		syncOutboxOwner()
		clearOutbox()
		setOutboxSessionCheck(null)
		mock.timers.enable({ apis: ['Date'], now: 1_000_000 })
	})
	afterEach(() => mock.timers.reset())

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

	it('keeps a change when the server is unreachable, busy or failing, and drops only refusals', async () => {
		enqueue({ method: 'patch', url: '/board/tasks/t1', data: { title: 'x' } })
		enqueue({ method: 'patch', url: '/board/tasks/t2', data: { title: 'y' } })
		for (const status of [429, 500, 503]) {
			setOutboxSender(failWith(status))
			await flushOutbox()
			assert.equal(pendingCount(), 2, `a ${status} keeps every change`)
			mock.timers.tick(10 * MINUTE)
		}
		const sent = []
		setOutboxSender(async (config) => {
			if (config.url.endsWith('t1')) throw Object.assign(new Error('gone'), { response: { status: 404 } })
			sent.push(config.url)
			return { data: {} }
		})
		await flushOutbox()
		assert.equal(pendingCount(), 0)
		assert.deepEqual(sent, ['/board/tasks/t2'], 'a refusal drops that change only; the next one goes out')
	})

	it('waits longer after each server error instead of trying on every other request', async () => {
		enqueue({ method: 'patch', url: '/board/tasks/t1', data: {} })
		let calls = 0
		setOutboxSender(async () => {
			calls++
			throw Object.assign(new Error('boom'), { response: { status: 500 } })
		})
		await flushOutbox()
		await flushOutbox()
		assert.equal(calls, 1, 'a second send right away waits for the pause')
		mock.timers.tick(15 * 1000)
		await flushOutbox()
		assert.equal(calls, 2)
		mock.timers.tick(15 * 1000)
		await flushOutbox()
		assert.equal(calls, 2, 'the second pause is longer')
	})

	it('stops retrying a change the server keeps failing on, so the queue moves on', async () => {
		enqueue({ method: 'patch', url: '/board/tasks/broken', data: {} })
		enqueue({ method: 'patch', url: '/board/tasks/fine', data: {} })
		const sent = []
		setOutboxSender(async (config) => {
			if (config.url.endsWith('broken')) throw Object.assign(new Error('boom'), { response: { status: 500 } })
			sent.push(config.url)
			return { data: {} }
		})
		for (let run = 0; run < 5; run++) {
			await flushOutbox()
			mock.timers.tick(10 * MINUTE)
		}
		assert.equal(pendingCount(), 0)
		assert.deepEqual(sent, ['/board/tasks/fine'])
	})

	it('on a 401 asks the auth store to check the session, and waits while signed out', async () => {
		enqueue({ method: 'patch', url: '/board/tasks/t1', data: { title: 'x' } })
		let checks = 0
		setOutboxSessionCheck(() => {
			checks++
			// The session really ended: the auth store forgets the account.
			store.set('kanban-cache-owner', '')
			syncOutboxOwner()
		})
		let calls = 0
		setOutboxSender(async () => {
			calls++
			throw Object.assign(new Error('expired'), { response: { status: 401 } })
		})
		await flushOutbox()
		assert.equal(checks, 1)
		mock.timers.tick(10 * MINUTE)
		await flushOutbox()
		assert.equal(calls, 1, 'nothing is sent without a session')
		assert.equal(selectPending(useOutbox.getState()), 0, 'signed out, nobody’s changes are counted')

		store.set('kanban-cache-owner', 'user-1')
		syncOutboxOwner()
		setOutboxSender(async () => ({ data: {} }))
		await flushOutbox()
		assert.equal(pendingCount(), 0, 'the change goes out once the same account is back')
	})

	it('drops what an earlier account left unsent when another one signs in on this device', () => {
		enqueue({ method: 'patch', url: '/board/tasks/t1', data: {} })
		store.set('kanban-cache-owner', '')
		syncOutboxOwner()
		assert.equal(useOutbox.getState().items.length, 1, 'kept while nobody is signed in')
		store.set('kanban-cache-owner', 'user-2')
		syncOutboxOwner()
		assert.equal(useOutbox.getState().items.length, 0)
	})

	it('decides what to do with each kind of failure', () => {
		assert.equal(outboxVerdict({ isOffline: true }), 'wait')
		assert.equal(outboxVerdict(new Error('no answer')), 'wait')
		assert.equal(outboxVerdict({ response: { status: 429 } }), 'wait')
		assert.equal(outboxVerdict({ response: { status: 401 } }), 'session')
		assert.equal(outboxVerdict({ response: { status: 500 } }, 0), 'retry')
		assert.equal(outboxVerdict({ response: { status: 500 } }, 4), 'drop')
		assert.equal(outboxVerdict({ response: { status: 401 } }, 4), 'drop')
		for (const status of [400, 403, 404, 409, 422]) assert.equal(outboxVerdict({ response: { status } }), 'drop')
	})

	it('belongs to the signed-in account', () => {
		enqueue({ method: 'patch', url: '/board/tasks/t1', data: {} })
		store.set('kanban-cache-owner', 'user-2')
		assert.equal(pendingCount(), 0)
	})
})
