import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { env } from '../config/env.js'
import cloudinary, { cloudinaryEnabled } from '../lib/cloudinary.js'

// Pictures people upload: avatars, card images and board backgrounds. Cloudinary when it
// is configured (hosted version), otherwise files in env.uploadsDir served at /uploads
// (self-hosting, also without internet). Stored URLs are either Cloudinary https URLs
// or "/uploads/…" paths on this server.

export const LOCAL_PREFIX = '/uploads/'
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/

const invalid = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

/** The image inside a data: URL, or an error the client can show. */
export const decodeImage = (dataUrl, maxBytes) => {
	const match = DATA_URL.exec(String(dataUrl || ''))
	if (!match) throw invalid('Choose a JPG, PNG, WebP or GIF image.')
	const bytes = Buffer.from(match[2], 'base64')
	if (maxBytes && bytes.byteLength > maxBytes) throw invalid('The image is too large.', 413)
	return { type: match[1], bytes }
}

// Folder names come from our own code (ids), never from the request.
const safeSegment = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '')

/**
 * Stores an image and returns its URL. `folder` like "backgrounds/<boardId>";
 * `name` keeps one file per thing (an avatar), otherwise each upload gets its own.
 */
export const saveImage = async ({ dataUrl, folder, name, maxBytes, cloudinaryOptions = {} }) => {
	const { type, bytes } = decodeImage(dataUrl, maxBytes)
	if (cloudinaryEnabled()) {
		const upload = await cloudinary.uploader.upload(dataUrl, {
			folder,
			...(name ? { public_id: name, overwrite: true } : {}),
			resource_type: 'image',
			...cloudinaryOptions,
		})
		return upload.secure_url
	}
	const dir = path.join(env.uploadsDir, ...folder.split('/').map(safeSegment))
	await fs.mkdir(dir, { recursive: true })
	// A fresh name each time, so browsers and the service worker never show an old picture.
	const file = `${name ? `${safeSegment(name)}-` : ''}${crypto.randomBytes(8).toString('hex')}.${TYPES[type]}`
	await fs.writeFile(path.join(dir, file), bytes)
	return `${LOCAL_PREFIX}${folder.split('/').map(safeSegment).join('/')}/${file}`
}

/** True when the URL is one this server handed out for that folder. */
export const isStoredImage = (url, folder) => {
	const value = String(url || '')
	const local = `${LOCAL_PREFIX}${folder.split('/').map(safeSegment).join('/')}/`
	if (value.startsWith(local)) return /^[a-zA-Z0-9_-]+\.(jpg|png|webp|gif)$/.test(value.slice(local.length))
	const cloud = process.env.CLOUDINARY_CLOUD_NAME
	if (!cloud) return false
	try {
		const parsed = new URL(value)
		return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.startsWith(`/${cloud}/image/upload/`) && parsed.pathname.includes(`/${folder}/`)
	} catch {
		return false
	}
}

/** Removes a stored image; never fails the caller. */
export const deleteImage = async (url) => {
	try {
		const value = String(url || '')
		if (value.startsWith(LOCAL_PREFIX)) {
			const target = path.resolve(env.uploadsDir, value.slice(LOCAL_PREFIX.length))
			if (target.startsWith(env.uploadsDir + path.sep)) await fs.rm(target, { force: true })
			return
		}
		if (!cloudinaryEnabled() || !value.includes('res.cloudinary.com')) return
		// ".../image/upload/v123/folder/name.jpg" → "folder/name"
		const publicId = value.split('/image/upload/')[1]?.replace(/^v\d+\//, '').replace(/\.[a-z0-9]+$/i, '')
		if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
	} catch (error) {
		console.error('Image cleanup failed:', error?.message || error)
	}
}
