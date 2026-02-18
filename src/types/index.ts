// ============================================
// Type Definitions for Travel v4.0
// ============================================

// Plan Types (schedule item types)
export type PlanType =
  | 'attraction'
  | 'restaurant'
  | 'hotel'
  | 'transport'
  | 'car'
  | 'plane'
  | 'airport'
  | 'other'

// Trip (여행)
export interface Trip {
  id?: number
  firebaseId?: string // Firestore document ID (for cloud sync)
  title: string
  country: string
  timezone?: string // IANA timezone (e.g., 'Asia/Tokyo')
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  coverImage?: string // Base64 encoded
  coverImagePath?: string // Firebase Storage path (for cloud sync)
  plansCount?: number
  isFavorite: boolean
  shareId?: string // Public sharing ID for read-only link
  createdAt: Date
  updatedAt: Date
}

// Google Place Info (Google Maps에서 추출된 정보)
export interface GooglePlaceInfo {
  placeId?: string // Google Place ID (ChIJ...)
  cid?: string // Customer ID
  rating?: number // 평점 0.0 ~ 5.0
  reviewCount?: number // 리뷰 수
  phone?: string // 전화번호
  website?: string // 웹사이트
  openingHours?: string[] // 영업시간
  category?: string // 카테고리
  extractedAt: Date // 추출 시간
}

// Plan (일정)
export interface Plan {
  id?: number
  firebaseId?: string // Firestore document ID (for cloud sync)
  tripId: number
  tripFirebaseId?: string // Parent trip's Firestore ID (for cloud sync)
  day: number // 1, 2, 3...
  order?: number // 드래그앤드롭 정렬 순서
  placeName: string
  startTime: string // HH:mm
  endTime?: string // HH:mm
  type: PlanType
  address?: string
  website?: string
  openingHours?: string
  memo?: string
  photos?: string[] // Base64 encoded
  photoPaths?: string[] // Firebase Storage paths (for cloud sync)
  youtubeLink?: string
  mapUrl?: string
  latitude?: number
  longitude?: number
  googlePlaceId?: string // Google Place ID
  googleInfo?: GooglePlaceInfo // Google Maps 추출 정보
  audioScript?: string // Moonyou Guide 음성 대본
  createdAt: Date
  updatedAt: Date
}

