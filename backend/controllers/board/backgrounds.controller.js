import { emitBoardEvent } from '../../lib/realtime.js'
import BoardMember from '../../models/boardMember.model.js'
import { normalizeAdjust, releaseUploadedBackground, searchBackgroundPhotos } from '../../services/boardBackgrounds.service.js'
import { saveImage } from '../../services/fileStorage.service.js'

// Background photo search and people's own background photos.

export const getBackgroundPhotos = async (req, res) => {
	try {
		return res.status(200).json(await searchBackgroundPhotos({ query: req.query.query, page: req.query.page }))
	} catch (error) {
		console.error('Background photo search failed:', error)
		return res.status(500).json({ message: 'Could not load photos' })
	}
}

/**
 * Sets a photo of your own as the board's background. The browser sends it already
 * resized (up to 2560px) with a small copy for tiles and lists, and how to show it
 * when it was chosen together with a new board.
 */
export const uploadBoardBackground = async (req, res) => {
	try {
		const board = req.board
		const isOwner = board.createdBy.toString() === req.user._id.toString()
		if (!isOwner && !(await BoardMember.exists({ board: board._id, user: req.user._id, role: 'admin' }))) {
			return res.status(403).json({ message: 'Only the board owner or admin can change the background' })
		}
		const folder = `backgrounds/${board._id}`
		const url = await saveImage({ dataUrl: req.body.image, folder, maxBytes: 5 * 1024 * 1024, cloudinaryOptions: { quality: 'auto', fetch_format: 'auto' } })
		const thumb = await saveImage({ dataUrl: req.body.thumb, folder, maxBytes: 300 * 1024 })
		const previous = board.background ? board.background.toObject?.() || board.background : null
		const adjust = normalizeAdjust(req.body.adjust)
		board.background = { type: 'upload', url, thumb, color: req.body.color || '#5b6470', ...(adjust ? { adjust } : {}) }
		await board.save()
		emitBoardEvent(board._id.toString(), 'board:updated', board.toObject())
		releaseUploadedBackground(previous)
		return res.status(200).json(board)
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
		console.error('Background upload failed:', error)
		return res.status(500).json({ message: 'Could not upload the photo' })
	}
}
