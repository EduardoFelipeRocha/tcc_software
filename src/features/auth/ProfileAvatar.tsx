import { avatarPresets, type PresetDefinition } from './avatarPresets'
import type { AvatarPresetId, ProfileAvatar as ProfileAvatarValue } from './types'

function PresetPortrait({ preset }: { preset: PresetDefinition }) {
  const isWoman = preset.gender === 'mulher'
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <rect width="96" height="96" rx="48" fill={preset.background} />
      <path d="M15 96c2-20 14-31 33-31s31 11 33 31" fill={preset.shirt} />
      {isWoman && <path d="M25 48c0-23 10-34 23-34 15 0 24 12 24 34v25H24z" fill={preset.hair} />}
      {!isWoman && <path d="M29 37c0-15 8-24 20-24 13 0 21 9 21 24-8-5-16-8-26-7-5 1-10 3-15 7z" fill={preset.hair} />}
      <ellipse cx="48" cy="43" rx="18" ry="22" fill={preset.skin} />
      {isWoman && <path d="M27 43c0-18 8-29 21-29 14 0 22 11 22 29-5-3-9-8-12-15-7 7-16 11-31 12z" fill={preset.hair} />}
      {!isWoman && <path d="M30 34c2-14 9-21 19-21 11 0 19 8 20 22-10-5-25-7-39-1z" fill={preset.hair} />}
      <circle cx="41" cy="44" r="1.5" fill="#27343a" />
      <circle cx="55" cy="44" r="1.5" fill="#27343a" />
      <path d="M43 54c3 2 7 2 10 0" fill="none" stroke="#8c5048" strokeLinecap="round" strokeWidth="1.5" />
      <path d="M39 65h18l-2 9H41z" fill={preset.skin} />
    </svg>
  )
}

interface ProfileAvatarProps {
  avatar: ProfileAvatarValue | null | undefined
  name: string
  className?: string
}

export function ProfileAvatar({ avatar, name, className = '' }: ProfileAvatarProps) {
  if (avatar?.type === 'upload') {
    return <img className={`profile-avatar-image ${className}`.trim()} src={avatar.dataUrl} alt={`Foto de perfil de ${name}`} />
  }

  if (avatar?.type === 'preset') {
    const preset = avatarPresets.find((candidate) => candidate.id === avatar.preset)
    if (preset) {
      return (
        <span className={`profile-avatar-image profile-avatar-preset ${className}`.trim()} role="img" aria-label={`Avatar de ${name}`}>
          <PresetPortrait preset={preset} />
        </span>
      )
    }
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('pt-BR'))
    .join('') || '?'
  return <span className={`profile-avatar-image profile-avatar-fallback ${className}`.trim()} role="img" aria-label={`Iniciais de ${name}`}>{initials}</span>
}

export function AvatarPresetPreview({ presetId }: { presetId: AvatarPresetId }) {
  const preset = avatarPresets.find((candidate) => candidate.id === presetId)!
  return <PresetPortrait preset={preset} />
}
