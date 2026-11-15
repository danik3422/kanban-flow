// Deleting an account from Settings: a wrong password changes nothing; the right one
// deletes the account and its own boards, signs out, and the old password no longer works.
import { API, APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const email = `leaver-${Date.now()}@example.com`
const password = 'Password123!'
const { call } = await createVerifiedUser({ email, password, name: 'Лиза Уходящая' })
const board = await call('POST', '/board/boards', { name: 'Личные заметки' })

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.addInitScript(() => localStorage.setItem('kanban-language', 'ru'))
const page = await context.newPage(); watch(page, 'leaver')
await page.goto(`${APP}/login`)
await uiLogin(page, email, password)
await page.waitForURL(/\/workspaces/)

await page.goto(`${APP}/settings#security`)
const open = page.locator('[data-action=delete-account]')
await open.waitFor()
check('settings offer to delete the account', (await open.innerText()).trim() === 'Удалить аккаунт')

await open.click()
const dialog = page.getByRole('dialog', { name: 'Удалить ваш аккаунт?' })
await dialog.waitFor()
await dialog.locator('#st-delete-password').fill('not my password')
await dialog.getByRole('button', { name: 'Удалить навсегда' }).click()
await dialog.getByText('Текущий пароль неверный.').waitFor()
check('a wrong password is refused in the dialog', await dialog.isVisible())

await dialog.locator('#st-delete-password').fill(password)
await dialog.getByRole('button', { name: 'Удалить навсегда' }).click()
await page.waitForURL(`${APP}/`)
check('deleting leads out of the app', new URL(page.url()).pathname === '/')
check('it confirms the account is gone', await page.getByText('Ваш аккаунт удалён.').isVisible())

const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: APP }, body: JSON.stringify({ email, password }) })
check('the old email and password no longer sign in', login.status !== 200, `status ${login.status}`)
const boardGone = await call('GET', `/board/boards/${board._id}`).then(() => false, (error) => /→ 40[134]/.test(error.message))
check('the old session cannot reach the deleted board', boardGone)

await browser.close()
done()
