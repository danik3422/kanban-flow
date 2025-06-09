import express from 'express'
import {
	getAuthUser,
	googleSignin,
	googleSignup,
	login,
	logout,
	setupProfile,
	signup,
} from '../controllers/auth.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

const router = express.Router()

// Public routes
router.post('/signup', signup)
router.post('/login', login)
//Google
router.post('/google/signup', googleSignup)
router.post('/google/login', googleSignin)

// Protected routes
router.post('/logout', logout)
router.get('/get-user', authMiddleware, getAuthUser)
router.patch('/setup-profile', authMiddleware, setupProfile)

export default router
