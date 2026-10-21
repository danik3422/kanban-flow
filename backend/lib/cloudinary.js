import { v2 as cloudinary } from 'cloudinary'

import '../config/env.js'

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	secure: true,
})

// Cloudinary stores uploads when all three credentials are set; otherwise
// services/fileStorage.service.js keeps them on this server.
export const cloudinaryEnabled = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)

// Uploads always work now: in the cloud or on this server's disk.
export const uploadsEnabled = () => true

export default cloudinary
