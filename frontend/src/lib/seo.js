// Per-route <head> metadata: title, description, robots, canonical and the
// Open Graph / Twitter copies of them. pageMetaFor() is pure so it can be tested
// in node; applyPageMeta() writes the result into the document.

export const SITE_URL = 'https://kanbanhub.app'
export const SITE_NAME = 'KanbanHub'

export const OG_LOCALES = { en: 'en_US', uk: 'uk_UA', ru: 'ru_RU' }

// Public marketing pages: crawled, indexed and listed in the sitemap.
const INDEX = 'index,follow,max-image-preview:large'
// Private links (shared boards, invites) and signed-in pages: never indexed,
// and their links (often user content) are not followed.
const PRIVATE = 'noindex,nofollow'
// A missing page is not indexed, but its navigation links may still be followed.
const NOT_FOUND = 'noindex,follow'

// Signed-in or one-off account pages, mirroring the routes in App.jsx.
const PRIVATE_PAGES = {
	'/workspaces': 'boards',
	'/my-tasks': 'myTasks',
	'/calendar': 'calendar',
	'/team': 'team',
	'/profile': 'profile',
	'/profile/edit': 'profile',
	'/settings': 'settings',
	'/setup-profile': 'setupProfile',
	'/login/resetpassword': 'resetPassword',
	'/login/verify-email': 'verifyEmail',
	'/verify-email': 'verifyEmail',
}

const STRINGS = {
	en: {
		home: {
			title: 'KanbanHub — Free, open-source kanban boards',
			description: 'Plan work on boards with lists, cards, checklists, due dates and time tracking. Free and open source, with real-time sync and no trackers or ads.',
		},
		about: {
			title: 'About KanbanHub — Open source, private by design',
			description: 'Why KanbanHub is free and open source, what data it keeps, why it has no analytics, trackers or ads, and the plan for self-hosting with Docker.',
		},
		login: {
			title: 'Log in — KanbanHub',
			description: 'Log in to KanbanHub with your email, a passkey, or Google, Microsoft or Apple, and pick up your boards where you left off.',
		},
		signup: {
			title: 'Sign up free — KanbanHub',
			description: 'Create a free KanbanHub account and set up your first board. Invite your team by email or link. No trackers, no ads.',
		},
		publicBoard: {
			title: 'Shared board — KanbanHub',
			description: 'A read-only KanbanHub board shared by its owner. Browse its lists and cards without an account.',
		},
		invite: {
			title: 'Board invitation — KanbanHub',
			description: 'You have been invited to a KanbanHub board. Sign in or create a free account to join and start working together.',
		},
		notFound: {
			title: 'Page not found — KanbanHub',
			description: 'This page does not exist or has moved. Go back to the KanbanHub home page to find your boards.',
		},
		private: {
			boards: 'Boards',
			myTasks: 'My tasks',
			calendar: 'Calendar',
			team: 'Team',
			profile: 'Profile',
			settings: 'Settings',
			setupProfile: 'Set up your profile',
			resetPassword: 'Reset password',
			verifyEmail: 'Verify email',
		},
	},
	uk: {
		home: {
			title: 'KanbanHub — безкоштовні канбан-дошки з відкритим кодом',
			description: 'Плануйте роботу на дошках зі списками, картками, чек-листами, термінами й обліком часу. Безкоштовно, відкритий код, без трекерів і реклами.',
		},
		about: {
			title: 'Про KanbanHub — відкритий код і приватність',
			description: 'Чому KanbanHub безкоштовний і відкритий, які дані він зберігає, чому тут немає аналітики, трекерів і реклами, і плани на self-hosting у Docker.',
		},
		login: {
			title: 'Вхід — KanbanHub',
			description: 'Увійдіть у KanbanHub за email, ключем доступу або через Google, Microsoft чи Apple і продовжуйте роботу з дошками.',
		},
		signup: {
			title: 'Безкоштовна реєстрація — KanbanHub',
			description: 'Створіть безкоштовний акаунт KanbanHub і першу дошку. Запрошуйте команду за email або посиланням. Без трекерів і реклами.',
		},
		publicBoard: {
			title: 'Спільна дошка — KanbanHub',
			description: 'Дошка KanbanHub, якою поділився власник, у режимі перегляду. Переглядайте списки й картки без акаунта.',
		},
		invite: {
			title: 'Запрошення на дошку — KanbanHub',
			description: 'Вас запросили на дошку KanbanHub. Увійдіть або створіть безкоштовний акаунт, щоб приєднатися до команди.',
		},
		notFound: {
			title: 'Сторінку не знайдено — KanbanHub',
			description: 'Цієї сторінки не існує або її перенесено. Поверніться на головну KanbanHub, щоб знайти свої дошки.',
		},
		private: {
			boards: 'Дошки',
			myTasks: 'Мої завдання',
			calendar: 'Календар',
			team: 'Команда',
			profile: 'Профіль',
			settings: 'Налаштування',
			setupProfile: 'Налаштування профілю',
			resetPassword: 'Скидання пароля',
			verifyEmail: 'Підтвердження email',
		},
	},
	ru: {
		home: {
			title: 'KanbanHub — бесплатные канбан-доски с открытым кодом',
			description: 'Планируйте работу на досках со списками, карточками, чек-листами, сроками и учётом времени. Бесплатно, открытый код, без трекеров и рекламы.',
		},
		about: {
			title: 'О KanbanHub — открытый код и приватность',
			description: 'Почему KanbanHub бесплатный и открытый, какие данные он хранит, почему здесь нет аналитики, трекеров и рекламы, и планы на self-hosting в Docker.',
		},
		login: {
			title: 'Вход — KanbanHub',
			description: 'Войдите в KanbanHub по email, ключу доступа или через Google, Microsoft или Apple и продолжайте работу с досками.',
		},
		signup: {
			title: 'Бесплатная регистрация — KanbanHub',
			description: 'Создайте бесплатный аккаунт KanbanHub и первую доску. Приглашайте команду по email или ссылке. Без трекеров и рекламы.',
		},
		publicBoard: {
			title: 'Общая доска — KanbanHub',
			description: 'Доска KanbanHub, которой поделился владелец, в режиме просмотра. Смотрите списки и карточки без аккаунта.',
		},
		invite: {
			title: 'Приглашение на доску — KanbanHub',
			description: 'Вас пригласили на доску KanbanHub. Войдите или создайте бесплатный аккаунт, чтобы присоединиться к команде.',
		},
		notFound: {
			title: 'Страница не найдена — KanbanHub',
			description: 'Этой страницы нет или она перемещена. Вернитесь на главную KanbanHub, чтобы найти свои доски.',
		},
		private: {
			boards: 'Доски',
			myTasks: 'Мои задачи',
			calendar: 'Календарь',
			team: 'Команда',
			profile: 'Профиль',
			settings: 'Настройки',
			setupProfile: 'Настройка профиля',
			resetPassword: 'Сброс пароля',
			verifyEmail: 'Подтверждение email',
		},
	},
}

