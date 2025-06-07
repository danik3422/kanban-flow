import express from 'express'
import {
	getAuthUser,
	googleAuth,
	login,
	logout,
	signup,
} from '../controllers/auth.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

const router = express.Router()

// Public routes
router.post('/signup', signup)
router.post('/login', login)
//Google
router.post('/google', googleAuth)

// Protected routes
router.post('/logout', logout)
router.get('/get-user', authMiddleware, getAuthUser)

export default router
