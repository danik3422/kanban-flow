import { Clapperboard, Code2, Home, LayoutTemplate, ListTodo, Truck } from 'lucide-react'

// Ready-made boards: lists, labels and a few example cards in the creator's language.
// The server checks the size (backend/validation/board.schemas.js, boardStarter).

const card = (title, extra = {}) => ({ title, ...extra })

const CONTENT = {
	basic: {
		en: { lists: ['To do', 'In progress', 'Done'], labels: [], cards: {} },
		uk: { lists: ['Зробити', 'У роботі', 'Готово'], labels: [], cards: {} },
		ru: { lists: ['Сделать', 'В работе', 'Готово'], labels: [], cards: {} },
	},
	software: {
		en: {
			lists: ['Backlog', 'To do', 'In progress', 'Review', 'Done'],
			labels: [['Bug', 'red'], ['Feature', 'green'], ['Design', 'purple'], ['Tech debt', 'gray']],
			cards: {
				0: [card('Dark mode', { labels: ['Feature'] }), card('Speed up board loading', { labels: ['Tech debt'] })],
				1: [card('Login button is cut off in Safari', { labels: ['Bug'], priority: 'high', checklist: ['Reproduce', 'Fix', 'Check on iPhone'] })],
				2: [card('New onboarding screens', { labels: ['Design', 'Feature'], description: 'Three short screens that show how boards, lists and cards work.', checklist: ['Sketches', 'Copy', 'Build'] })],
				4: [card('Set up the project', { checklist: ['Repository', 'CI', 'Staging'] })],
			},
		},
		uk: {
			lists: ['Беклог', 'Зробити', 'У роботі', 'Перевірка', 'Готово'],
			labels: [['Баг', 'red'], ['Функція', 'green'], ['Дизайн', 'purple'], ['Техборг', 'gray']],
			cards: {
				0: [card('Темна тема', { labels: ['Функція'] }), card('Пришвидшити завантаження дошки', { labels: ['Техборг'] })],
				1: [card('Кнопка входу обрізана в Safari', { labels: ['Баг'], priority: 'high', checklist: ['Відтворити', 'Виправити', 'Перевірити на iPhone'] })],
				2: [card('Нові екрани знайомства', { labels: ['Дизайн', 'Функція'], description: 'Три короткі екрани про те, як працюють дошки, списки й картки.', checklist: ['Ескізи', 'Тексти', 'Верстка'] })],
				4: [card('Налаштувати проєкт', { checklist: ['Репозиторій', 'CI', 'Тестовий сервер'] })],
			},
		},
		ru: {
			lists: ['Бэклог', 'Сделать', 'В работе', 'Проверка', 'Готово'],
			labels: [['Баг', 'red'], ['Фича', 'green'], ['Дизайн', 'purple'], ['Техдолг', 'gray']],
			cards: {
				0: [card('Тёмная тема', { labels: ['Фича'] }), card('Ускорить загрузку доски', { labels: ['Техдолг'] })],
				1: [card('Кнопка входа обрезана в Safari', { labels: ['Баг'], priority: 'high', checklist: ['Воспроизвести', 'Исправить', 'Проверить на iPhone'] })],
				2: [card('Новые экраны знакомства', { labels: ['Дизайн', 'Фича'], description: 'Три коротких экрана о том, как работают доски, списки и карточки.', checklist: ['Эскизы', 'Тексты', 'Вёрстка'] })],
				4: [card('Настроить проект', { checklist: ['Репозиторий', 'CI', 'Тестовый сервер'] })],
			},
		},
	},
	content: {
		en: {
			lists: ['Ideas', 'Writing', 'Editing', 'Scheduled', 'Published'],
			labels: [['Blog', 'blue'], ['Social', 'pink'], ['Video', 'orange'], ['Newsletter', 'green']],
			cards: {
				0: [card('Behind the scenes of our launch', { labels: ['Blog'] }), card('5 tips in 60 seconds', { labels: ['Video', 'Social'] })],
				1: [card('How we plan a month of posts', { labels: ['Blog'], checklist: ['Outline', 'First draft', 'Pictures'] })],
				3: [card('Monthly newsletter', { labels: ['Newsletter'], description: 'Best posts of the month, one product update and a question for readers.' })],
			},
		},
		uk: {
			lists: ['Ідеї', 'Пишемо', 'Редагуємо', 'Заплановано', 'Опубліковано'],
			labels: [['Блог', 'blue'], ['Соцмережі', 'pink'], ['Відео', 'orange'], ['Розсилка', 'green']],
			cards: {
				0: [card('Як ми готували запуск', { labels: ['Блог'] }), card('5 порад за 60 секунд', { labels: ['Відео', 'Соцмережі'] })],
				1: [card('Як ми плануємо місяць публікацій', { labels: ['Блог'], checklist: ['План', 'Чернетка', 'Ілюстрації'] })],
				3: [card('Щомісячна розсилка', { labels: ['Розсилка'], description: 'Найкращі публікації місяця, одна новина продукту й запитання до читачів.' })],
			},
		},
		ru: {
			lists: ['Идеи', 'Пишем', 'Редактируем', 'Запланировано', 'Опубликовано'],
			labels: [['Блог', 'blue'], ['Соцсети', 'pink'], ['Видео', 'orange'], ['Рассылка', 'green']],
			cards: {
				0: [card('Как мы готовили запуск', { labels: ['Блог'] }), card('5 советов за 60 секунд', { labels: ['Видео', 'Соцсети'] })],
				1: [card('Как мы планируем месяц публикаций', { labels: ['Блог'], checklist: ['План', 'Черновик', 'Иллюстрации'] })],
				3: [card('Ежемесячная рассылка', { labels: ['Рассылка'], description: 'Лучшие публикации месяца, одна новость продукта и вопрос читателям.' })],
			},
		},
	},
	personal: {
		en: {
			lists: ['Inbox', 'This week', 'Today', 'Done'],
			labels: [['Home', 'green'], ['Work', 'blue'], ['Health', 'red'], ['Money', 'yellow']],
			cards: {
				0: [card('Book a dentist appointment', { labels: ['Health'] }), card('Ideas for the weekend')],
				1: [card('Pay the bills', { labels: ['Money'], checklist: ['Rent', 'Internet', 'Phone'] }), card('Fix the kitchen tap', { labels: ['Home'] })],
				2: [card('Gym at 19:00', { labels: ['Health'] })],
			},
		},
		uk: {
			lists: ['Вхідні', 'Цього тижня', 'Сьогодні', 'Готово'],
			labels: [['Дім', 'green'], ['Робота', 'blue'], ['Здоровʼя', 'red'], ['Гроші', 'yellow']],
			cards: {
				0: [card('Записатися до стоматолога', { labels: ['Здоровʼя'] }), card('Ідеї на вихідні')],
				1: [card('Сплатити рахунки', { labels: ['Гроші'], checklist: ['Оренда', 'Інтернет', 'Телефон'] }), card('Полагодити кран на кухні', { labels: ['Дім'] })],
				2: [card('Спортзал о 19:00', { labels: ['Здоровʼя'] })],
			},
		},
		ru: {
			lists: ['Входящие', 'На этой неделе', 'Сегодня', 'Готово'],
			labels: [['Дом', 'green'], ['Работа', 'blue'], ['Здоровье', 'red'], ['Деньги', 'yellow']],
			cards: {
				0: [card('Записаться к стоматологу', { labels: ['Здоровье'] }), card('Идеи на выходные')],
				1: [card('Оплатить счета', { labels: ['Деньги'], checklist: ['Аренда', 'Интернет', 'Телефон'] }), card('Починить кран на кухне', { labels: ['Дом'] })],
				2: [card('Спортзал в 19:00', { labels: ['Здоровье'] })],
			},
		},
	},
	moving: {
		en: {
			lists: ['Before the move', 'Packing', 'Moving day', 'After the move'],
			labels: [['Documents', 'blue'], ['Buy', 'orange'], ['Utilities', 'sky']],
			cards: {
				0: [card('Book the movers', { priority: 'high' }), card('Tell the bank and post office the new address', { labels: ['Documents'] })],
				1: [card('Boxes, tape and markers', { labels: ['Buy'], checklist: ['20 boxes', 'Tape', 'Markers'] }), card('Pack the books')],
				2: [card('Meter readings in both flats', { labels: ['Utilities'] })],
				3: [card('Set up the internet', { labels: ['Utilities'] }), card('Register at the new address', { labels: ['Documents'] })],
			},
		},
		uk: {
			lists: ['До переїзду', 'Пакуємо', 'День переїзду', 'Після переїзду'],
			labels: [['Документи', 'blue'], ['Купити', 'orange'], ['Комуналка', 'sky']],
			cards: {
				0: [card('Замовити вантажників', { priority: 'high' }), card('Повідомити банк і пошту про нову адресу', { labels: ['Документи'] })],
				1: [card('Коробки, скотч і маркери', { labels: ['Купити'], checklist: ['20 коробок', 'Скотч', 'Маркери'] }), card('Запакувати книжки')],
				2: [card('Показники лічильників в обох квартирах', { labels: ['Комуналка'] })],
				3: [card('Підключити інтернет', { labels: ['Комуналка'] }), card('Зареєструватися за новою адресою', { labels: ['Документи'] })],
			},
		},
		ru: {
			lists: ['До переезда', 'Упаковка', 'День переезда', 'После переезда'],
			labels: [['Документы', 'blue'], ['Купить', 'orange'], ['Коммуналка', 'sky']],
			cards: {
				0: [card('Заказать грузчиков', { priority: 'high' }), card('Сообщить банку и почте новый адрес', { labels: ['Документы'] })],
				1: [card('Коробки, скотч и маркеры', { labels: ['Купить'], checklist: ['20 коробок', 'Скотч', 'Маркеры'] }), card('Упаковать книги')],
				2: [card('Показания счётчиков в обеих квартирах', { labels: ['Коммуналка'] })],
				3: [card('Подключить интернет', { labels: ['Коммуналка'] }), card('Прописаться по новому адресу', { labels: ['Документы'] })],
			},
		},
	},
}

/** The templates in the order they are offered; "blank" makes an empty board. */
export const BOARD_TEMPLATES = [
	{ key: 'blank', icon: LayoutTemplate },
	{ key: 'basic', icon: ListTodo },
	{ key: 'software', icon: Code2 },
	{ key: 'content', icon: Clapperboard },
	{ key: 'personal', icon: Home },
	{ key: 'moving', icon: Truck },
]

const contentFor = (key, language) => CONTENT[key]?.[language] || CONTENT[key]?.en

/** The list names a template makes, for the preview. */
export const templateLists = (key, language) => contentFor(key, language)?.lists || []

/** What POST /boards needs as `starter`, or undefined for an empty board. */
export const templateStarter = (key, language) => {
	const content = contentFor(key, language)
	if (!content) return undefined
	return {
		labels: content.labels.map(([name, color]) => ({ name, color })),
		columns: content.lists.map((title, index) => ({ title, cards: content.cards[index] || [] })),
	}
}
