import type { StoredStudyPlan } from './types'

const PLAN_KEY = 'rumo.study-plan.v1'
const COMPLETED_KEY = 'rumo.completed-sessions.v1'

export function savePlan(plan: StoredStudyPlan) {
  window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan))
  window.localStorage.removeItem(COMPLETED_KEY)
}

export function loadPlan(): StoredStudyPlan | null {
  try {
    const rawPlan = window.localStorage.getItem(PLAN_KEY)
    if (!rawPlan) return null

    const parsed = JSON.parse(rawPlan) as StoredStudyPlan
    return parsed.version === 1 ? parsed : null
  } catch {
    return null
  }
}

export function loadCompletedSessions(): string[] {
  try {
    const rawCompleted = window.localStorage.getItem(COMPLETED_KEY)
    return rawCompleted ? (JSON.parse(rawCompleted) as string[]) : []
  } catch {
    return []
  }
}

export function saveCompletedSessions(sessionIds: string[]) {
  window.localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessionIds))
}
