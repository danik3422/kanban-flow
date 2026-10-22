import { axiosInstance } from './axios'

const nameFrom = (header, fallback) => {
	const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header || '')?.[1]
	if (encoded) {
		try {
			return decodeURIComponent(encoded)
		} catch {
			// fall through to the plain name
		}
	}
	return /filename="([^"]+)"/i.exec(header || '')?.[1] || fallback
}

/** Downloads a file from the API (cookies and CSRF included) under the name the server gives it. */
export const downloadFromApi = async (path, fallbackName) => {
	// Files are not kept in the offline cache: they are large and always wanted fresh.
	const response = await axiosInstance.get(path, { responseType: 'blob', timeout: 120_000, cache: false })
	const url = URL.createObjectURL(response.data)
	const link = document.createElement('a')
	link.href = url
	link.download = nameFrom(response.headers['content-disposition'], fallbackName)
	document.body.append(link)
	link.click()
	link.remove()
	window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
