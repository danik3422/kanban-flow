// A photo of your own, made ready for upload in the browser: the board size (up to
// 2560px on the long side) and a small copy for tiles, both WebP (JPEG where WebP
// can't be written), plus its average colour for placeholders.

const MAX_SOURCE_BYTES = 25 * 1024 * 1024
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024
const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const fail = (code) => Object.assign(new Error(code), { code })

const loadImage = (file) => new Promise((resolve, reject) => {
	const url = URL.createObjectURL(file)
	const image = new Image()
	image.onload = () => {
		URL.revokeObjectURL(url)
		resolve(image)
	}
	image.onerror = () => {
		URL.revokeObjectURL(url)
		reject(fail('unreadable'))
	}
	image.src = url
})

const bytesOf = (dataUrl) => Math.ceil(((dataUrl.split(',')[1] || '').length * 3) / 4)

const draw = (image, longSide) => {
	const scale = Math.min(1, longSide / Math.max(image.naturalWidth, image.naturalHeight))
	const canvas = document.createElement('canvas')
	canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
	canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
	const context = canvas.getContext('2d')
	if (!context) throw fail('unreadable')
	context.imageSmoothingQuality = 'high'
	context.drawImage(image, 0, 0, canvas.width, canvas.height)
	return canvas
}

const encode = (canvas, quality) => {
	const webp = canvas.toDataURL('image/webp', quality)
	return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
}

const averageColor = (image) => {
	const canvas = draw(image, 16)
	const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
	let red = 0
	let green = 0
	let blue = 0
	const pixels = data.length / 4
	for (let index = 0; index < data.length; index += 4) {
		red += data[index]
		green += data[index + 1]
		blue += data[index + 2]
	}
	const hex = (value) => Math.round(value / pixels).toString(16).padStart(2, '0')
	return `#${hex(red)}${hex(green)}${hex(blue)}`
}

/** { image, thumb, color } ready for POST /board/boards/:id/background/upload; throws { code }. */
export const prepareBackgroundImage = async (file) => {
	if (!file || !SUPPORTED.has(file.type)) throw fail('type')
	if (file.size > MAX_SOURCE_BYTES) throw fail('size')
	const image = await loadImage(file)
	let full = null
	for (const [longSide, quality] of [[2560, 0.86], [2560, 0.76], [2048, 0.74], [1600, 0.7]]) {
		full = encode(draw(image, longSide), quality)
		if (bytesOf(full) <= MAX_UPLOAD_BYTES) break
		full = null
	}
	if (!full) throw fail('size')
	return { image: full, thumb: encode(draw(image, 480), 0.78), color: averageColor(image) }
}
