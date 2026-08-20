import { useEffect, useMemo, useState } from 'react'
import { authApi } from './authApi'
import type { AuthUser } from './types'
import { AuthContext, type AuthContextValue } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void authApi
      .session()
      .then((response) => {
        if (active) setUser(response.user)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async register(input) {
        const response = await authApi.register(input)
        if (!response.user) throw new Error('Não foi possível criar a conta.')
        setUser(response.user)
        return response.user
      },
      async login(input) {
        const response = await authApi.login(input)
        if (!response.user) throw new Error('Não foi possível entrar.')
        setUser(response.user)
        return response.user
      },
      async updateAvatar(avatar) {
        const response = await authApi.updateAvatar(avatar)
        if (!response.user) throw new Error('Não foi possível atualizar o avatar.')
        setUser(response.user)
        return response.user
      },
      async logout() {
        await authApi.logout()
        setUser(null)
      },
    }),
    [loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
