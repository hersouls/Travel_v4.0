// ============================================
// Route Optimizer Service
// ============================================

import type { Plan, TravelMode } from '@/types'

export interface OptimizeResult {
  optimizedOrder: number[] // plan IDs in optimized order
  legs: Array<{
    distanceMeters: number
    duration: string
    durationText: string
    distanceText: string
    encodedPolyline: string
  }>
  totalDistanceMeters: number
  totalDurationText: string
}

export async function optimizeRoute(
  plans: Plan[],
  travelMode: TravelMode = 'DRIVE',
): Promise<OptimizeResult> {
  const plansWithCoords = plans.filter(
    (p) => p.latitude != null && p.longitude != null,
  )

  if (plansWithCoords.length < 3) {
    throw new Error('경로 최적화에는 최소 3개의 장소가 필요합니다')
  }

  const waypoints = plansWithCoords.map((p) => ({
    lat: p.latitude!,
    lng: p.longitude!,
    planId: p.id!,
  }))

  const res = await fetch('/api/routes/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ waypoints, travelMode }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || '경로 최적화에 실패했습니다')
  }

  const data = await res.json()

  const totalDistanceMeters = (data.legs || []).reduce(
    (sum: number, leg: { distanceMeters: number }) => sum + leg.distanceMeters,
    0,
  )

  const totalSeconds = (data.legs || []).reduce(
    (sum: number, leg: { duration: string }) => {
      const s = parseInt(leg.duration?.replace('s', '') || '0', 10)
      return sum + s
    },
    0,
  )

  const totalMinutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const totalDurationText = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`

  return {
    optimizedOrder: data.optimizedOrder || [],
    legs: data.legs || [],
    totalDistanceMeters,
    totalDurationText,
  }
}