// Place (장소 라이브러리)
export interface Place {
  id?: number
  firebaseId?: string // Firestore document ID (for cloud sync)
  name: string
  type: PlanType
  address?: string
  memo?: string
  audioScript?: string // Moonyou Guide 음성 대본
  photos?: string[] // Base64 encoded
  photoPaths?: string[] // Firebase Storage paths (for cloud sync)
  rating?: number // 0.0 ~ 5.0
  mapUrl?: string
  website?: string
  googlePlaceId?: string // Google Place ID
  latitude?: number
  longitude?: number
  isFavorite: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

// ============================================
// Travel Log Types (여행 기록)
// ============================================

// 기록 유형
export type TravelLogType = 'photo' | 'receipt' | 'memo'

// 경비 카테고리
export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'shopping'
  | 'attraction'
  | 'other'

// EXIF 메타데이터
export interface ExifMetadata {
  dateTime?: string // ISO string from DateTimeOriginal
  latitude?: number
  longitude?: number
  cameraMake?: string
  cameraModel?: string
}

// 경비 항목
export interface ExpenseItem {
  name: string
  quantity?: number
  unitPrice?: number
  amount: number
}

// 경비 데이터 (영수증 OCR 결과)
export interface ExpenseData {
  storeName: string
  category: ExpenseCategory
  items: ExpenseItem[]
  totalAmount: number
  currency: string // ISO 4217 (KRW, JPY, USD...)
  receiptDate?: string // YYYY-MM-DD
}

// 여행 기록 항목
export interface TravelLog {
  id?: number
  firebaseId?: string
  tripId: number
  tripFirebaseId?: string
  day: number
  timestamp: string // ISO datetime
  type: TravelLogType
  photo?: string // Base64 (full compressed image)
  photoPath?: string // Firebase Storage path
  thumbnailPhoto?: string // Base64 (200px thumbnail)
  thumbnailPhotoPath?: string
  exif?: ExifMetadata
  latitude?: number
  longitude?: number
  address?: string // 역지오코딩 결과
  placeName?: string
  memo?: string
  expense?: ExpenseData // type='receipt' 전용
  createdAt: Date
  updatedAt: Date
}

// ============================================
// Google Maps API Types
// ============================================

// 이동 수단
export type TravelMode = 'DRIVE' | 'WALK' | 'TRANSIT' | 'BICYCLE'

// 지도 제공자
export type MapProvider = 'google' | 'leaflet'

// 경로 단계 (턴바이턴 안내)
export interface RouteStep {
  instruction: string
  distanceMeters: number
  duration: string // e.g., "300s"
  startLocation: { lat: number; lng: number }
  endLocation: { lat: number; lng: number }
  travelMode: string
  polyline: string // encoded polyline
}

// 경로 구간 (두 장소 사이)
export interface RouteSegment {
  id?: number
  firebaseId?: string
  tripId: number
  tripFirebaseId?: string
  fromPlanId: number
  toPlanId: number
  fromCoords: { lat: number; lng: number }
  toCoords: { lat: number; lng: number }
  travelMode: TravelMode
  distanceMeters: number
  duration: string // e.g., "1200s"
  durationText: string // e.g., "20분"
  distanceText: string // e.g., "5.2 km"
  encodedPolyline: string
  steps?: RouteStep[]
  cachedAt: Date
  updatedAt: Date
}

// 주변 장소
export interface NearbyPlace {
  placeId: string
  name: string
  address: string
  latitude: number
  longitude: number
  rating?: number
  reviewCount?: number
  category?: string
  distanceMeters?: number
  photoUrl?: string
}

// Place 사진 참조
export interface PlacePhotoRef {
  name: string // photo resource name
  widthPx: number
  heightPx: number
  photoUrl?: string // resolved URL
}

// 여행 통계
export interface TripStatistics {
  totalDistanceMeters: number
  totalDurationSeconds: number
  segmentCount: number
  modeBreakdown: Record<TravelMode, { distance: number; duration: number; count: number }>
  typeBreakdown: Record<string, number>
}

// ============================================
// Claude AI Types
// ============================================

export type ClaudeModel = 'haiku' | 'sonnet' | 'opus'

export interface AIGenerateRequest {
  type: 'guide' | 'itinerary' | 'memo' | 'analyze-image' | 'day-recommend' | 'day-suggest' | 'receipt-food' | 'receipt-general' | 'test'
  context: Record<string, unknown>
  image?: string // base64 (for vision)
  model?: ClaudeModel
  stream?: boolean
}

export interface GeneratedItinerary {
  days: Array<{
    day: number
    plans: Array<{
      placeName: string
      startTime: string // HH:mm
      endTime: string
      type: PlanType
      address?: string
      memo?: string
      latitude?: number
      longitude?: number
    }>
  }>
}

// AI Day Suggestion (일정 제안 결과)
export interface DaySuggestion {
  analysis: string
  suggestions: string[]
  revisedPlans: Array<{
    placeName: string
    startTime: string
    endTime: string
    type: PlanType
    address?: string
    memo?: string
    latitude?: number
    longitude?: number
  }>
}

// Theme Mode
export type ThemeMode = 'light' | 'dark' | 'system'

// Color Palette
export type ColorPalette = 'default' | 'ocean' | 'rose' | 'purple' | 'forest'

// Palette Definition
export interface PaletteDefinition {
  id: ColorPalette
  name: string
  nameKo: string
  colors: {
    primary: string
    secondary: string
  }
}

// Settings
export interface Settings {
  id: string
  theme: ThemeMode
  colorPalette: ColorPalette
  language: 'ko' | 'en'
  isMusicPlayerEnabled: boolean
  lastBackupDate?: Date
  settingsUpdatedAt?: Date // Tracks when settings were last modified (for sync comparison)
  // 시간대 설정
  detectedTimezone?: string // 마지막 감지된 시간대
  timezoneAutoDetect: boolean // 자동 감지 활성화 (기본: true)
  // 지도 설정
  mapProvider: MapProvider // 지도 제공자 (기본: 'google')
  defaultTravelMode: TravelMode // 기본 이동수단 (기본: 'DRIVE')
  // Claude AI 설정 (API key는 localStorage에만 저장, DB/Firestore 제외)
  claudeApiKey?: string
  claudeModel?: ClaudeModel
  claudeEnabled?: boolean
  // OpenAI TTS 설정 (API key는 localStorage에만 저장)
  openaiApiKey?: string
  openaiTtsModel?: 'tts-1' | 'tts-1-hd'
  openaiTtsVoice?: string
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  theme: 'system',
  colorPalette: 'default',
  language: 'ko',
  isMusicPlayerEnabled: true,
  timezoneAutoDetect: true,
  mapProvider: 'google',
  defaultTravelMode: 'DRIVE',
  claudeEnabled: false,
  claudeModel: 'sonnet',
  openaiTtsModel: 'tts-1',
  openaiTtsVoice: 'alloy',
}

// Sync Status
export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'done' | 'error'

export interface SyncProgress {
  status: SyncStatus
  step?: string // e.g., '여행 동기화 중...'
  localOnlyCount?: number // local-only items to be removed
  error?: string
  skipped?: boolean // true when initial sync was skipped due to cooldown
}

// Sync Conflict Types
export type SyncEntityType = 'trip' | 'plan' | 'place' | 'travelLog'

export interface ConflictField {
  field: string
  localValue: unknown
  cloudValue: unknown
}

export interface PendingConflict {
  id: string
  entityType: SyncEntityType
  entityId: number
  firebaseId: string
  entityLabel: string
  conflictFields: ConflictField[]
  localVersion: Record<string, unknown>
  cloudVersion: Record<string, unknown>
  localUpdatedAt: Date
  cloudUpdatedAt: Date
  detectedAt: Date
}

export type ConflictResolution = 'local' | 'cloud'

// UI Types
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

