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
}) => {
	const activity = await BoardActivity.create({
		board: boardId,
		user: userId,
		action,
		entityType,
		entityId,
		entityName,
		details,
	})
	const populatedActivity = await activity.populate('user', 'name email avatar')
	const activityData = populatedActivity.toObject()
	emitBoardEvent(boardId.toString(), 'activity:new', activityData)
	return activityData
}