// Local stack for browser checks: in-memory MongoDB backend, a mail mock that
// writes outgoing email to e2e/.tmp/mail.log, and the frontend.
//   node e2e/stack.mjs start [--prod]   dev server, or a production build with --prod
//   node e2e/stack.mjs stop
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const tmp = path.join(root, 'e2e/.tmp')
const pidFile = path.join(tmp, 'pids.json')
fs.mkdirSync(tmp, { recursive: true })

const PORTS = { api: 5001, app: 5199, mail: 5099 }
const backendEnv = {
	PORT: String(PORTS.api),
	NODE_ENV: 'development',
	ALLOW_MEMORY_DB: 'true',
	JWT_SECRET: 'local-e2e-secret-local-e2e-secret-123',
	CORS_ORIGIN: `http://localhost:${PORTS.app}`,
	FRONTEND_URL: `http://localhost:${PORTS.app}`,
	BREVO_API_KEY: 'mock',
	MAIL_FROM: 'KanbanHub <noreply@example.com>',
	BREVO_API_URL: `http://localhost:${PORTS.mail}/send`,
}
const frontendEnv = {
	VITE_API_URL: `http://localhost:${PORTS.api}/api`,
	VITE_SOCKET_URL: `http://localhost:${PORTS.api}`,
}

const launch = (name, command, args, options) => {
	const log = fs.openSync(path.join(tmp, `${name}.log`), 'w')
	const child = spawn(command, args, {
		...options,
		env: { ...process.env, ...options.env },
		stdio: ['ignore', log, log],
		detached: true,
	})
	child.unref()
	return child.pid
}

const waitFor = async (url, label) => {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(url)
			if (response.ok) return
		} catch {
			// not up yet
		}
		await new Promise((resolve) => setTimeout(resolve, 500))
	}
	throw new Error(`${label} did not start; see e2e/.tmp/${label}.log`)
}

const stop = () => {
	if (!fs.existsSync(pidFile)) return
	for (const pid of Object.values(JSON.parse(fs.readFileSync(pidFile, 'utf8')))) {
		try {
			process.kill(-pid)
		} catch {
			// already stopped
		}
	}
	fs.rmSync(pidFile)
}

const start = async (production) => {
	stop()
	fs.writeFileSync(path.join(tmp, 'mail.log'), '')
	const pids = {}
	pids.mail = launch('mail', process.execPath, [path.join(root, 'e2e/mail-mock.mjs'), path.join(tmp, 'mail.log')], { cwd: root, env: {} })
	pids.backend = launch('backend', process.execPath, ['index.js'], { cwd: path.join(root, 'backend'), env: backendEnv })
	const frontend = path.join(root, 'frontend')
	if (production) {
		const outDir = path.join(tmp, 'dist')
		const build = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
			cwd: frontend,
			env: { ...process.env, ...frontendEnv },
			encoding: 'utf8',
		})
		if (build.status !== 0) throw new Error(`Frontend build failed:\n${build.stderr}`)
		pids.frontend = launch('frontend', 'npx', ['vite', 'preview', '--outDir', outDir, '--port', String(PORTS.app), '--strictPort'], { cwd: frontend, env: frontendEnv })
	} else {
		pids.frontend = launch('frontend', 'npx', ['vite', '--port', String(PORTS.app), '--strictPort'], { cwd: frontend, env: frontendEnv })
	}
	fs.writeFileSync(pidFile, JSON.stringify(pids))
	await waitFor(`http://localhost:${PORTS.api}/health`, 'backend')
	await waitFor(`http://localhost:${PORTS.app}/`, 'frontend')
	console.log(`Stack ready (${production ? 'production build' : 'dev server'}): app http://localhost:${PORTS.app}, api http://localhost:${PORTS.api}`)
}

const [command = 'start'] = process.argv.slice(2)
if (command === 'stop') {
	stop()
	console.log('Stack stopped')
} else if (command === 'start') {
	await start(process.argv.includes('--prod'))
} else {
	console.error('Usage: node e2e/stack.mjs start [--prod] | stop')
	process.exitCode = 1
}
