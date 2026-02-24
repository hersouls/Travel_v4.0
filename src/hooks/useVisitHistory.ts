// ============================================
// Visit History Hook
// Detects repeat visits to the same location
// across all trips using coordinate proximity
// ============================================

import { db } from '@/services/database'
import { haversineDistance } from '@/utils/distanceCalculation'
import { useEffect, useState } from 'react'

interface PreviousVisit {
  tripId: number
  tripTitle: string
  date: string
}

interface VisitHistoryResult {
  visitCount: number
  previousVisits: PreviousVisit[]
  isLoading: boolean
}

const MATCH_RADIUS_METERS = 100

/**
 * Check if a location has been visited in other trips
 */
export function useVisitHistory(
  lat?: number,
  lng?: number,
  currentTripId?: number,
): VisitHistoryResult {
  const [result, setResult] = useState<VisitHistoryResult>({
    visitCount: 0,
    previousVisits: [],
    isLoading: false,
  })

  useEffect(() => {
    if (!lat || !lng || !currentTripId) return

    let cancelled = false

    async function search() {
      setResult((prev) => ({ ...prev, isLoading: true }))

      try {
        // Get travel logs with coordinates from OTHER trips (indexed + limited)
        const allLogs = await db.travelLogs
          .where('tripId')
          .notEqual(currentTripId!)
          .and((l) => l.latitude != null && l.longitude != null)
          .limit(5000)
          .toArray()

        // Find logs within radius
        const matchingTripIds = new Set<number>()
        for (const log of allLogs) {
          const dist = haversineDistance(lat!, lng!, log.latitude!, log.longitude!)
          if (dist <= MATCH_RADIUS_METERS) {
            matchingTripIds.add(log.tripId)
          }
        }

        if (cancelled || matchingTripIds.size === 0) {
          if (!cancelled) {
            setResult({ visitCount: 1, previousVisits: [], isLoading: false })
          }
          return
        }

        // Get trip details for matched trips
        const visits: PreviousVisit[] = []
        for (const tripId of matchingTripIds) {
          const trip = await db.trips.get(tripId)
          if (trip) {
            visits.push({
              tripId,
              tripTitle: trip.title,
              date: trip.startDate,
            })
          }
        }

        if (!cancelled) {
          setResult({
            visitCount: visits.length + 1, // +1 for current visit
            previousVisits: visits.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            ),
            isLoading: false,
          })
        }
      } catch (err) {
        console.error('[useVisitHistory] Error:', err)
        if (!cancelled) {
          setResult({ visitCount: 0, previousVisits: [], isLoading: false })
        }
      }
    }

    search()
    return () => {
      cancelled = true
    }
  }, [lat, lng, currentTripId])

  return result
}
