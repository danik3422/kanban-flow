import http from 'node:http'
import fs from 'node:fs'
const out = process.argv[2]
http.createServer((req, res) => {
	let body = ''
	req.on('data', (c) => (body += c))
	req.on('end', () => {
		try {
			const p = JSON.parse(body)
			fs.appendFileSync(out, JSON.stringify({ to: p.to?.[0]?.email, subject: p.subject, text: p.textContent }) + '\n')
		} catch {}
		res.writeHead(201, { 'content-type': 'application/json' })
		res.end('{"messageId":"mock"}')
	})
}).listen(5099)
