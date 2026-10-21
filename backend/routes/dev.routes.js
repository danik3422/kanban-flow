import express from 'express'

import { runDueReminders, runEmailDigests } from '../emails/jobs.js'
import { PREVIEW_NAMES, renderPreview } from '../emails/preview.js'

// Development helpers: look at every email, and run the email jobs without waiting.
// app.js mounts these on local environments only, so a staging deploy never exposes them.
const router = express.Router()

router.get('/api/dev/emails', (req, res) => {
	res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Emails</title><body style="font-family:system-ui;padding:24px"><h1>Emails</h1>${['en', 'uk', 'ru'].map((lang) => `<h2>${lang}</h2><ul>${PREVIEW_NAMES.map((name) => `<li><a href="/api/dev/emails/${name}?lang=${lang}">${name}</a></li>`).join('')}</ul>`).join('')}</body>`)
})
router.get('/api/dev/emails/:name', (req, res) => {
	const email = renderPreview(req.params.name, ['en', 'uk', 'ru'].includes(req.query.lang) ? req.query.lang : 'en')
	if (!email) return res.status(404).send('Unknown email')
	return req.query.format === 'text' ? res.type('text').send(`${email.subject}\n\n${email.text}`) : res.type('html').send(email.html)
})
router.post('/api/dev/run-email-jobs', async (req, res) => {
	const reminded = await runDueReminders()
	const digests = await runEmailDigests({ force: true })
	res.json({ reminded, digests })
})

export default router
