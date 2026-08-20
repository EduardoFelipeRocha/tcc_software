import { createContext, useContext } from 'react'
import type { AuthUser, LoginInput, ProfileAvatar, RegisterInput } from './types'

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  register(input: RegisterInput): Promise<AuthUser>
  login(input: LoginInput): Promise<AuthUser>
  updateAvatar(avatar: ProfileAvatar | null): Promise<AuthUser>
  logout(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa ser usado dentro de AuthProvider.')
  return context
}
