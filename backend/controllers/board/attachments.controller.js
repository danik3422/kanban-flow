import { deleteImage, saveImage } from '../../services/fileStorage.service.js'
import TaskActivity from '../../models/taskActivity.model.js'
import { getCardAccess } from '../../services/boardAccess.service.js'
import { emitTask } from '../../services/taskEvents.service.js'
import Task from '../../models/task.model.js'

// Card attachments: links and uploaded images.

const MAX_ATTACHMENTS = 50

const addAttachmentRecord = async (access, userId, attachment) => {
	if (access.task.attachments.length >= MAX_ATTACHMENTS) {
		const error = new Error('A card can have up to 50 attachments')
		error.statusCode = 400
		throw error
	}
	access.task.attachments.push({ ...attachment, addedBy: userId })
	await access.task.save()
	await TaskActivity.create({ task: access.task._id, board: access.board._id, user: userId, type: 'attachment_added', message: attachment.name || attachment.url })
	return emitTask(access.board._id, access.task._id)
}

export const addLinkAttachment = async (req, res) => {
	try {
		const access = await getCardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const task = await addAttachmentRecord(access, req.user._id, { kind: 'link', url: req.body.url, name: req.body.name || '' })
		return res.status(201).json(task)
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
		console.error('Attachment failed:', error)
		return res.status(500).json({ message: 'Could not attach the link' })
	}
}

export const addImageAttachment = async (req, res) => {
	try {
		const access = await getCardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const url = await saveImage({ dataUrl: req.body.image, folder: `cards/${access.task._id}`, maxBytes: 6 * 1024 * 1024 })
		const task = await addAttachmentRecord(access, req.user._id, { kind: 'image', url, name: req.body.name || '' })
		return res.status(201).json(task)
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
		console.error('Image upload failed:', error)
		return res.status(500).json({ message: 'Could not upload the image' })
	}
}

export const deleteAttachment = async (req, res) => {
	try {
		const access = await getCardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const attachment = access.task.attachments.id(req.params.attachmentId)
		if (!attachment) return res.status(404).json({ message: 'Attachment not found' })
		const own = attachment.addedBy?.toString() === req.user._id.toString()
		if (!own && !access.isManager) return res.status(403).json({ message: 'You can remove only what you attached' })
		const removed = attachment.kind === 'image' ? attachment.url : ''
		// A picture shown as the cover goes from the cover too.
		if (removed && access.task.cover?.url === removed) access.task.cover = null
		attachment.deleteOne()
		await access.task.save()
		// The file goes too, unless a copied card still shows it.
		if (removed && !(await Task.exists({ 'attachments.url': removed }))) deleteImage(removed)
		const task = await emitTask(access.board._id, access.task._id)
		return res.status(200).json(task)
	} catch (error) {
		console.error('Attachment removal failed:', error)
		return res.status(500).json({ message: 'Could not remove the attachment' })
	}
}
