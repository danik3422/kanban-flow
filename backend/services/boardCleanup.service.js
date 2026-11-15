import BoardRule from '../models/boardRule.model.js'

// What a deleted list or label leaves behind in automation rules. A rule that names it
// can no longer do what its author meant, so it is turned off with the reason shown in
// the rules dialog; saving the rule again clears that.

const turnOff = async (boardId, filter, reason, session) => {
	const { modifiedCount } = await BoardRule.updateMany(
		{ board: boardId, ...filter },
		{ $set: { enabled: false, lastError: reason, nextRunAt: null } },
		{ session },
	)
	return modifiedCount
}

/** Rules that watch the list or move cards to or from it. Returns how many were turned off. */
export const forgetListInRules = (boardId, columnId, session) =>
	turnOff(boardId, { $or: [{ 'trigger.column': columnId }, { 'actions.column': columnId }, { 'actions.from': columnId }] }, 'list_deleted', session)

/** Rules that add or remove the label. */
export const forgetLabelInRules = (boardId, name, session) =>
	turnOff(boardId, { $or: [{ 'actions.label': name }, { 'actions.labels': name }] }, 'label_deleted', session)
