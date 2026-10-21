const fallbackTimezones = [
	'UTC',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Kyiv',
	'America/New_York',
	'America/Los_Angeles',
	'Asia/Dubai',
	'Asia/Tokyo',
	'Asia/Singapore',
	'Australia/Sydney',
]

const popularTimezones = [
	'Europe/Kyiv',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Paris',
	'Europe/Madrid',
	'Europe/Rome',
	'Europe/Amsterdam',
	'Europe/Warsaw',
	'Europe/Prague',
	'Europe/Vienna',
	'Europe/Lisbon',
	'Europe/Istanbul',
	'Europe/Moscow',
	'America/New_York',
	'America/Toronto',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'America/Vancouver',
	'America/Mexico_City',
	'America/Sao_Paulo',
	'America/Argentina/Buenos_Aires',
	'America/Santiago',
	'America/Bogota',
	'America/Lima',
	'Africa/Cairo',
	'Africa/Johannesburg',
	'Africa/Nairobi',
	'Asia/Jerusalem',
	'Asia/Dubai',
	'Asia/Riyadh',
	'Asia/Kolkata',
	'Asia/Dhaka',
	'Asia/Bangkok',
	'Asia/Singapore',
	'Asia/Hong_Kong',
	'Asia/Shanghai',
	'Asia/Seoul',
	'Asia/Tokyo',
	'Australia/Sydney',
	'Australia/Melbourne',
	'Pacific/Auckland',
]

// Browsers still report some zones by their old names ("Europe/Kiev"); show and
// store the current ones so a city appears once and detection matches the list.
const TIMEZONE_ALIASES = {
	'Europe/Kiev': 'Europe/Kyiv',
	'Europe/Uzhgorod': 'Europe/Kyiv',
	'Europe/Zaporozhye': 'Europe/Kyiv',
	'Asia/Calcutta': 'Asia/Kolkata',
	'Asia/Saigon': 'Asia/Ho_Chi_Minh',
	'Asia/Katmandu': 'Asia/Kathmandu',
	'Asia/Rangoon': 'Asia/Yangon',
	'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
	'America/Godthab': 'America/Nuuk',
	'Atlantic/Faeroe': 'Atlantic/Faroe',
}

export const normalizeTimezone = (timeZone = '') => TIMEZONE_ALIASES[timeZone] || timeZone

const getTimezoneOffset = (timeZone) => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		timeZoneName: 'longOffset',
	}).formatToParts(new Date())
	const offset =
		parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT'
	const normalizedOffset = offset.replace('GMT', 'UTC')
	return normalizedOffset === 'UTC' ? 'UTC+00:00' : normalizedOffset
}

const getTimezoneCity = (timeZone) =>
	timeZone.split('/').pop().replaceAll('_', ' ')

const supportedTimezones =
	typeof Intl.supportedValuesOf === 'function'
		? Intl.supportedValuesOf('timeZone')
		: fallbackTimezones

const allTimezones = ['UTC', ...popularTimezones, ...supportedTimezones.map(normalizeTimezone)].filter(
	(timeZone, index, timezones) => timezones.indexOf(timeZone) === index,
)

export const timezoneOptions = allTimezones.map((timeZone) => ({
	value: timeZone,
	label: `${timeZone === 'UTC' ? 'UTC' : getTimezoneCity(timeZone)} (${getTimezoneOffset(timeZone)})`,
}))

export const getDetectedTimezone = () => {
	const detectedTimezone = normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
	return timezoneOptions.some((option) => option.value === detectedTimezone)
		? detectedTimezone
		: 'UTC'
}

export const popularTimezoneIds = popularTimezones

