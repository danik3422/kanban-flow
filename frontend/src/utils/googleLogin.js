import { axiosInstance } from '../lib/axios'

export const googleLogin = async (idToken) => {
	try {
		const response = await axiosInstance.post('/auth/google', {
			idToken,
		})
		return response.data
	} catch (error) {
		console.error('Google login error:', error.response?.data || error.message)
		throw error
	}
}
