import { Archive, AtSign, CalendarDays, ChevronsRightLeft, Filter, ImageIcon, ImagePlus, Keyboard, LayoutTemplate, Repeat, Search, Server, Table2, Upload, WifiOff } from 'lucide-react'

// Tips about KanbanHub's features, shown one at a time under the light bulb in the top
// bar. `tone` picks the illustration's colours; `action` is what the button does:
// a board view, an app event, or a page to open (`state` is passed to the route).
// `phone: false` hides a tip on phones (keyboard-only features); `phoneText` uses
// tips.items.<key>.textPhone there (and titlePhone with `phoneTitle`), for features that
// work differently on a phone.
export const TIPS = [
	{ key: 'planner', icon: CalendarDays, tone: 'violet', action: { boardView: 'planner' }, phoneText: true, phoneTitle: true },
	{ key: 'table', icon: Table2, tone: 'teal', action: { boardView: 'table' }, phoneText: true },
	{ key: 'repeat', icon: Repeat, tone: 'amber' },
	{ key: 'mentions', icon: AtSign, tone: 'blue' },
	{ key: 'shortcuts', icon: Keyboard, tone: 'slate', action: { event: 'kh:shortcuts', board: true }, phone: false },
	{ key: 'templates', icon: LayoutTemplate, tone: 'teal', action: { to: '/workspaces', state: { createBoard: true } } },
	{ key: 'archive', icon: Archive, tone: 'rose' },
	{ key: 'import', icon: Upload, tone: 'blue', action: { to: '/workspaces', state: { importBoard: true } } },
	{ key: 'search', icon: Search, tone: 'violet', action: { event: 'kh:search' }, phoneText: true },
	{ key: 'filter', icon: Filter, tone: 'amber', phoneText: true },
	{ key: 'cover', icon: ImagePlus, tone: 'rose' },
	{ key: 'background', icon: ImageIcon, tone: 'teal' },
	{ key: 'collapse', icon: ChevronsRightLeft, tone: 'slate', phone: false },
	{ key: 'offline', icon: WifiOff, tone: 'blue' },
	{ key: 'selfHost', icon: Server, tone: 'violet', action: { to: '/self-hosting' } },
]

const SEEN_KEY = 'kh:tips-seen'
const LAST_KEY = 'kh:tips-last'

export const readSeen = () => {
	try {
		const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
		return Array.isArray(seen) ? seen : []
	} catch {
		return []
	}
}

export const markSeen = (key) => {
	try {
		const seen = new Set(readSeen())
		seen.add(key)
		localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
		localStorage.setItem(LAST_KEY, key)
	} catch {
		// Only a preference.
	}
}

/** The tips that make sense on this device. */
export const tipsFor = (isPhone) => (isPhone ? TIPS.filter((tip) => tip.phone !== false) : TIPS)

/** Where to start in `tips`: the first one not seen yet, otherwise the one after the last shown. */
export const startIndex = (tips = TIPS) => {
	const seen = new Set(readSeen())
	const unseen = tips.findIndex((tip) => !seen.has(tip.key))
	if (unseen >= 0) return unseen
	let last = -1
	try {
		last = tips.findIndex((tip) => tip.key === localStorage.getItem(LAST_KEY))
	} catch {
		// Start from the top.
	}
	return (last + 1) % tips.length
}

export const hasUnseen = (tips = TIPS) => {
	const seen = new Set(readSeen())
	return tips.some((tip) => !seen.has(tip.key))
}

// Phones show a "swipe" hint until the first swipe.
const SWIPED_KEY = 'kh:tips-swiped'
export const hasSwiped = () => {
	try {
		return localStorage.getItem(SWIPED_KEY) === '1'
	} catch {
		return true
	}
}
export const markSwiped = () => {
	try {
		localStorage.setItem(SWIPED_KEY, '1')
	} catch {
		// Only a hint.
	}
}
