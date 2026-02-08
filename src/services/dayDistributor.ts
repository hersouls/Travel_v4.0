// ============================================
// Day Distributor Service
// 장소를 지리적 클러스터링으로 일별 자동 배분
// ============================================

import type { Plan } from '@/types'

interface Coords {
  lat: number
  lng: number
}

interface ClusteredPlan {
  plan: Plan
  cluster: number
}

// Haversine distance in meters
function haversine(a: Coords, b: Coords): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// Simple k-means clustering
function kMeansClusters(
  points: Array<{ plan: Plan; coords: Coords }>,
  k: number,
  maxIter = 20,
): ClusteredPlan[] {
  if (points.length <= k) {
    return points.map((p, i) => ({ plan: p.plan, cluster: i }))
  }

  // Initialize centroids using first k points spread evenly
  const step = Math.floor(points.length / k)
  let centroids: Coords[] = Array.from({ length: k }, (_, i) => ({
    ...points[Math.min(i * step, points.length - 1)].coords,
  }))

  let assignments = new Array(points.length).fill(0)

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign points to nearest centroid
    const newAssignments = points.map((p) => {
      let minDist = Infinity
      let minIdx = 0
      for (let c = 0; c < centroids.length; c++) {
        const dist = haversine(p.coords, centroids[c])
        if (dist < minDist) {
          minDist = dist
          minIdx = c
        }
      }
      return minIdx
    })

    // Check convergence
    if (newAssignments.every((a, i) => a === assignments[i])) break
    assignments = newAssignments

    // Update centroids
    centroids = centroids.map((_, c) => {
      const members = points.filter((_, i) => assignments[i] === c)
      if (members.length === 0) return centroids[c]
      return {
        lat: members.reduce((s, m) => s + m.coords.lat, 0) / members.length,
        lng: members.reduce((s, m) => s + m.coords.lng, 0) / members.length,
      }
    })
  }

  return points.map((p, i) => ({ plan: p.plan, cluster: assignments[i] }))
}

export interface DayDistribution {
  day: number
  plans: Plan[]
}

export function distributePlansTodays(
  plans: Plan[],
  totalDays: number,
): DayDistribution[] {
  const plansWithCoords = plans.filter(
    (p) => p.latitude != null && p.longitude != null,
  )
  const plansWithoutCoords = plans.filter(
    (p) => p.latitude == null || p.longitude == null,
  )

  if (plansWithCoords.length === 0) {
    // Evenly distribute plans without coords
    const perDay = Math.ceil(plans.length / totalDays)
    return Array.from({ length: totalDays }, (_, i) => ({
      day: i + 1,
      plans: plans.slice(i * perDay, (i + 1) * perDay),
    }))
  }

  const points = plansWithCoords.map((plan) => ({
    plan,
    coords: { lat: plan.latitude!, lng: plan.longitude! },
  }))

  const clustered = kMeansClusters(points, totalDays)

  // Group by cluster
  const groups = new Map<number, Plan[]>()
  for (const { plan, cluster } of clustered) {
    if (!groups.has(cluster)) groups.set(cluster, [])
    groups.get(cluster)!.push(plan)
  }

  // Sort clusters by average latitude (north to south)
  const sortedClusters = [...groups.entries()].sort((a, b) => {
    const avgLatA =
      a[1].reduce((s, p) => s + (p.latitude || 0), 0) / a[1].length
    const avgLatB =
      b[1].reduce((s, p) => s + (p.latitude || 0), 0) / b[1].length
    return avgLatB - avgLatA
  })

  // Within each cluster, sort restaurants near 12:00 and 18:00
  const result: DayDistribution[] = sortedClusters.map(([, clusterPlans], i) => {
    const sorted = [...clusterPlans].sort((a, b) => {
      const timeA = a.startTime || '09:00'
      const timeB = b.startTime || '09:00'
      return timeA.localeCompare(timeB)
    })
    return { day: i + 1, plans: sorted }
  })

  // Distribute plans without coords evenly
  if (plansWithoutCoords.length > 0) {
    let idx = 0
    for (const plan of plansWithoutCoords) {
      if (result[idx]) {
        result[idx].plans.push(plan)
      }
      idx = (idx + 1) % result.length
    }
  }

  // Fill empty days if needed
  while (result.length < totalDays) {
    result.push({ day: result.length + 1, plans: [] })
  }

  return result
}
