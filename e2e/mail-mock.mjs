import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const out = process.argv[2]
http.createServer((req, res) => {
	let body = ''
	req.on('data', (c) => (body += c))
	req.on('end', () => {
		try {
			const p = JSON.parse(body)
			// The HTML goes next to the log, one file per email, for looking at real emails.
			const dir = path.join(path.dirname(out), 'mail-html')
			fs.mkdirSync(dir, { recursive: true })
			const html = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.html`)
			if (p.htmlContent) fs.writeFileSync(html, p.htmlContent)
			fs.appendFileSync(out, JSON.stringify({ to: p.to?.[0]?.email, subject: p.subject, text: p.textContent, html }) + '\n')
		} catch {}
		res.writeHead(201, { 'content-type': 'application/json' })
		res.end('{"messageId":"mock"}')
	})
}).listen(5099)
