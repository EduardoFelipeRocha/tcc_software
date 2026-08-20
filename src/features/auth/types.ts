export const avatarPresetIds = [
  'homem-verde',
  'homem-azul',
  'homem-ambar',
  'mulher-verde',
  'mulher-violeta',
  'mulher-coral',
] as const

export type AvatarPresetId = (typeof avatarPresetIds)[number]

export type ProfileAvatar =
  | { type: 'preset'; preset: AvatarPresetId }
  | { type: 'upload'; dataUrl: string }

export interface AuthUser {
  id: string
  name: string
  email: string
  createdAt: string
  avatar: ProfileAvatar | null
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}
