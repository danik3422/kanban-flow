// Reads a board file in the browser: a Trello JSON export or KanbanHub's own export,
// and turns it into what POST /board/boards/import accepts (importBoardSchema).

const LIMITS = { lists: 100, cardsPerList: 2000, cards: 5000, labels: 50, title: 200, listTitle: 60, label: 40, item: 300, comment: 2000, comments: 100, description: 20000, boardDescription: 1000 }
const COLORS = new Set(['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'gray'])
const TRELLO_COLORS = { black: 'gray', null: 'gray' }

export class BoardFileError extends Error {
	constructor(code) {
		super(code)
		this.code = code
	}
}

const clip = (value, length) => String(value ?? '').trim().slice(0, length)
const dateOnly = (value) => (value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : null)
const byPos = (a, b) => (a.pos ?? 0) - (b.pos ?? 0)
const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

const inline = (text) => escapeHtml(text)
	.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
	.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
	.replace(/`([^`]+)`/g, '<code>$1</code>')
	.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')

/** Trello's Markdown as the simple HTML card descriptions use: paragraphs, lists, bold, links. */
export const markdownToHtml = (markdown) => {
	const blocks = []
	let list = null
	for (const raw of String(markdown || '').replace(/\r\n/g, '\n').split('\n')) {
		const line = raw.trimEnd()
		const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
		const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
		const item = bullet || numbered
		if (item) {
			const tag = bullet ? 'ul' : 'ol'
			if (!list || list.tag !== tag) {
				list = { tag, items: [] }
				blocks.push(list)
			}
			list.items.push(inline(item[1]))
			continue
		}
		list = null
		if (!line.trim()) {
			blocks.push(null)
			continue
		}
		const heading = /^#{1,6}\s+(.*)$/.exec(line)
		const last = blocks.at(-1)
		if (heading) blocks.push({ tag: 'p', text: `<strong>${inline(heading[1])}</strong>` })
		else if (last?.tag === 'p' && !last.closed) last.text += `<br>${inline(line)}`
		else blocks.push({ tag: 'p', text: inline(line) })
		if (heading) blocks.at(-1).closed = true
	}
	return blocks
		.filter(Boolean)
		.map((block) => (block.items ? `<${block.tag}>${block.items.map((item) => `<li>${item}</li>`).join('')}</${block.tag}>` : `<p>${block.text}</p>`))
		.join('')
		.slice(0, LIMITS.description)
}

const finish = (board) => {
	if (!board.columns.length) throw new BoardFileError('empty')
	if (board.columns.length > LIMITS.lists) throw new BoardFileError('tooLarge')
	const cards = board.columns.reduce((sum, column) => sum + column.cards.length, 0)
	if (cards > LIMITS.cards || board.columns.some((column) => column.cards.length > LIMITS.cardsPerList)) throw new BoardFileError('tooLarge')
	const labels = [...new Map(board.labels.map((label) => [label.name.toLowerCase(), label])).values()].slice(0, LIMITS.labels)
	const all = board.columns.flatMap((column) => column.cards.map((card) => ({ card, archived: column.archived || card.archived })))
	return {
		...board,
		labels,
		summary: {
			lists: board.columns.filter((column) => !column.archived).length,
			cards: all.filter((item) => !item.archived).length,
			archived: all.filter((item) => item.archived).length + board.columns.filter((column) => column.archived && !column.cards.length).length,
			labels: labels.length,
			comments: all.reduce((sum, item) => sum + (item.card.comments?.length || 0), 0),
		},
	}
}

const fromTrello = (data) => {
	const labels = (data.labels || []).map((label) => {
		const base = String(label.color ?? 'null').split('_')[0]
		const color = COLORS.has(base) ? base : TRELLO_COLORS[base] || 'gray'
		const name = clip(label.name, LIMITS.label) || color.charAt(0).toUpperCase() + color.slice(1)
		return { id: label.id, name, color }
	})
	const labelName = new Map(labels.map((label) => [label.id, label.name]))
	const checklists = Map.groupBy([...(data.checklists || [])].sort(byPos), (checklist) => checklist.idCard)
	const comments = Map.groupBy(
		(data.actions || []).filter((action) => action.type === 'commentCard' && action.data?.card?.id && action.data?.text?.trim()).reverse(),
		(action) => action.data.card.id,
	)
	const cardsOf = Map.groupBy([...(data.cards || [])].sort(byPos), (card) => card.idList)
	const columns = [...(data.lists || [])].sort(byPos).map((list) => ({
		title: clip(list.name, LIMITS.listTitle) || 'List',
		archived: Boolean(list.closed),
		cards: (cardsOf.get(list.id) || []).map((card) => ({
			title: clip(card.name, LIMITS.title) || 'Card',
			description: markdownToHtml(card.desc),
			dueDate: dateOnly(card.due),
			startDate: dateOnly(card.start),
			labels: [...new Set((card.idLabels || []).map((id) => labelName.get(id)).filter(Boolean))],
			checklist: (checklists.get(card.id) || [])
				.flatMap((checklist) => [...(checklist.checkItems || [])].sort(byPos))
				.map((item) => ({ text: clip(item.name, LIMITS.item), completed: item.state === 'complete' }))
				.filter((item) => item.text)
				.slice(0, 100),
			completed: Boolean(card.dueComplete),
			archived: Boolean(card.closed),
			comments: (comments.get(card.id) || []).slice(0, LIMITS.comments).map((action) => ({
				text: clip(action.data.text, LIMITS.comment),
				author: clip(action.memberCreator?.fullName || action.memberCreator?.username, 120),
				date: action.date,
			})),
		})),
	}))
	return finish({
		source: 'trello',
		name: clip(data.name, 100) || 'Trello board',
		description: clip(data.desc, LIMITS.boardDescription),
		labels: labels.map(({ name, color }) => ({ name, color })),
		columns,
	})
}

const fromKanbanHub = (data) => finish({
	source: 'kanbanhub',
	name: clip(data.name, 100) || 'Board',
	description: clip(data.description, LIMITS.boardDescription),
	labels: (data.labels || []).map((label) => ({ name: clip(label.name, LIMITS.label), color: COLORS.has(label.color) ? label.color : 'gray' })).filter((label) => label.name),
	columns: (data.columns || []).map((column) => ({
		title: clip(column.title, LIMITS.listTitle) || 'List',
		color: COLORS.has(column.color) ? column.color : null,
		archived: Boolean(column.archived),
		cards: (column.cards || []).map((card) => ({
			title: clip(card.title, LIMITS.title) || 'Card',
			description: String(card.description || '').slice(0, LIMITS.description),
			dueDate: dateOnly(card.dueDate),
			startDate: dateOnly(card.startDate),
			priority: ['none', 'low', 'medium', 'high', 'urgent'].includes(card.priority) ? card.priority : 'none',
			labels: (card.labels || []).map((label) => clip(label, LIMITS.label)).filter(Boolean).slice(0, 20),
			checklist: (card.checklist || []).map((item) => ({ text: clip(item.text, LIMITS.item), completed: Boolean(item.completed) })).filter((item) => item.text).slice(0, 100),
			completed: Boolean(card.completed),
			archived: Boolean(card.archived),
			estimateMinutes: Number.isInteger(card.estimateMinutes) && card.estimateMinutes > 0 ? Math.min(card.estimateMinutes, 100000) : 0,
			comments: (card.comments || []).filter((comment) => comment?.text?.trim()).slice(0, LIMITS.comments).map((comment) => ({
				text: clip(comment.text, LIMITS.comment),
				author: clip(comment.author, 120),
				date: comment.date ? String(comment.date).slice(0, 40) : undefined,
			})),
		})),
	})),
})

/** The parsed board with a `summary`, or throws BoardFileError ('json', 'unknown', 'empty', 'tooLarge'). */
export const parseBoardFile = (text) => {
	let data
	try {
		data = JSON.parse(text)
	} catch {
		throw new BoardFileError('json')
	}
	if (data?.format === 'kanbanhub-board') return fromKanbanHub(data)
	if (Array.isArray(data?.lists) && Array.isArray(data?.cards)) return fromTrello(data)
	throw new BoardFileError('unknown')
}

/** The request body for POST /board/boards/import. */
export const importPayload = ({ source, name, description, labels, columns }, overrides = {}) => ({ source, name, description, labels, columns, ...overrides })
