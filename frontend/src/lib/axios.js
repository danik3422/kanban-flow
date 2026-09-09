import axios from 'axios'
import { apiBaseUrl } from './runtimeConfig'

export const axiosInstance = axios.create({
	baseURL: apiBaseUrl,
	withCredentials: true,
	timeout: 8000,
})
