import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api from '../api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!localStorage.getItem('cc_token'))

  useEffect(() => {
    if (!localStorage.getItem('cc_token')) return
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => localStorage.removeItem('cc_token')).finally(() => setLoading(false))
  }, [])

  const authenticate = useCallback(async (path, payload) => {
    const { data } = await api.post(path, payload)
    localStorage.setItem('cc_token', data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('cc_token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login: (p) => authenticate('/auth/login', p), register: (p) => authenticate('/auth/register', p), logout }}>
      {children}
    </AuthContext.Provider>
  )
}
