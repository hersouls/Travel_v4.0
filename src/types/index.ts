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
  title: string
  country: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  coverImage?: string // Base64 encoded
  plansCount?: number
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
}

// Plan (일정)
export interface Plan {
  id?: number
  tripId: number
  day: number // 1, 2, 3...
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
  createdAt: Date
  updatedAt: Date
}

// Place (장소 라이브러리)
export interface Place {
  id?: number
  name: string
  type: PlanType
  address?: string
  memo?: string
  rating?: number // 0.0 ~ 5.0
  mapUrl?: string
  latitude?: number
  longitude?: number
  isFavorite: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
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
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  theme: 'system',
  colorPalette: 'default',
  language: 'ko',
  isMusicPlayerEnabled: true,
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
