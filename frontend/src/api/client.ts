import axios from 'axios'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'

export const client = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// Attach JWT from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hj_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear credentials and redirect to auth page
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hj_token')
      localStorage.removeItem('hj_member')
      window.location.href = '/auth'
    }
    return Promise.reject(err)
  }
)
