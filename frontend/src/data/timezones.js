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

const allTimezones = ['UTC', ...popularTimezones, ...supportedTimezones].filter(
	(timeZone, index, timezones) => timezones.indexOf(timeZone) === index,
)

export const timezoneOptions = allTimezones.map((timeZone) => ({
	value: timeZone,
	label: `${timeZone === 'UTC' ? 'UTC' : getTimezoneCity(timeZone)} (${getTimezoneOffset(timeZone)})`,
}))

export const getDetectedTimezone = () => {
	const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
	return timezoneOptions.some((option) => option.value === detectedTimezone)
		? detectedTimezone
		: 'UTC'
}
