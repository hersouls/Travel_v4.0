// ============================================
// App Constants
// ============================================

export const APP_NAME = 'Moonwave Travel'
export const APP_VERSION = '4.0.0'
export const APP_DESCRIPTION = '여행 일정 관리 및 추억 기록 도구'
export const SCHEMA_VERSION = 6

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
  restaurant: '맛집',
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

// Expense Category Labels (Korean)
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  food: '식비',
  transport: '교통',
  accommodation: '숙소',
  shopping: '쇼핑',
  attraction: '관광',
  other: '기타',
} as const

// Expense Category Icons (Lucide icon names)
export const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
  food: 'Utensils',
  transport: 'Bus',
  accommodation: 'Bed',
  shopping: 'ShoppingBag',
  attraction: 'Camera',
  other: 'MoreHorizontal',
} as const

// Currency Symbols
export const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: '₩',
  JPY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  THB: '฿',
  VND: '₫',
  SGD: 'S$',
  AUD: 'A$',
  TWD: 'NT$',
} as const

// Travel Log Type Labels
export const TRAVEL_LOG_TYPE_LABELS: Record<string, string> = {
  photo: '사진',
  receipt: '영수증',
  memo: '메모',
} as const

// AI Error/Status Messages
export const AI_MESSAGES = {
  API_KEY_MISSING: 'API 키가 설정되지 않았습니다. 설정에서 Claude API 키를 입력하세요.',
  PARSE_ERROR: 'AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.',
} as const

// AI Dialog Options
export const INTEREST_OPTIONS = [
  { value: '관광', label: '관광' },
  { value: '맛집', label: '맛집' },
  { value: '쇼핑', label: '쇼핑' },
  { value: '자연', label: '자연' },
  { value: '문화', label: '문화' },
  { value: '야경', label: '야경' },
  { value: '카페', label: '카페' },
] as const

export const STYLE_OPTIONS = [
  { value: '여유로운', label: '여유로운' },
  { value: '알찬', label: '알찬' },
  { value: '균형', label: '균형' },
] as const

// Expense Subcategory Labels (Korean)
export const EXPENSE_SUBCATEGORY_LABELS: Record<string, string> = {
  // food
  restaurant: '식당',
  cafe: '카페',
  convenience: '편의점',
  delivery: '배달',
  snack: '간식',
  // transport
  flight: '항공',
  taxi: '택시',
  subway: '지하철',
  bus: '버스',
  rental_car: '렌트카',
  // accommodation
  hotel: '호텔',
  airbnb: '에어비앤비',
  hostel: '호스텔',
  guesthouse: '게스트하우스',
  // shopping
  souvenir: '기념품',
  clothing: '의류',
  dutyfree: '면세점',
  mart: '마트',
  // attraction
  admission: '입장료',
  experience: '체험',
  tour: '투어',
  // other
  telecom: '통신',
  insurance: '보험',
  exchange_fee: '환전수수료',
  laundry: '세탁',
  tip: '팁',
} as const

// Expense Subcategory Icons (Lucide icon names)
export const EXPENSE_SUBCATEGORY_ICONS: Record<string, string> = {
  restaurant: 'Utensils',
  cafe: 'Coffee',
  convenience: 'Store',
  delivery: 'Truck',
  snack: 'Cookie',
  flight: 'Plane',
  taxi: 'Car',
  subway: 'TrainFront',
  bus: 'Bus',
  rental_car: 'CarFront',
  hotel: 'Building2',
  airbnb: 'Home',
  hostel: 'BedDouble',
  guesthouse: 'House',
  souvenir: 'Gift',
  clothing: 'Shirt',
  dutyfree: 'ShoppingCart',
  mart: 'Store',
  admission: 'Ticket',
  experience: 'Sparkles',
  tour: 'Map',
  telecom: 'Smartphone',
  insurance: 'Shield',
  exchange_fee: 'ArrowLeftRight',
  laundry: 'Droplets',
  tip: 'Heart',
} as const

// Parent → Subcategory mapping
export const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
  food: ['restaurant', 'cafe', 'convenience', 'delivery', 'snack'],
  transport: ['flight', 'taxi', 'subway', 'bus', 'rental_car'],
  accommodation: ['hotel', 'airbnb', 'hostel', 'guesthouse'],
  shopping: ['souvenir', 'clothing', 'dutyfree', 'mart'],
  attraction: ['admission', 'experience', 'tour'],
  other: ['telecom', 'insurance', 'exchange_fee', 'laundry', 'tip'],
} as const

// Payment Method Labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '현금',
  card: '카드',
  other: '기타',
} as const
