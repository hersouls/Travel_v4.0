// ============================================
// Distance Calculation Utilities
// Haversine formula for GPS distance computation
// ============================================

import type { TravelLog, Plan } from '@/types'

const EARTH_RADIUS_M = 6371000

/** Haversine distance between two coordinates in meters */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Calculate total distance for a day (sum of consecutive log distances) */
export function calculateDayDistance(logs: TravelLog[]): number {
  const withCoords = logs
    .filter((l) => l.latitude != null && l.longitude != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  let total = 0
  for (let i = 1; i < withCoords.length; i++) {
    total += haversineDistance(
      withCoords[i - 1].latitude!,
      withCoords[i - 1].longitude!,
      withCoords[i].latitude!,
      withCoords[i].longitude!,
    )
  }
  return total
}

/** Calculate per-day distances and total trip distance */
export function calculateTripDistance(
  logs: TravelLog[],
): {
  totalMeters: number
  dayDistances: Map<number, number>
} {
  const byDay = new Map<number, TravelLog[]>()
  for (const log of logs) {
    const dayLogs = byDay.get(log.day) || []
    dayLogs.push(log)
    byDay.set(log.day, dayLogs)
  }

  const dayDistances = new Map<number, number>()
  let totalMeters = 0

  for (const [day, dayLogs] of byDay) {
    const dist = calculateDayDistance(dayLogs)
    dayDistances.set(day, dist)
    totalMeters += dist
  }

  return { totalMeters, dayDistances }
}

/** Count unique locations (unique coordinates within 50m radius) */
export function countUniqueLocations(logs: TravelLog[]): number {
  const coords: Array<{ lat: number; lng: number }> = []
  for (const log of logs) {
    if (log.latitude == null || log.longitude == null) continue
    const isDuplicate = coords.some(
      (c) => haversineDistance(c.lat, c.lng, log.latitude!, log.longitude!) < 50,
    )
    if (!isDuplicate) {
      coords.push({ lat: log.latitude, lng: log.longitude })
    }
  }
  return coords.length
}

/** Format meters as human-readable distance */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/** Estimate travel time based on distance */
export function estimateTravelTime(meters: number): {
  walkMinutes: number
  driveMinutes: number
} {
  return {
    walkMinutes: Math.round(meters / (5000 / 60)), // 5km/h
    driveMinutes: Math.round(meters / (40000 / 60)), // 40km/h
  }
}

/** Find nearest plan within a maximum distance */
export function findNearestPlan(
  lat: number,
  lng: number,
  plans: Plan[],
  maxDistanceMeters: number = 100,
): Plan | null {
  let nearest: Plan | null = null
  let minDist = maxDistanceMeters

  for (const plan of plans) {
    // 0(적도/본초자오선)은 유효 좌표이므로 truthiness가 아닌 null 검사 (모듈 내 다른 곳과 일관)
    if (plan.latitude == null || plan.longitude == null) continue
    const dist = haversineDistance(lat, lng, plan.latitude, plan.longitude)
    if (dist < minDist) {
      minDist = dist
      nearest = plan
    }
  }

  return nearest
}