// City names people type in Ukrainian or Russian. Only the cities a zone is named after.
const CITY_NAMES = {
	'Europe/Kyiv': 'Київ Киев Україна Украина',
	'Europe/London': 'Лондон Британія Великобритания Англія Англия',
	'Europe/Berlin': 'Берлін Берлин Німеччина Германия',
	'Europe/Paris': 'Париж Франція Франция',
	'Europe/Madrid': 'Мадрид Іспанія Испания',
	'Europe/Rome': 'Рим Італія Италия',
	'Europe/Amsterdam': 'Амстердам Нідерланди Нидерланды Голландія Голландия',
	'Europe/Warsaw': 'Варшава Польща Польша',
	'Europe/Prague': 'Прага Чехія Чехия',
	'Europe/Vienna': 'Відень Вена Австрія Австрия',
	'Europe/Lisbon': 'Лісабон Лиссабон Португалія Португалия',
	'Europe/Istanbul': 'Стамбул Туреччина Турция',
	'Europe/Moscow': 'Москва',
	'Europe/Minsk': 'Мінськ Минск Білорусь Беларусь',
	'Europe/Chisinau': 'Кишинів Кишинев Молдова',
	'Europe/Bucharest': 'Бухарест Румунія Румыния',
	'Europe/Budapest': 'Будапешт Угорщина Венгрия',
	'Europe/Sofia': 'Софія София Болгарія Болгария',
	'Europe/Athens': 'Афіни Афины Греція Греция',
	'Europe/Helsinki': 'Гельсінкі Хельсинки Фінляндія Финляндия',
	'Europe/Stockholm': 'Стокгольм Швеція Швеция',
	'Europe/Oslo': 'Осло Норвегія Норвегия',
	'Europe/Copenhagen': 'Копенгаген Данія Дания',
	'Europe/Brussels': 'Брюссель Бельгія Бельгия',
	'Europe/Zurich': 'Цюрих Швейцарія Швейцария',
	'Europe/Dublin': 'Дублін Дублин Ірландія Ирландия',
	'Europe/Riga': 'Рига Латвія Латвия',
	'Europe/Vilnius': 'Вільнюс Вильнюс Литва',
	'Europe/Tallinn': 'Таллінн Таллин Естонія Эстония',
	'Europe/Belgrade': 'Белград Сербія Сербия',
	'Europe/Bratislava': 'Братислава Словаччина Словакия',
	'Asia/Tbilisi': 'Тбілісі Тбилиси Грузія Грузия',
	'Asia/Yerevan': 'Єреван Ереван Вірменія Армения',
	'Asia/Baku': 'Баку Азербайджан',
	'Asia/Almaty': 'Алмати Алматы Казахстан',
	'Asia/Tashkent': 'Ташкент Узбекистан',
	'America/New_York': 'Нью-Йорк Нью Йорк США',
	'America/Toronto': 'Торонто Канада',
	'America/Chicago': 'Чикаго',
	'America/Denver': 'Денвер',
	'America/Los_Angeles': 'Лос-Анджелес Лос Анджелес',
	'America/Vancouver': 'Ванкувер',
	'America/Mexico_City': 'Мехіко Мехико Мексика',
	'America/Sao_Paulo': 'Сан-Паулу Сан-Паулу Бразилія Бразилия',
	'America/Argentina/Buenos_Aires': 'Буенос-Айрес Буэнос-Айрес Аргентина',
	'America/Santiago': 'Сантьяго Чилі Чили',
	'America/Bogota': 'Богота Колумбія Колумбия',
	'America/Lima': 'Ліма Лима Перу',
	'Africa/Cairo': 'Каїр Каир Єгипет Египет',
	'Africa/Johannesburg': 'Йоганнесбург Йоханнесбург ПАР ЮАР',
	'Africa/Nairobi': 'Найробі Найроби Кенія Кения',
	'Asia/Jerusalem': 'Єрусалим Иерусалим Ізраїль Израиль',
	'Asia/Dubai': 'Дубай ОАЕ ОАЭ Емірати Эмираты',
	'Asia/Riyadh': 'Ер-Ріяд Эр-Рияд Саудівська Саудовская',
	'Asia/Kolkata': 'Колката Калькутта Індія Индия Делі Дели Мумбаї Мумбаи',
	'Asia/Dhaka': 'Дакка Бангладеш',
	'Asia/Bangkok': 'Бангкок Таїланд Таиланд',
	'Asia/Singapore': 'Сінгапур Сингапур',
	'Asia/Hong_Kong': 'Гонконг',
	'Asia/Shanghai': 'Шанхай Китай Пекін Пекин',
	'Asia/Seoul': 'Сеул Корея',
	'Asia/Tokyo': 'Токіо Токио Японія Япония',
	'Asia/Ho_Chi_Minh': 'Хошімін Хошимин Вʼєтнам Вьетнам',
	'Asia/Jakarta': 'Джакарта Індонезія Индонезия',
	'Asia/Manila': 'Маніла Манила Філіппіни Филиппины',
	'Australia/Sydney': 'Сідней Сидней Австралія Австралия',
	'Australia/Melbourne': 'Мельбурн',
	'Pacific/Auckland': 'Окленд Нова Зеландія Новая Зеландия',
}

