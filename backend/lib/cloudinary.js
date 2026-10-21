import { v2 as cloudinary } from 'cloudinary'

import { config } from 'dotenv'
config()

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	secure: true,
})

// Card image uploads are offered only when all three credentials are set.
export const uploadsEnabled = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)

export default cloudinary
