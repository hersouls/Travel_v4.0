// ============================================
// Time Conflict Detection
// ============================================

import type { Plan } from '@/types'

interface TimeRange {
  start: number // minutes since midnight
  end: number
  planId?: number
  placeName: string
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTimeRange(plan: Plan): TimeRange {
  const start = timeToMinutes(plan.startTime)
  const end = plan.endTime ? timeToMinutes(plan.endTime) : start + 60 // default 60min
  return { start, end, planId: plan.id, placeName: plan.placeName }
}

function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end
}

export interface TimeConflict {
  planA: { id?: number; placeName: string; startTime: string; endTime: string }
  planB: { id?: number; placeName: string; startTime: string; endTime: string }
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function detectTimeConflicts(plans: Plan[]): TimeConflict[] {
  const conflicts: TimeConflict[] = []
  const ranges = plans.map((p) => ({ ...toTimeRange(p), plan: p }))

  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) {
        conflicts.push({
          planA: {
            id: ranges[i].planId,
            placeName: ranges[i].placeName,
            startTime: ranges[i].plan.startTime,
            endTime: ranges[i].plan.endTime || minutesToTime(ranges[i].end),
          },
          planB: {
            id: ranges[j].planId,
            placeName: ranges[j].placeName,
            startTime: ranges[j].plan.startTime,
            endTime: ranges[j].plan.endTime || minutesToTime(ranges[j].end),
          },
        })
      }
    }
  }

  return conflicts
}

export function checkPlanConflict(
  newPlan: { startTime: string; endTime?: string; placeName: string; id?: number },
  existingPlans: Plan[]
): TimeConflict | null {
  const newRange: TimeRange = {
    start: timeToMinutes(newPlan.startTime),
    end: newPlan.endTime ? timeToMinutes(newPlan.endTime) : timeToMinutes(newPlan.startTime) + 60,
    planId: newPlan.id,
    placeName: newPlan.placeName,
  }

  for (const plan of existingPlans) {
    if (plan.id === newPlan.id) continue // skip self
    const existing = toTimeRange(plan)
    if (rangesOverlap(newRange, existing)) {
      return {
        planA: {
          id: newPlan.id,
          placeName: newPlan.placeName,
          startTime: newPlan.startTime,
          endTime: newPlan.endTime || minutesToTime(newRange.end),
        },
        planB: {
          id: plan.id,
          placeName: plan.placeName,
          startTime: plan.startTime,
          endTime: plan.endTime || minutesToTime(existing.end),
        },
      }
    }
  }

  return null
}
