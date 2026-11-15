// Starts the KanbanHub server inside the container. Fills in what a self-hosted
// install should not have to think about, then hands over to backend/index.js.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = process.env.DATA_DIR || '/data'
fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true })

// Sessions are signed with JWT_SECRET. Without one, a random secret is made once and
// kept in the data volume, so people stay signed in across restarts and updates.
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
	console.warn('JWT_SECRET in .env is shorter than 32 characters, so it is ignored and the generated key in the data volume is used. Remove it or set a longer one.')
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
	const file = path.join(dataDir, 'jwt-secret')
	if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('base64url'), { mode: 0o600 })
	process.env.JWT_SECRET = fs.readFileSync(file, 'utf8').trim()
}

// The address people open; email links point here. Same address for the API.
const publicUrl = (process.env.PUBLIC_URL || `http://localhost:${process.env.HOST_PORT || 8080}`).replace(/\/+$/, '')
process.env.FRONTEND_URL ||= publicUrl
process.env.CORS_ORIGIN ||= publicUrl
// Plain http (a home or office network) can't carry Secure cookies; https can.
process.env.COOKIE_SECURE ||= publicUrl.startsWith('https://') ? 'true' : 'false'
// Directly exposed by default; set TRUST_PROXY=1 behind a reverse proxy (nginx, Caddy, Traefik).
process.env.TRUST_PROXY ||= '0'
// https almost always means a reverse proxy in front; without TRUST_PROXY every visitor
// looks like the proxy, so one person can use up the sign-in limits for everyone.
if (publicUrl.startsWith('https://') && process.env.TRUST_PROXY === '0') {
	console.warn('PUBLIC_URL is https:// but TRUST_PROXY is 0. Behind a reverse proxy (nginx, Caddy, Traefik) set TRUST_PROXY=1 in .env.')
}

await import('/app/backend/index.js')
