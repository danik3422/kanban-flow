import { emitBoardEvent } from './realtime.js'
import BoardActivity from '../models/boardActivity.model.js'

export const recordBoardActivity = async ({
	boardId,
	userId,
	action,
	entityType,
	entityId = null,
	entityName = '',
	details = '',
	session = null,
	emit = true,
}) => {
	const [activity] = await BoardActivity.create([{
		board: boardId,
		user: userId,
		action,
		entityType,
		entityId,
		entityName,
		details,
	}], session ? { session } : undefined)
	const populatedActivity = await activity.populate('user', 'name email avatar')
	const activityData = populatedActivity.toObject()
	if (emit) emitBoardEvent(boardId.toString(), 'activity:new', activityData)
	return activityData
}