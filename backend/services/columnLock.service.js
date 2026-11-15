import Column from '../models/column.model.js'

/**
 * Inside a transaction, writes to the given lists' own documents so that two requests
 * changing cards of the same list at once conflict: MongoDB then retries the later one
 * against the committed result instead of both counting the same positions.
 * Card positions are counted from other documents, which a transaction alone does not guard.
 */
export const lockColumns = async (columnIds, session) => {
	const ids = [...new Set(columnIds.filter(Boolean).map((id) => id.toString()))].sort()
	for (const id of ids) {
		await Column.updateOne({ _id: id }, { $set: { updatedAt: new Date() } }, { session, timestamps: false })
			.setOptions({ withArchived: true })
	}
}
