const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const MAX_OUTPUT_BYTES = 70 * 1024
const MAX_DIMENSION = 512
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const COMPRESSION_STEPS = [
	{ dimension: 512, quality: 0.82 },
	{ dimension: 448, quality: 0.74 },
	{ dimension: 384, quality: 0.64 },
	{ dimension: 320, quality: 0.54 },
]

const dataUrlBytes = (dataUrl) => {
	const base64 = dataUrl.split(',')[1] || ''
	return Math.ceil((base64.length * 3) / 4)
}

export const loadImage = (file) => new Promise((resolve, reject) => {
	const objectUrl = URL.createObjectURL(file)
	const image = new Image()
	image.onload = () => {
		URL.revokeObjectURL(objectUrl)
		resolve(image)
	}
	image.onerror = () => {
		URL.revokeObjectURL(objectUrl)
		reject(new Error('Could not read this image'))
	}
	image.src = objectUrl
})

export const prepareAvatar = async (file) => {
	if (!file || !SUPPORTED_TYPES.has(file.type)) {
		throw new Error('Choose a JPG, PNG, or WebP image')
	}
	if (file.size > MAX_SOURCE_BYTES) {
		throw new Error('Image must be 5 MB or smaller')
	}

	const image = await loadImage(file)
	for (const { dimension, quality } of COMPRESSION_STEPS) {
		const scale = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight))
		const canvas = document.createElement('canvas')
		canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
		canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
		const context = canvas.getContext('2d')
		if (!context) throw new Error('Could not process this image')
		context.drawImage(image, 0, 0, canvas.width, canvas.height)

		const dataUrl = canvas.toDataURL('image/webp', quality)
		if (dataUrlBytes(dataUrl) <= MAX_OUTPUT_BYTES) return dataUrl
	}
	throw new Error('Image is too detailed. Choose a simpler image')
}

export const MAX_EDITOR_SOURCE_BYTES = 10 * 1024 * 1024
export const isSupportedImage = (file) => Boolean(file) && SUPPORTED_TYPES.has(file.type) && file.size <= MAX_EDITOR_SOURCE_BYTES

// The image's size once turned by `rotation` degrees (a multiple of 90).
export const rotatedSize = (image, rotation) => (rotation % 180 === 0
	? { width: image.naturalWidth, height: image.naturalHeight }
	: { width: image.naturalHeight, height: image.naturalWidth })

// The scale at which the image just covers a square of `viewport` pixels.
export const coverScale = (image, rotation, viewport) => {
	const { width, height } = rotatedSize(image, rotation)
	return viewport / Math.min(width, height)
}

/**
 * Draws what the round frame shows — the image at `zoom`, turned by `rotation`
 * and moved by `offset` (in frame pixels) — into a square avatar, compressed to
 * what the server accepts.
 */
export const renderAvatarCrop = ({ image, viewport, zoom, rotation, offset }) => {
	const scale = coverScale(image, rotation, viewport) * zoom
	for (const { dimension, quality } of COMPRESSION_STEPS) {
		const canvas = document.createElement('canvas')
		canvas.width = dimension
		canvas.height = dimension
		const context = canvas.getContext('2d')
		if (!context) throw new Error('Could not process this image')
		const ratio = dimension / viewport
		context.fillStyle = '#ffffff'
		context.fillRect(0, 0, dimension, dimension)
		context.imageSmoothingQuality = 'high'
		context.translate(dimension / 2 + offset.x * ratio, dimension / 2 + offset.y * ratio)
		context.rotate((rotation * Math.PI) / 180)
		context.scale(scale * ratio, scale * ratio)
		context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
		const dataUrl = canvas.toDataURL('image/webp', quality)
		if (dataUrl.startsWith('data:image/webp') && dataUrlBytes(dataUrl) <= MAX_OUTPUT_BYTES) return dataUrl
		// Browsers without WebP encoding fall back to JPEG.
		const jpeg = canvas.toDataURL('image/jpeg', quality)
		if (dataUrlBytes(jpeg) <= MAX_OUTPUT_BYTES) return jpeg
	}
	throw new Error('Image is too detailed. Choose a simpler image')
}
