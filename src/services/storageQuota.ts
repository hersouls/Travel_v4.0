// ============================================
// Storage Quota Management Service
// Monitor and manage browser storage
// ============================================

import { db } from './database'

export type StorageStatus = 'healthy' | 'warning' | 'critical'

export interface StorageInfo {
  used: number
  quota: number
  percentage: number
  status: StorageStatus
  isPersisted: boolean
  breakdown: {
    trips: number
    plans: number
    places: number
    other: number
  }
}

// Thresholds
const WARNING_THRESHOLD = 0.75 // 75%
const CRITICAL_THRESHOLD = 0.9 // 90%

// Soft limits for mobile/desktop
const SOFT_LIMIT_MOBILE = 50 * 1024 * 1024 // 50MB
const SOFT_LIMIT_DESKTOP = 100 * 1024 * 1024 // 100MB

/**
 * Check if device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * Get recommended storage limit for current device
 */
export function getRecommendedLimit(): number {
  return isMobileDevice() ? SOFT_LIMIT_MOBILE : SOFT_LIMIT_DESKTOP
}

/**
 * Get current storage quota and usage
 */
export async function getStorageEstimate(): Promise<{ used: number; quota: number }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { used: 0, quota: 0 }
  }

  try {
    const estimate = await navigator.storage.estimate()
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    }
  } catch {
    console.warn('[StorageQuota] Failed to get storage estimate')
    return { used: 0, quota: 0 }
  }
}

/**
 * Check if storage is persisted (won't be evicted)
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return false
  }

  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false
  }

  try {
    const granted = await navigator.storage.persist()
    if (granted) {
      console.log('[StorageQuota] Persistent storage granted')
    } else {
      console.log('[StorageQuota] Persistent storage denied')
    }
    return granted
  } catch (error) {
    console.warn('[StorageQuota] Failed to request persistent storage:', error)
    return false
  }
}

/**
 * Estimate size of data in IndexedDB tables
 */
async function estimateDataBreakdown(): Promise<StorageInfo['breakdown']> {
  try {
    const [trips, plans, places] = await Promise.all([
      db.trips.toArray(),
      db.plans.toArray(),
      db.places.toArray(),
    ])

    // Rough estimate: JSON stringify each array
    const tripsSize = new Blob([JSON.stringify(trips)]).size
    const plansSize = new Blob([JSON.stringify(plans)]).size
    const placesSize = new Blob([JSON.stringify(places)]).size

    return {
      trips: tripsSize,
      plans: plansSize,
      places: placesSize,
      other: 0,
    }
  } catch {
    return { trips: 0, plans: 0, places: 0, other: 0 }
  }
}

/**
 * Get storage status based on usage percentage
 */
function getStorageStatus(percentage: number): StorageStatus {
  if (percentage >= CRITICAL_THRESHOLD) return 'critical'
  if (percentage >= WARNING_THRESHOLD) return 'warning'
  return 'healthy'
}

/**
 * Get comprehensive storage information
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  const [estimate, isPersisted, breakdown] = await Promise.all([
    getStorageEstimate(),
    isStoragePersisted(),
    estimateDataBreakdown(),
  ])

  const { used, quota } = estimate
  const percentage = quota > 0 ? used / quota : 0
  const status = getStorageStatus(percentage)

  // Calculate other storage
  const knownSize = breakdown.trips + breakdown.plans + breakdown.places
  breakdown.other = Math.max(0, used - knownSize)

  return {
    used,
    quota,
    percentage,
    status,
    isPersisted,
    breakdown,
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/**
 * Check if storage is running low
 */
export async function checkStorageHealth(): Promise<{
  isHealthy: boolean
  message?: string
}> {
  const info = await getStorageInfo()

  if (info.status === 'critical') {
    return {
      isHealthy: false,
      message: `저장소가 거의 가득 찼습니다 (${Math.round(info.percentage * 100)}% 사용 중). 불필요한 데이터를 삭제해주세요.`,
    }
  }

  if (info.status === 'warning') {
    return {
      isHealthy: true,
      message: `저장소 사용량이 높습니다 (${Math.round(info.percentage * 100)}% 사용 중).`,
    }
  }

  return { isHealthy: true }
}

/**
 * Listen for storage pressure events (if supported)
 */
export function onStoragePressure(callback: () => void): () => void {
  if (typeof navigator === 'undefined') return () => {}

  // @ts-expect-error - Experimental API
  if (navigator.storage?.addEventListener) {
    const handler = () => {
      console.warn('[StorageQuota] Storage pressure detected')
      callback()
    }
    // @ts-expect-error - Experimental API
    navigator.storage.addEventListener('quota', handler)
    // @ts-expect-error - Experimental API
    return () => navigator.storage.removeEventListener('quota', handler)
  }

  return () => {}
}
