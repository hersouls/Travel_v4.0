// ============================================
// Location Clustering Utility
// Groups travel logs by proximity
// ============================================

import type { TravelLog } from '@/types'
import { haversineDistance } from './distanceCalculation'

export interface LogCluster {
  centroid: { lat: number; lng: number }
  placeName: string
  logs: TravelLog[]
  count: number
}

/**
 * Cluster travel logs by geographic proximity
 * Simple distance-based clustering (DBSCAN-like)
 */
export function clusterLogsByLocation(logs: TravelLog[], radiusMeters = 100): LogCluster[] {
  const withCoords = logs.filter((l) => l.latitude != null && l.longitude != null)
  const assigned = new Set<number>()
  const clusters: LogCluster[] = []

  for (const log of withCoords) {
    if (assigned.has(log.id!)) continue

    // Find all unassigned logs within radius
    const clusterLogs: TravelLog[] = [log]
    assigned.add(log.id!)

    for (const other of withCoords) {
      if (assigned.has(other.id!)) continue
      const dist = haversineDistance(
        log.latitude!,
        log.longitude!,
        other.latitude!,
        other.longitude!,
      )
      if (dist <= radiusMeters) {
        clusterLogs.push(other)
        assigned.add(other.id!)
      }
    }

    // Calculate centroid
    const centroid = {
      lat: clusterLogs.reduce((s, l) => s + l.latitude!, 0) / clusterLogs.length,
      lng: clusterLogs.reduce((s, l) => s + l.longitude!, 0) / clusterLogs.length,
    }

    // Pick most frequent placeName or address
    const names = clusterLogs.map((l) => l.placeName || l.address).filter(Boolean) as string[]
    const nameFreq = new Map<string, number>()
    for (const name of names) {
      nameFreq.set(name, (nameFreq.get(name) || 0) + 1)
    }
    let bestName = '알 수 없는 장소'
    let bestCount = 0
    for (const [name, count] of nameFreq) {
      if (count > bestCount) {
        bestName = name
        bestCount = count
      }
    }

    clusters.push({
      centroid,
      placeName: bestName,
      logs: clusterLogs.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
      count: clusterLogs.length,
    })
  }

  return clusters.sort((a, b) => b.count - a.count)
}
