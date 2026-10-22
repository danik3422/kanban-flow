import mongoose from 'mongoose'

// Archived cards and lists stay in the database but out of sight: every read skips them
// unless the query asks for them with `.setOptions({ withArchived: true })` or names
// `archivedAt` itself. Updates and deletes are not filtered, so cleanup reaches them too.
const READS = ['find', 'findOne', 'countDocuments', 'distinct', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace']

export const archivable = (schema) => {
	schema.add({
		archivedAt: { type: Date, default: null },
		archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
	})
	function hideArchived() {
		if (this.getOptions().withArchived || 'archivedAt' in this.getFilter()) return
		this.where({ archivedAt: null })
	}
	for (const operation of READS) schema.pre(operation, hideArchived)
	schema.pre('aggregate', function hideArchivedInAggregate() {
		if (this.options.withArchived) return
		this.pipeline().unshift({ $match: { archivedAt: null } })
	})
}
