import { APP, check, done, launch, watch, ALICE_STATE } from '../lib.mjs'
const browser = await launch()
const ctx = await browser.newContext({ storageState: ALICE_STATE })
const page = await ctx.newPage(); watch(page, 'alice')
for (const target of ['/\\evil.example/x', '//evil.example/x', 'https://evil.example/x']) {
	await page.goto(`${APP}/login?redirect=${encodeURIComponent(target)}`); await page.waitForTimeout(1200)
	check(`redirect ${JSON.stringify(target)} stays on the app`, new URL(page.url()).origin === APP, page.url())
}
await page.goto(`${APP}/login?redirect=${encodeURIComponent('/my-tasks')}`); await page.waitForTimeout(1200)
check('a same-origin redirect still works', page.url() === `${APP}/my-tasks`, page.url())
await browser.close(); done()
