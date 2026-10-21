import os from 'node:os'
import path from 'node:path'
import Test from 'supertest/lib/test.js'

// Uploaded pictures go to a throwaway folder, never into the project.
process.env.UPLOADS_DIR ||= path.join(os.tmpdir(), `kanban-test-uploads-${process.pid}`)
const { recordPendingSession } = await import('./helpers.js')

// Requests in tests stand in for our web client, which always sends this header
// (frontend/src/lib/axios.js). A test can opt out with .set('X-Requested-With', '').
// Cookies from sessionCookie() get their session recorded before they are first sent.
const end = Test.prototype.end
Test.prototype.end = function (callback) {
	if (this.get('X-Requested-With') === undefined) this.set('X-Requested-With', 'XMLHttpRequest')
	recordPendingSession(this.get('Cookie')).then(
		() => end.call(this, callback),
		(error) => callback(error),
	)
	return this
}
