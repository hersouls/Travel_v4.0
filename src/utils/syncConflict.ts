// ============================================
// Sync Conflict Detection Utility
// Field-level comparison for Trip, Plan, Place
// ============================================

import type { SyncEntityType, ConflictField } from '@/types'

// ---- Mergeable field definitions ----

export const TRIP_MERGEABLE_FIELDS = [
  'title', 'country', 'timezone', 'startDate', 'endDate',
  'isFavorite', 'shareId',
] as const

export const PLAN_MERGEABLE_FIELDS = [
  'day', 'order', 'placeName', 'startTime', 'endTime', 'type',
  'address', 'website', 'openingHours', 'memo', 'youtubeLink',
  'mapUrl', 'latitude', 'longitude', 'googlePlaceId', 'audioScript',
] as const

export const PLACE_MERGEABLE_FIELDS = [
  'name', 'type', 'address', 'memo', 'audioScript', 'rating',
  'mapUrl', 'website', 'googlePlaceId', 'latitude', 'longitude',
  'isFavorite', 'usageCount',
] as const

export const TRAVEL_LOG_MERGEABLE_FIELDS = [
  'day', 'timestamp', 'type', 'latitude', 'longitude',
  'address', 'placeName', 'memo',
] as const

export const EXPENSE_MERGEABLE_FIELDS = [
  'day', 'timestamp', 'category', 'subCategory', 'storeName',
  'memo', 'totalAmount', 'currency', 'receiptDate',
  'latitude', 'longitude', 'address',
] as const

// ---- Field label map (Korean) ----

export const FIELD_LABELS_KO: Record<string, string> = {
  title: '여행 제목',
  country: '국가',
  timezone: '시간대',
  startDate: '시작일',
  endDate: '종료일',
  isFavorite: '즐겨찾기',
  shareId: '공유 ID',
  day: '일차',
  order: '순서',
  placeName: '장소명',
  startTime: '시작 시간',
  endTime: '종료 시간',
  type: '유형',
  address: '주소',
  website: '웹사이트',
  openingHours: '영업시간',
  memo: '메모',
  youtubeLink: '유튜브 링크',
  mapUrl: '지도 URL',
  latitude: '위도',
  longitude: '경도',
  googlePlaceId: 'Google Place ID',
  audioScript: '음성 대본',
  name: '장소명',
  rating: '평점',
  usageCount: '사용 횟수',
  timestamp: '시간',
  category: '카테고리',
  subCategory: '세부 카테고리',
  storeName: '가게명',
  totalAmount: '총 금액',
  currency: '통화',
  receiptDate: '영수증 날짜',
}

// ---- Helpers ----

function getMergeableFields(entityType: SyncEntityType): readonly string[] {
  switch (entityType) {
    case 'trip': return TRIP_MERGEABLE_FIELDS
    case 'plan': return PLAN_MERGEABLE_FIELDS
    case 'place': return PLACE_MERGEABLE_FIELDS
    case 'travelLog': return TRAVEL_LOG_MERGEABLE_FIELDS
    case 'expense': return EXPENSE_MERGEABLE_FIELDS
    default: {
      const _exhaustive: never = entityType
      throw new Error(`Unknown entity type: ${_exhaustive}`)
    }
  }
}

function normalize(val: unknown): unknown {
  // 0/false는 유효 값(order:0, lat/lng:0, rating:0 등)이므로 'unset'으로 접지 않는다
  if (val === null || val === undefined || val === '') return undefined
  // Treat empty arrays as undefined ([] vs undefined shouldn't be a conflict)
  if (Array.isArray(val) && val.length === 0) return undefined
  return val
}

function isEqual(a: unknown, b: unknown): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  if (na === undefined || nb === undefined) return false
  if (typeof na !== typeof nb) return false
  if (typeof na === 'number' && typeof nb === 'number') {
    return Math.abs(na - nb) < 1e-9
  }
  if (typeof na === 'object' && typeof nb === 'object') {
    return JSON.stringify(na) === JSON.stringify(nb)
  }
  return false
}

// ---- Core API ----

export function detectConflicts(
  entityType: SyncEntityType,
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
): ConflictField[] {
  const fields = getMergeableFields(entityType)
  const conflicts: ConflictField[] = []

  for (const field of fields) {
    if (!isEqual(local[field], cloud[field])) {
      conflicts.push({
        field,
        localValue: local[field],
        cloudValue: cloud[field],
      })
    }
  }

  return conflicts
}

export function extractMergeableFields(
  entityType: SyncEntityType,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const fields = getMergeableFields(entityType)
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    result[field] = record[field]
  }
  return result
}

export function buildMergedRecord(
  conflict: { localVersion: Record<string, unknown>; cloudVersion: Record<string, unknown> },
  resolutions: Record<string, 'local' | 'cloud'>,
  entityType: SyncEntityType,
): Record<string, unknown> {
  const fields = getMergeableFields(entityType)
  const merged: Record<string, unknown> = {}

  for (const field of fields) {
    const choice = resolutions[field]
    if (choice === 'cloud') {
      merged[field] = conflict.cloudVersion[field]
    } else {
      merged[field] = conflict.localVersion[field]
    }
  }

  return merged
}
