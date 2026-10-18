// Search (⌘K) reaches Profile, Settings and each settings section; Profile and
// Settings share the page width.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `search-${stamp}@example.com`, password: 'Password123!', name: 'Sam Search' }
const me = await createVerifiedUser(ME, 'PM')
await me.call('PATCH', '/auth/settings', { language: 'en' })

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/); await page.waitForSelector('.app-sidebar')

const search = async (text) => {
	await page.keyboard.press('Control+k')
	await page.waitForSelector('.quick-switcher')
	await page.keyboard.type(text)
	return page.locator('.quick-switcher__option').allInnerTexts()
}

await page.keyboard.press('Control+k')
await page.waitForSelector('.quick-switcher')
const pages = await page.locator('.quick-switcher__option').allInnerTexts()
check('search lists Profile and Settings', pages.includes('Profile') && pages.includes('Settings'), pages.join('|'))
await page.keyboard.press('Escape')

let found = await search('prof')
check('typing finds Profile', found.includes('Profile'), found.join('|'))
await page.keyboard.press('Enter')
await page.waitForURL(/\/profile$/)
check('Enter opens Profile', page.url().endsWith('/profile'))
await page.waitForSelector('.pf-layout')
const profileWidth = (await page.locator('.app-page').boundingBox()).width
const profileContent = (await page.locator('.pf-layout').boundingBox()).width

found = await search('password')
check('a related word finds the settings section', found.includes('Sign-in & security'), found.join('|'))
await page.keyboard.press('Enter')
await page.waitForURL(/\/settings#security$/)
await page.waitForTimeout(400)
const { top, atBottom } = await page.locator('#security').evaluate((node) => {
	const scroller = node.closest('.workspace-main')
	return { top: node.getBoundingClientRect().top, atBottom: scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2 }
})
check('the section is scrolled into view', top >= 0 && (top < 200 || atBottom), `${top} ${atBottom}`)

// Already on Settings: picking another section scrolls there.
found = await search('theme')
check('theme finds Preferences', found.includes('Preferences'), found.join('|'))
await page.keyboard.press('Enter')
await page.waitForURL(/#preferences$/)
await page.waitForTimeout(400)
const prefTop = await page.locator('#preferences').evaluate((node) => node.getBoundingClientRect().top)
check('picking a section on the same page scrolls to it', prefTop >= 0 && prefTop < 200, String(prefTop))

const settingsWidth = (await page.locator('.app-page').boundingBox()).width
const settingsContent = (await page.locator('.st-layout').boundingBox()).width
check('Settings is as wide as Profile', Math.abs(settingsWidth - profileWidth) < 1 && Math.abs(settingsContent - profileContent) < 1, `${settingsContent} vs ${profileContent}`)

// Ukrainian words work too.
await me.call('PATCH', '/auth/settings', { language: 'uk' })
await page.reload(); await page.waitForSelector('.st-layout')
found = await search('пароль')
check('Ukrainian keywords find the section', found.includes('Вхід і безпека'), found.join('|'))
await page.keyboard.press('Escape')

await browser.close(); done()
