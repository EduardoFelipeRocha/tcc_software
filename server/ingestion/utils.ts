import { createHash } from 'node:crypto'

export function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function serializeForHash(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return JSON.stringify(value.toString())
    return JSON.stringify(value) ?? String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(serializeForHash).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serializeForHash(record[key])}`)
  return `{${entries.join(',')}}`
}

export function boundedPreview(value: unknown, maximumLength = 500) {
  let serialized: string
  try {
    serialized = serializeForHash(value)
  } catch {
    serialized = String(value)
  }
  return serialized.slice(0, maximumLength)
}

export function normalizeDiscoveryText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

export function plainText(value: string, maximumLength: number) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)
}