export const SEO_LANGUAGES = Object.keys(STRINGS)

const normalizePath = (pathname = '/') => {
	const path = String(pathname || '/').split(/[?#]/)[0] || '/'
	return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path
}

const isUnder = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`)

// { title, description, robots, canonical (absolute URL or null), url, locale, alternateLocales }
export const pageMetaFor = (pathname, language = 'en') => {
	const lang = STRINGS[language] ? language : 'en'
	const strings = STRINGS[lang]
	const path = normalizePath(pathname)
	const indexable = (key) => ({ ...strings[key], robots: INDEX, canonical: `${SITE_URL}${path === '/' ? '/' : path}` })
	const unlisted = (key, robots = PRIVATE) => ({ ...strings[key], robots, canonical: null })

	let meta
	if (path === '/') meta = indexable('home')
	else if (path === '/about') meta = indexable('about')
	else if (path === '/login') meta = indexable('login')
	else if (path === '/signup') meta = indexable('signup')
	else if (isUnder(path, '/public')) meta = unlisted('publicBoard')
	else if (isUnder(path, '/invite')) meta = unlisted('invite')
	else if (PRIVATE_PAGES[path] || isUnder(path, '/workspaces')) {
		const key = PRIVATE_PAGES[path] || 'boards'
		meta = { title: `${strings.private[key]} — ${SITE_NAME}`, description: strings.home.description, robots: PRIVATE, canonical: null }
	} else meta = unlisted('notFound', NOT_FOUND)

	return {
		...meta,
		url: meta.canonical || `${SITE_URL}${path}`,
		locale: OG_LOCALES[lang],
		alternateLocales: Object.values(OG_LOCALES).filter((locale) => locale !== OG_LOCALES[lang]),
	}
}

const upsertMeta = (doc, attribute, key, content) => {
	let element = doc.head.querySelector(`meta[${attribute}="${key}"]`)
	if (!element) {
		element = doc.createElement('meta')
		element.setAttribute(attribute, key)
		doc.head.appendChild(element)
	}
	element.setAttribute('content', content)
}

export const applyPageMeta = (meta, doc = document) => {
	doc.title = meta.title
	upsertMeta(doc, 'name', 'description', meta.description)
	upsertMeta(doc, 'name', 'robots', meta.robots)
	upsertMeta(doc, 'property', 'og:title', meta.title)
	upsertMeta(doc, 'property', 'og:description', meta.description)
	upsertMeta(doc, 'property', 'og:url', meta.url)
	upsertMeta(doc, 'property', 'og:locale', meta.locale)
	upsertMeta(doc, 'name', 'twitter:title', meta.title)
	upsertMeta(doc, 'name', 'twitter:description', meta.description)

	doc.head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((element) => element.remove())
	for (const locale of meta.alternateLocales) {
		const element = doc.createElement('meta')
		element.setAttribute('property', 'og:locale:alternate')
		element.setAttribute('content', locale)
		doc.head.appendChild(element)
	}

	// Only indexable pages carry a canonical; a canonical on a noindex page
	// would send search engines a mixed signal.
	let canonical = doc.head.querySelector('link[rel="canonical"]')
	if (meta.canonical) {
		if (!canonical) {
			canonical = doc.createElement('link')
			canonical.setAttribute('rel', 'canonical')
			doc.head.appendChild(canonical)
		}
		canonical.setAttribute('href', meta.canonical)
	} else canonical?.remove()
}
