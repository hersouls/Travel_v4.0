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
  plansCount?: number
  isFavorite: boolean
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
  type: 'guide' | 'itinerary' | 'memo' | 'analyze-image' | 'test'
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
}

// UI Types
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

// Firebase Migration Types
export interface FirebaseTrip {
  user_id: string
  title: string
  country: string
  start_date: string
  end_date: string
  cover_image?: string
  plans_count?: number
  created_at: { seconds: number; nanoseconds: number }
  updated_at: { seconds: number; nanoseconds: number }
}

export interface FirebasePlan {
  trip_id: string
  day: number
  place_name: string
  start_time: string
  end_time?: string
  type: PlanType
  address?: string
  website?: string
  opening_hours?: string
  memo?: string
  photos?: string[]
  youtube_link?: string
  map_url?: string
  latitude?: number
  longitude?: number
  created_at: { seconds: number; nanoseconds: number }
  updated_at: { seconds: number; nanoseconds: number }
}

export interface FirebasePlace {
  name: string
  type: PlanType
  address?: string
  rating?: number
  map_url?: string
  website?: string
  google_place_id?: string
  latitude?: number
  longitude?: number
  favorite: boolean
  usage_count: number
  created_at: { seconds: number; nanoseconds: number }
  updated_at: { seconds: number; nanoseconds: number }
}

export interface MigrationResult {
  success: boolean
  tripsImported: number
  plansImported: number
  placesImported: number
  errors: string[]
}
