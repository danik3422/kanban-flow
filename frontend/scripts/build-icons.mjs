// Renders public/kanban-mark.svg into the raster icons browsers and phones ask for:
// favicon.ico (16, 32, 48), apple-touch-icon.png (180) and icon-512.png.
//   node frontend/scripts/build-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const publicDir = path.resolve(new URL('../public', import.meta.url).pathname)
const svg = fs.readFileSync(path.join(publicDir, 'kanban-mark.svg'), 'utf8')
const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage()
// Raster icons always use the light colors; fullBleed squares the corners for
// home-screen icons, which the phone rounds itself.
const render = async (size, { fullBleed = false } = {}) => {
	// Headless Chrome has a minimum window size, so shoot the element, not the viewport.
	await page.setViewportSize({ width: Math.max(size, 600), height: Math.max(size, 600) })
	// Drop the <style> block (it holds the dark variant) and inline the light colors.
	let markup = svg
		.replace(/<style>[\s\S]*?<\/style>/, '')
		.replace(/class="t"/, 'fill="#0f766e"')
		.replaceAll('class="g"', 'fill="#ffffff"')
		.replace('class="m"', 'fill="#99f6e4"')
		.replace('<svg ', `<svg width="${size}" height="${size}" `)
	if (fullBleed) markup = markup.replace('rx="8"/>', 'rx="0"/>')
	await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`)
	return page.locator('svg').screenshot({ omitBackground: true })
}

const icoSizes = [16, 32, 48]
const images = []
for (const size of icoSizes) images.push(await render(size))
// ICO container holding PNG images: 6-byte header, 16-byte entry per image, then the data.
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(images.length, 4)
let offset = 6 + 16 * images.length
const entries = images.map((png, index) => {
	const entry = Buffer.alloc(16)
	const size = icoSizes[index]
	entry.writeUInt8(size === 256 ? 0 : size, 0)
	entry.writeUInt8(size === 256 ? 0 : size, 1)
	entry.writeUInt16LE(1, 4)
	entry.writeUInt16LE(32, 6)
	entry.writeUInt32LE(png.length, 8)
	entry.writeUInt32LE(offset, 12)
	offset += png.length
	return entry
})
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...entries, ...images]))
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), await render(180, { fullBleed: true }))
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), await render(512, { fullBleed: true }))
await browser.close()
console.log('Icons written to', publicDir)
