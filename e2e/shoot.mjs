// Quick screenshots of given routes: node e2e/shoot.mjs out-dir route[:theme] ...
import { APP, launch } from './lib.mjs'
const [out, ...routes] = process.argv.slice(2)
const browser = await launch()
for (const spec of routes) {
	const [route, theme = 'light', size = 'desktop'] = spec.split(':')
	const viewport = size === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: size === 'mobile' ? 2 : 1 })
	await ctx.addInitScript((t) => { localStorage.setItem('theme', t); localStorage.setItem('kanban-language', 'ru') }, theme)
	const page = await ctx.newPage()
	await page.goto(APP + route)
	await page.waitForTimeout(1200)
	const name = `${route.replace(/\W+/g, '_')}_${theme}_${size}.png`
	await page.screenshot({ path: `${out}/${name}`, fullPage: true })
	console.log(`${out}/${name}`)
	await ctx.close()
}
await browser.close()
