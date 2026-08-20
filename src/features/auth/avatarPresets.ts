import type { AvatarPresetId } from './types'

export interface PresetDefinition {
  id: AvatarPresetId
  label: string
  gender: 'homem' | 'mulher'
  background: string
  shirt: string
  skin: string
  hair: string
}

export const avatarPresets: PresetDefinition[] = [
  { id: 'homem-verde', label: 'Homem — verde', gender: 'homem', background: '#d9efe8', shirt: '#08735f', skin: '#d89b72', hair: '#3a2a24' },
  { id: 'homem-azul', label: 'Homem — azul', gender: 'homem', background: '#dcebf5', shirt: '#285f8f', skin: '#8f5b3e', hair: '#171b20' },
  { id: 'homem-ambar', label: 'Homem — âmbar', gender: 'homem', background: '#faedce', shirt: '#a76118', skin: '#efbd91', hair: '#6a432d' },
  { id: 'mulher-verde', label: 'Mulher — verde', gender: 'mulher', background: '#d9efe8', shirt: '#08735f', skin: '#c9865f', hair: '#29201d' },
  { id: 'mulher-violeta', label: 'Mulher — violeta', gender: 'mulher', background: '#ebe4f6', shirt: '#7156a5', skin: '#74452f', hair: '#161318' },
  { id: 'mulher-coral', label: 'Mulher — coral', gender: 'mulher', background: '#fae2df', shirt: '#a94f55', skin: '#f0b789', hair: '#70452d' },
]
