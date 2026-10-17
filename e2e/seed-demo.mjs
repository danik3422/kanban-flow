// Fills the running local stack with a verified demo account, a teammate and
// a few boards with tasks, so the app can be explored by hand.
//   node e2e/seed-demo.mjs        (after `npm run e2e:start`)
import { APP, createVerifiedUser as createUser } from './lib.mjs'
import { DEMO } from './seed-demo-account.mjs'

const TEAMMATE = { email: 'olena@kanbanhub.local', password: 'Demo12345!', name: 'Olena Kovalenko' }

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

const demo = await createUser(DEMO, 'Product designer')
const teammate = await createUser(TEAMMATE, 'Frontend developer')

const boards = [
	{
		name: 'Запуск мобильного приложения',
		columns: {
			'К выполнению': [
				{ title: 'Исследовать конкурентов', labels: ['Research'], priority: 'medium', dueDate: day(5) },
				{ title: 'Собрать отзывы бета-тестеров', priority: 'low' },
				{ title: 'Подготовить скриншоты для App Store', labels: ['Design'], dueDate: day(9) },
			],
			'В работе': [
				{ title: 'Макеты онбординга', labels: ['Design'], priority: 'high', dueDate: day(0), mine: true, checklist: ['Экран приветствия', 'Выбор языка', 'Уведомления'] },
				{ title: 'Push-уведомления', labels: ['Backend'], priority: 'urgent', dueDate: day(1), team: true },
			],
			'На проверке': [{ title: 'Тёмная тема', labels: ['Design', 'Frontend'], priority: 'medium', dueDate: day(-1), mine: true }],
			Готово: [
				{ title: 'Настроить CI', labels: ['DevOps'] },
				{ title: 'Логин через Google', labels: ['Backend'], team: true },
			],
		},
	},
	{
		name: 'Маркетинг Q4',
		columns: {
			Идеи: [{ title: 'Серия постов о продукте', labels: ['Content'] }, { title: 'Вебинар для команд', priority: 'medium', dueDate: day(14) }],
			'В работе': [{ title: 'Лендинг для новой функции', labels: ['Design'], priority: 'high', dueDate: day(3), mine: true }],
			Готово: [{ title: 'Рассылка за сентябрь', labels: ['Email'] }],
		},
	},
	{ name: 'Личные задачи', columns: { Сегодня: [{ title: 'Ответить на письма', mine: true, dueDate: day(0) }], Потом: [], Готово: [] } },
]

for (const board of boards) {
	const { _id: boardId } = await demo.call('POST', '/board/boards', { name: board.name })
	const invite = await demo.call('POST', `/board/boards/${boardId}/invites`, { email: TEAMMATE.email, role: 'member' }).catch(() => null)
	const inviteToken = invite?.inviteUrl && new URL(invite.inviteUrl).pathname.split('/').pop()
	if (inviteToken) await teammate.call('POST', `/board/invites/${inviteToken}/accept`).catch(() => {})
	let columnIndex = 0
	for (const [title, tasks] of Object.entries(board.columns)) {
		const { _id: columnId } = await demo.call('POST', `/board/boards/${boardId}/columns`, { title, position: columnIndex++ })
		for (const [position, task] of tasks.entries()) {
			const { mine, team, checklist = [], ...fields } = task
			const assignees = [mine && demo.id, team && teammate.id].filter(Boolean)
			await demo
				.call('POST', `/board/columns/${columnId}/task`, { ...fields, position, assignees, checklist: checklist.map((text, i) => ({ text, completed: i === 0 })) })
				.catch(() => demo.call('POST', `/board/columns/${columnId}/task`, { ...fields, position, checklist: [] }))
		}
	}
}

console.log(`Demo account ready at ${APP}/login\n  email:    ${DEMO.email}\n  password: ${DEMO.password}`)
