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

const loadImage = (file) => new Promise((resolve, reject) => {
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
