const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const ALT = isMac ? '⌥' : 'Alt'
const MOD = isMac ? '⌘' : 'Ctrl'

// What each key does on a board (pages/Workspace.jsx handles them); "card" keys act on the
// card under the pointer or the focused one. Shared by the shortcuts dialog and the guide.
export const SHORTCUT_GROUPS = [
	{ key: 'board', rows: [['n', ['N']], ['filter', ['F']], ['mine', ['Q']], ['search', [MOD, 'K']], ['help', ['?']]] },
	{ key: 'card', rows: [['open', ['E']], ['me', ['M']], ['complete', ['C']], ['archive', ['A']]] },
	{ key: 'views', rows: [['planner', ['G', 'P']], ['board', ['G', 'B']], ['table', ['G', 'T']], ['switchBoards', ['B']]] },
	{ key: 'move', rows: [['select', ['↑', '↓', '←', '→']], ['moveInList', [ALT, '↑ ↓']], ['moveToList', [ALT, '← →']], ['close', ['Esc']]] },
]
