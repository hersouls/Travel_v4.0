// ============================================
// App Constants
// ============================================

export const APP_NAME = 'Moonwave Travel'
export const APP_VERSION = '4.0.0'
export const APP_DESCRIPTION = '여행 일정 관리 및 추억 기록 도구'
export const SCHEMA_VERSION = 3

// Storage Keys
export const STORAGE_KEYS = {
  SETTINGS: 'travel-settings',
  BROADCAST: 'travel-broadcast',
  LAST_SYNC: 'travel-last-sync',
} as const

// Storage Thresholds
export const STORAGE_THRESHOLDS = {
  WARNING: 0.75, // 75%
  CRITICAL: 0.9, // 90%
  MOBILE_LIMIT: 50 * 1024 * 1024, // 50MB
  DESKTOP_LIMIT: 100 * 1024 * 1024, // 100MB
} as const

// Plan Type Icons (Lucide icon names)
export const PLAN_TYPE_ICONS = {
  attraction: 'Camera',
  restaurant: 'Utensils',
  hotel: 'Bed',
  transport: 'Bus',
  car: 'Car',
  plane: 'Plane',
  airport: 'PlaneTakeoff',
  other: 'MapPin',
} as const

// Plan Type Labels
export const PLAN_TYPE_LABELS = {
  attraction: '관광',
  restaurant: '식당',
  hotel: '숙소',
  transport: '교통',
  car: '렌트카',
  plane: '항공',
  airport: '공항',
  other: '기타',
} as const

// Countries (common travel destinations)
export const COUNTRIES = [
  '대한민국',
  '일본',
  '중국',
  '대만',
  '홍콩',
  '베트남',
  '태국',
  '싱가포르',
  '말레이시아',
  '인도네시아',
  '필리핀',
  '호주',
  '뉴질랜드',
  '미국',
  '캐나다',
  '영국',
  '프랑스',
  '독일',
  '이탈리아',
  '스페인',
  '스위스',
  '네덜란드',
  '체코',
  '오스트리아',
  '그리스',
  '터키',
  '두바이',
  '기타',
] as const

// Travel Mode Labels
export const TRAVEL_MODE_LABELS = {
  DRIVE: '운전',
  WALK: '도보',
  TRANSIT: '대중교통',
  BICYCLE: '자전거',
} as const

// Travel Mode Icons (Lucide icon names)
export const TRAVEL_MODE_ICONS = {
  DRIVE: 'Car',
  WALK: 'Footprints',
  TRANSIT: 'Bus',
  BICYCLE: 'Bike',
} as const

// Date format options
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

// Time format options
export const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
}

// Color Palettes
import type { PaletteDefinition } from '@/types'

export const COLOR_PALETTES: Record<string, PaletteDefinition> = {
  default: {
    id: 'default',
    name: 'Mint',
    nameKo: '민트',
    colors: {
      primary: '#2EFFB4',
      secondary: '#00A86B',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    nameKo: '오션',
    colors: {
      primary: '#3B82F6',
      secondary: '#1D4ED8',
    },
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    nameKo: '로즈',
    colors: {
      primary: '#F472B6',
      secondary: '#DB2777',
    },
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    nameKo: '퍼플',
    colors: {
      primary: '#A78BFA',
      secondary: '#7C3AED',
    },
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    nameKo: '포레스트',
    colors: {
      primary: '#34D399',
      secondary: '#059669',
    },
  },
}
