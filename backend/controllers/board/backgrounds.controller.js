import { searchBackgroundPhotos } from '../../services/boardBackgrounds.service.js'

// Background photo search for the board background picker.

export const getBackgroundPhotos = async (req, res) => {
	try {
		return res.status(200).json(await searchBackgroundPhotos({ query: req.query.query, page: req.query.page }))
	} catch (error) {
		console.error('Background photo search failed:', error)
		return res.status(500).json({ message: 'Could not load photos' })
	}
}
