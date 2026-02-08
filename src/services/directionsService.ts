// ============================================
// Directions Service - Route Fetching & Caching
// ============================================

import type { RouteSegment, TravelMode, Plan } from '@/types'
import {
  getRouteSegment,
  upsertRouteSegment,
  deleteRouteSegmentsForTrip,
} from '@/services/database'

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface DirectionsApiResponse {
  distanceMeters: number
  duration: string
  durationText: string
  distanceText: string
  encodedPolyline: string
  steps: Array<{
    instruction: string
    distance: string
    duration: string
  }>
}

function isCacheValid(cachedAt: Date): boolean {
  const age = Date.now() - new Date(cachedAt).getTime()
  return age < CACHE_MAX_AGE_MS
}

export async function fetchDirections(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  travelMode: TravelMode,
  tripId: number,
  fromPlanId: number,
  toPlanId: number,
): Promise<RouteSegment> {
  // Check cache first
  const cached = await getRouteSegment(fromPlanId, toPlanId)
  if (
    cached &&
    cached.travelMode === travelMode &&
    cached.cachedAt &&
    isCacheValid(cached.cachedAt)
  ) {
    return cached
  }

  // Fetch from API
  const response = await fetch('/api/routes/directions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: from,
      destination: to,
      travelMode,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Directions API error: ${response.status}`)
  }

  const data: DirectionsApiResponse = await response.json()

  const now = new Date()
  const segment: Omit<RouteSegment, 'id'> = {
    tripId,
    fromPlanId,
    toPlanId,
    fromCoords: from,
    toCoords: to,
    travelMode,
    distanceMeters: data.distanceMeters,
    duration: data.duration,
    durationText: data.durationText,
    distanceText: data.distanceText,
    encodedPolyline: data.encodedPolyline,
    steps: data.steps.map((step) => ({
      instruction: step.instruction,
      distanceMeters: 0,
      duration: '',
      startLocation: { lat: 0, lng: 0 },
      endLocation: { lat: 0, lng: 0 },
      travelMode: travelMode,
      polyline: '',
    })),
    cachedAt: now,
    updatedAt: now,
  }

  // Cache in IndexedDB
  const id = await upsertRouteSegment(segment)

  return { ...segment, id }
}

export async function fetchDirectionsForTrip(
  tripId: number,
  plans: Array<{ id: number; latitude?: number; longitude?: number }>,
  travelMode: TravelMode,
): Promise<RouteSegment[]> {
  // Filter plans that have valid coordinates
  const plansWithCoords = plans.filter(
    (p): p is { id: number; latitude: number; longitude: number } =>
      typeof p.latitude === 'number' &&
      typeof p.longitude === 'number' &&
      !isNaN(p.latitude) &&
      !isNaN(p.longitude),
  )

  if (plansWithCoords.length < 2) {
    return []
  }

  const segments: RouteSegment[] = []

  // Fetch directions for each consecutive pair
  for (let i = 0; i < plansWithCoords.length - 1; i++) {
    const fromPlan = plansWithCoords[i]
    const toPlan = plansWithCoords[i + 1]

    try {
      // Check cache first
      const cached = await getRouteSegment(fromPlan.id, toPlan.id)
      if (
        cached &&
        cached.travelMode === travelMode &&
        cached.cachedAt &&
        isCacheValid(cached.cachedAt)
      ) {
        segments.push(cached)
        continue
      }

      const segment = await fetchDirections(
        { lat: fromPlan.latitude, lng: fromPlan.longitude },
        { lat: toPlan.latitude, lng: toPlan.longitude },
        travelMode,
        tripId,
        fromPlan.id,
        toPlan.id,
      )

      segments.push(segment)
    } catch (err) {
      console.warn(
        `[Directions] Failed to fetch route from plan ${fromPlan.id} to ${toPlan.id}:`,
        err,
      )
      // Continue with remaining pairs even if one fails
    }
  }

  return segments
}

export async function invalidateRouteCache(tripId: number): Promise<void> {
  await deleteRouteSegmentsForTrip(tripId)
}
