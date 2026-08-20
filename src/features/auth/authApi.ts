import type { AuthUser, LoginInput, ProfileAvatar, RegisterInput } from './types'

interface AuthResponse {
  user: AuthUser | null
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers, ...requestOptions } = options ?? {}
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...requestOptions,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(error?.message ?? 'Não foi possível concluir esta ação.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const authApi = {
  async session() {
    return request<AuthResponse>('/api/auth/session')
  },
  async register(input: RegisterInput) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async login(input: LoginInput) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async logout() {
    return request<void>('/api/auth/logout', { method: 'POST' })
  },
  async updateAvatar(avatar: ProfileAvatar | null) {
    return request<AuthResponse>('/api/profile/avatar', {
      method: 'PATCH',
      body: JSON.stringify({ avatar }),
    })
  },
}
