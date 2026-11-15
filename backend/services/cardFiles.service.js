import Task from '../models/task.model.js'
import { deleteImage } from './fileStorage.service.js'

// Uploaded card images live on disk (or in Cloudinary) apart from the cards. When cards
// go for good, their pictures go too, unless a copied card still shows the same file.

/** Image attachment URLs of the cards matching the filter, archived ones included. */
export const cardImageUrls = async (filter) => {
	const tasks = await Task.find(filter).setOptions({ withArchived: true }).select('attachments').lean()
	return [...new Set(tasks.flatMap((task) => (task.attachments || []).filter((item) => item.kind === 'image' && item.url).map((item) => item.url)))]
}

/** Deletes each file no remaining card uses. Call after the cards are deleted; never fails. */
export const releaseCardImages = async (urls) => {
	for (const url of urls) {
		try {
			if (await Task.exists({ 'attachments.url': url }).setOptions({ withArchived: true })) continue
			await deleteImage(url)
		} catch (error) {
			console.error('Card image cleanup failed:', error?.message || error)
		}
	}
}