// Words that also mean these cities in English.
const ENGLISH_EXTRA = {
	'Europe/Kyiv': 'Kiev Ukraine',
	'Europe/London': 'United Kingdom UK Britain England',
	'America/New_York': 'NYC USA Eastern',
	'America/Los_Angeles': 'LA San Francisco Pacific',
	'America/Chicago': 'Central',
	'America/Denver': 'Mountain',
	'Asia/Kolkata': 'Calcutta India Delhi Mumbai Bangalore',
	'Asia/Shanghai': 'Beijing China',
	'Asia/Ho_Chi_Minh': 'Saigon Vietnam',
}

const offsetMinutesOf = (offset) => {
	const match = offset.match(/([+-])(\d{2}):(\d{2})/)
	return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0
}

const genericName = (timeZone, locale) => {
	try {
		return new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value || ''
	} catch {
		return ''
	}
}

const fold = (text) => text.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʼ'’`_-]/g, ' ').replace(/ё/g, 'е')

const entriesByLocale = new Map()

/** Every zone with what to show (city, area, offset) and everything it can be found by. */
export const timezoneEntries = (locale = 'en') => {
	if (entriesByLocale.has(locale)) return entriesByLocale.get(locale)
	const entries = allTimezones.map((value) => {
		const offset = getTimezoneOffset(value)
		const offsetMinutes = offsetMinutesOf(offset)
		const hours = Math.trunc(Math.abs(offsetMinutes) / 60)
		const sign = offsetMinutes < 0 ? '-' : '+'
		const city = value === 'UTC' ? 'UTC' : getTimezoneCity(value)
		const area = genericName(value, locale)
		const words = [
			value, city, area, genericName(value, 'en'), CITY_NAMES[value] || '', ENGLISH_EXTRA[value] || '',
			offset, `utc${sign}${hours}`, `gmt${sign}${hours}`, `${sign}${hours}`,
		]
		const rank = popularTimezones.indexOf(value)
		return { value, city, area, offset, offsetMinutes, popularity: rank < 0 ? popularTimezones.length : rank, cityKey: fold(city), localCityKey: fold(CITY_NAMES[value] || ''), search: fold(words.join(' ')).replace(/\s+/g, ' ') }
	})
	entriesByLocale.set(locale, entries)
	return entries
}

/** Zones matching what was typed: city names first, then areas, offsets and codes. */
export const searchTimezones = (query, locale) => {
	const needle = fold(query.trim()).replace(/\s+/g, ' ')
	const entries = timezoneEntries(locale)
	if (!needle) return entries
	const compact = needle.replace(/\s+/g, '')
	const scored = []
	for (const entry of entries) {
		let score = -1
		if (entry.cityKey === needle) score = 0
		else if (entry.cityKey.startsWith(needle) || entry.localCityKey.split(' ').some((word) => word.startsWith(needle))) score = 1
		else if (entry.cityKey.includes(needle) || entry.localCityKey.includes(needle)) score = 2
		else if (entry.search.includes(needle) || entry.search.replace(/\s+/g, '').includes(compact)) score = 3
		if (score >= 0) scored.push([score, entry])
	}
	return scored.sort((a, b) => a[0] - b[0] || a[1].popularity - b[1].popularity || a[1].offsetMinutes - b[1].offsetMinutes || a[1].city.localeCompare(b[1].city)).map(([, entry]) => entry)
}
