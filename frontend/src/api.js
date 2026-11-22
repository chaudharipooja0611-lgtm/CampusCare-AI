import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('cc_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('cc_token')
      const p = window.location.pathname
      if (!['/', '/login', '/register'].includes(p) && !p.startsWith('/track')) window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const errMsg = (e) => {
  if (e?.response?.data?.error) return e.response.data.error
  if (e?.response?.status === 429) return 'Too many requests. Please wait a moment.'
  if (e?.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
  if (e?.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the backend running?'
  return e?.message || 'Something went wrong'
}
export const fileUrl = (name) => (name ? `/api/uploads/${name}` : null)

/** Downloads a CSV (or any file) from an authenticated endpoint. Returns the number of rows when the server reports it. */
export async function download(url, params) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(res.data)
  a.download = match ? match[1] : 'export.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  return Number(res.headers['x-row-count'] ?? 0)
}
export default api
