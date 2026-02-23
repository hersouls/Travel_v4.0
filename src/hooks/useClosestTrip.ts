// ============================================
// useClosestTrip Hook
// Finds the closest trip to today's date
// Priority: active > nearest future > most recent past
// ============================================

import { useMemo } from 'react'
import { useTrips } from '@/stores/tripStore'
import type { Trip } from '@/types'

export interface ClosestTripResult {
  closestTrip: Trip | null
  closestTripId: number | null
}

export function useClosestTrip(): ClosestTripResult {
  const trips = useTrips()

  return useMemo(() => {
    if (trips.length === 0) {
      return { closestTrip: null, closestTripId: null }
    }

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // 1. Active trips: today is between startDate and endDate (inclusive)
    const activeTrips = trips.filter(
      (t) => t.startDate <= todayStr && t.endDate >= todayStr
    )
    if (activeTrips.length > 0) {
      // Pick the one whose startDate is closest to today
      activeTrips.sort((a, b) => {
        const diffA = Math.abs(new Date(a.startDate).getTime() - today.getTime())
        const diffB = Math.abs(new Date(b.startDate).getTime() - today.getTime())
        return diffA - diffB
      })
      const trip = activeTrips[0]
      return { closestTrip: trip, closestTripId: trip.id ?? null }
    }

    // 2. Nearest future trip (smallest startDate after today)
    const futureTrips = trips
      .filter((t) => t.startDate > todayStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    if (futureTrips.length > 0) {
      const trip = futureTrips[0]
      return { closestTrip: trip, closestTripId: trip.id ?? null }
    }

    // 3. Most recent past trip (largest endDate before today)
    const pastTrips = trips
      .filter((t) => t.endDate < todayStr)
      .sort((a, b) => b.endDate.localeCompare(a.endDate))
    if (pastTrips.length > 0) {
      const trip = pastTrips[0]
      return { closestTrip: trip, closestTripId: trip.id ?? null }
    }

    // Fallback
    const trip = trips[0]
    return { closestTrip: trip, closestTripId: trip.id ?? null }
  }, [trips])
}
