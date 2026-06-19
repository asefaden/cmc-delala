import { createContext, useContext, useState, useEffect } from 'react'
import { apiRequest, fetchConfig } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      await fetchConfig()
      await checkSession()
      setLoading(false)
    }
    init()
  }, [])

  async function checkSession() {
    try {
      const data = await apiRequest('/api/auth/profile', { suppressLog: true })
      setUser(data)
    } catch {
      setUser(null)
    }
  }

  async function login(email, password) {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(res.user)
    return res
  }

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  async function register(data) {
    return await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, register, checkSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}