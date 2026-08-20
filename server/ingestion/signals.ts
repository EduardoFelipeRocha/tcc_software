import type { DiscoveryEventKind } from './schemas.ts'
import { normalizeDiscoveryText } from './utils.ts'

interface SignalRule {
  id: string
  kind: DiscoveryEventKind
  pattern: RegExp
}

const signalRules: SignalRule[] = [
  {
    id: 'concurso-cancelado',
    kind: 'cancellation',
    pattern: /\b(?:cancelamento|cancelado|cancelada)\b.{0,100}\bconcurso\b|\bconcurso\b.{0,100}\b(?:cancelamento|cancelado|cancelada)\b/,
  },
  {
    id: 'concurso-suspenso',
    kind: 'suspension',
    pattern: /\b(?:suspensao|suspenso|suspensa)\b.{0,100}\bconcurso\b|\bconcurso\b.{0,100}\b(?:suspensao|suspenso|suspensa)\b/,
  },
  {
    id: 'retificacao-de-concurso',
    kind: 'rectification',
    pattern: /\bretificac(?:ao|oes)\b.{0,140}\b(?:concurso|edital)\b|\b(?:concurso|edital)\b.{0,140}\bretificac(?:ao|oes)\b/,
  },
  {
    id: 'concurso-autorizado',
    kind: 'authorization',
    pattern: /\bautoriza(?:cao|do|da|r)\b.{0,140}\bconcurso\b|\bconcurso\b.{0,140}\bautoriza(?:cao|do|da|r)\b/,
  },
  {
    id: 'banca-organizadora',
    kind: 'organizer',
    pattern: /\b(?:banca|instituicao|empresa)\s+organizadora\b.{0,180}\bconcurso\b|\bconcurso\b.{0,180}\b(?:banca|instituicao|empresa)\s+organizadora\b/,
  },
  {
    id: 'comissao-de-concurso',
    kind: 'committee',
    pattern: /\bcomissao\b.{0,140}\bconcurso\b|\bconcurso\b.{0,140}\bcomissao\b/,
  },
  {
    id: 'inscricoes-de-concurso',
    kind: 'registration',
    pattern: /\b(?:inscricao|inscricoes|reabertura)\b.{0,160}\bconcurso\b|\bconcurso\b.{0,160}\b(?:inscricao|inscricoes|reabertura)\b/,
  },
  {
    id: 'edital-de-abertura',
    kind: 'notice',
    pattern: /\bedital\b.{0,80}\babertura\b.{0,180}\bconcurso\b|\bconcurso\b.{0,180}\bedital\b.{0,80}\babertura\b/,
  },
  {
    id: 'edital-de-concurso',
    kind: 'notice',
    pattern: /\bedital\b.{0,100}\bconcurso\s+publico\b|\bconcurso\s+publico\b.{0,100}\bedital\b/,
  },
  {
    id: 'concurso-publico',
    kind: 'contest_signal',
    pattern: /\bconcurso\s+publico\b/,
  },
]

const kindPriority: DiscoveryEventKind[] = [
  'cancellation',
  'suspension',
  'rectification',
  'authorization',
  'organizer',
  'committee',
  'registration',
  'notice',
  'contest_signal',
]

export const queridoDiarioHighSignalQuery = [
  '"concurso público"',
  '"edital de concurso"',
  '"edital de abertura"',
  '"concurso autorizado"',
  '"autorização de concurso"',
  '"comissão de concurso"',
  '"banca organizadora"',
  '"inscrições do concurso"',
  '"retificação do concurso"',
  '"concurso suspenso"',
  '"concurso cancelado"',
].join(' | ')

export interface DetectedSignals {
  kind: DiscoveryEventKind
  signalIds: string[]
}

export function detectHighSignalTerms(value: string): DetectedSignals | null {
  const normalized = normalizeDiscoveryText(value)
  const matches = signalRules.filter((rule) => rule.pattern.test(normalized))
  if (!matches.length) return null

  const matchedKinds = new Set(matches.map((match) => match.kind))
  const kind = kindPriority.find((candidate) => matchedKinds.has(candidate)) ?? 'contest_signal'
  return {
    kind,
    signalIds: [...new Set(matches.map((match) => match.id))],
  }
}
