// ============================================
// Memo Icons - 키워드 기반 아이콘 매핑
// ============================================

import {
  Clock,
  MapPin,
  Phone,
  Wallet,
  Lightbulb,
  AlertCircle,
  Car,
  Bus,
  Globe,
  Mail,
  Gift,
  Tag,
  Info,
  AlertTriangle,
  Wifi,
  Utensils,
  Coffee,
  CalendarCheck,
  CalendarX2,
  Bath,
  Ticket,
  CreditCard,
  Navigation,
  Train,
  CheckSquare,
  Camera,
  Footprints,
  Plane,
  Building2,
  Star,
  type LucideIcon,
} from 'lucide-react'

export interface MemoIconRule {
  keywords: string[]
  icon: LucideIcon
  color: ColorKey
}

// 섹션 헤더 규칙 인터페이스
export interface SectionHeaderRule {
  emoji: string
  keywords: string[]
  icon: LucideIcon
  color: ColorKey
}

// 체크리스트 아이템 파싱 결과
export interface ChecklistItemParsed {
  checked: boolean
  text: string
}

// 앱 팔레트에 맞는 시맨틱 컬러
export type ColorKey = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

export const MEMO_ICON_RULES: MemoIconRule[] = [
  // 시간/일정
  { keywords: ['영업시간', '운영시간', '오픈', '개장'], icon: Clock, color: 'info' },
  { keywords: ['휴무', '휴일', '정기휴무', '휴관'], icon: CalendarX2, color: 'danger' },
  { keywords: ['예약', '예매', '사전예약'], icon: CalendarCheck, color: 'success' },

  // 위치/접근
  { keywords: ['주소', '위치', '찾아가는'], icon: MapPin, color: 'primary' },
  { keywords: ['주차', '파킹', '주차장'], icon: Car, color: 'muted' },
  { keywords: ['교통', '버스', '대중교통'], icon: Bus, color: 'info' },
  { keywords: ['지하철', '전철', '메트로'], icon: Train, color: 'info' },
  { keywords: ['가는법', '오시는길', '찾아오시는'], icon: Navigation, color: 'primary' },

  // 연락/정보
  { keywords: ['전화', '연락처', '문의', '콜센터'], icon: Phone, color: 'success' },
  { keywords: ['홈페이지', '웹사이트', '사이트', '공식'], icon: Globe, color: 'info' },
  { keywords: ['이메일', '메일'], icon: Mail, color: 'info' },

  // 비용
  { keywords: ['가격', '요금', '입장료', '비용', '금액', '티켓'], icon: Wallet, color: 'warning' },
  { keywords: ['무료', '프리', '공짜'], icon: Gift, color: 'success' },
  { keywords: ['할인', '세일', '프로모션', '특가'], icon: Tag, color: 'warning' },
  { keywords: ['결제', '카드', '현금'], icon: CreditCard, color: 'muted' },
  { keywords: ['입장권', '티켓팅'], icon: Ticket, color: 'primary' },

  // 안내/팁
  { keywords: ['추천', '팁', '꿀팁', '추천합니다'], icon: Lightbulb, color: 'warning' },
  { keywords: ['주의', '참고', '유의', '알림'], icon: AlertCircle, color: 'warning' },
  { keywords: ['필수', '중요', '주요'], icon: AlertTriangle, color: 'danger' },
  { keywords: ['정보', '안내', '소개'], icon: Info, color: 'info' },

  // 서비스/편의
  { keywords: ['와이파이', 'wifi', 'WiFi', '인터넷', '무선'], icon: Wifi, color: 'info' },
  { keywords: ['화장실', '휴게실', '편의시설'], icon: Bath, color: 'muted' },
  { keywords: ['음식', '식사', '메뉴', '먹거리'], icon: Utensils, color: 'warning' },
  { keywords: ['카페', '커피', '디저트'], icon: Coffee, color: 'warning' },
]

// 섹션 헤더 규칙 (키워드 기반 + 이모지 감지)
// Lucide Icons만 표시, 원본 이모지는 감지용으로만 사용
export const SECTION_HEADER_RULES: SectionHeaderRule[] = [
  { emoji: '✅', keywords: ['체크리스트', '준비물', '확인', '체크', 'checklist'], icon: CheckSquare, color: 'success' },
  { emoji: '📍', keywords: ['기본 정보', '기본정보', '위치', '정보', '개요', 'info'], icon: MapPin, color: 'primary' },
  { emoji: '💡', keywords: ['팁', '꿀팁', '추천', '조언', 'tip', 'tips'], icon: Lightbulb, color: 'warning' },
  { emoji: '⚠️', keywords: ['주의', '유의', '참고', '주의사항', 'warning', 'caution'], icon: AlertTriangle, color: 'danger' },
  { emoji: '🎫', keywords: ['티켓', '입장', '예매', '입장권', 'ticket'], icon: Ticket, color: 'primary' },
  { emoji: '🚗', keywords: ['교통', '주차', '가는법', '오시는길', '가는 법', 'transport'], icon: Car, color: 'info' },
  { emoji: '🍽️', keywords: ['음식', '식사', '맛집', '레스토랑', 'food', 'restaurant'], icon: Utensils, color: 'warning' },
  { emoji: '📞', keywords: ['연락처', '문의', '전화', 'contact'], icon: Phone, color: 'success' },
  { emoji: '⏰', keywords: ['시간', '영업', '운영시간', '영업시간', 'hours', 'time'], icon: Clock, color: 'info' },
  { emoji: '💰', keywords: ['비용', '가격', '요금', '입장료', 'price', 'cost'], icon: Wallet, color: 'warning' },
  { emoji: '📸', keywords: ['사진', '포토', '촬영', '포토스팟', 'photo'], icon: Camera, color: 'primary' },
  { emoji: '🚶', keywords: ['도보', '걷기', '산책', '동선', 'walk'], icon: Footprints, color: 'muted' },
  { emoji: '✈️', keywords: ['비행', '항공', '공항', 'flight', 'airport'], icon: Plane, color: 'info' },
  { emoji: '🏛️', keywords: ['시설', '건물', '관광지', '명소', 'facility'], icon: Building2, color: 'muted' },
  { emoji: '⭐', keywords: ['별점', '평점', '리뷰', '하이라이트', '추천포인트', 'highlight'], icon: Star, color: 'warning' },
]

// CSS 변수 기반 시맨틱 컬러 (팔레트 설정에 따라 변경됨)
export const COLOR_CLASSES: Record<
  ColorKey,
  { bg: string; icon: string; label: string; border: string }
> = {
  // Primary - 앱 팔레트 색상 사용
  primary: {
    bg: 'bg-primary-50 dark:bg-primary-950/40',
    icon: 'text-primary-600 dark:text-primary-400',
    label: 'text-primary-800 dark:text-primary-200',
    border: 'border-primary-200 dark:border-primary-800',
  },
  // Success - 성공/완료/확인
  success: {
    bg: 'bg-success-50 dark:bg-success-900/30',
    icon: 'text-success-600 dark:text-success-400',
    label: 'text-success-800 dark:text-success-200',
    border: 'border-success-200 dark:border-success-800',
  },
  // Warning - 주의/비용/팁
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900/30',
    icon: 'text-warning-600 dark:text-warning-400',
    label: 'text-warning-800 dark:text-warning-200',
    border: 'border-warning-200 dark:border-warning-800',
  },
  // Danger - 위험/휴무/필수
  danger: {
    bg: 'bg-danger-50 dark:bg-danger-900/30',
    icon: 'text-danger-600 dark:text-danger-400',
    label: 'text-danger-800 dark:text-danger-200',
    border: 'border-danger-200 dark:border-danger-800',
  },
  // Info - 정보/시간/교통
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    icon: 'text-blue-500 dark:text-blue-400',
    label: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-200 dark:border-blue-800',
  },
  // Muted - 일반/편의시설
  muted: {
    bg: 'bg-zinc-100 dark:bg-zinc-800/50',
    icon: 'text-zinc-500 dark:text-zinc-400',
    label: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
}

/**
 * 텍스트에서 키워드를 감지하여 아이콘 규칙 반환
 */
export function detectMemoIcon(text: string): MemoIconRule | null {
  const lowerText = text.toLowerCase()

  for (const rule of MEMO_ICON_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return rule
      }
    }
  }

  return null
}

/**
 * 라벨:값 형식인지 확인하고 파싱
 */
export function parseLabelLine(
  line: string
): { label: string; value: string; rule: MemoIconRule | null } | null {
  // 마크다운 볼드 패턴 정규화: "- **주소:** **value**" → "주소: value"
  let normalized = line.trim()
  // 리스트 접두사 제거
  normalized = normalized.replace(/^[-*]\s+/, '')
  // **label:** value 또는 **label:** **value** 패턴 처리
  const boldLabelMatch = normalized.match(/^\*\*([^*]+?):\*\*\s*(.+)$/)
  if (boldLabelMatch) {
    const label = boldLabelMatch[1].trim()
    const value = boldLabelMatch[2].replace(/\*\*/g, '').trim()
    const rule = detectMemoIcon(label)
    return { label, value, rule }
  }
  // **label** : value 패턴 처리
  const boldLabel2Match = normalized.match(/^\*\*([^*]+?)\*\*\s*:\s*(.+)$/)
  if (boldLabel2Match) {
    const label = boldLabel2Match[1].trim()
    const value = boldLabel2Match[2].replace(/\*\*/g, '').trim()
    const rule = detectMemoIcon(label)
    return { label, value, rule }
  }

  // 콜론으로 분리 (첫 번째 콜론만)
  const colonIndex = normalized.indexOf(':')
  if (colonIndex === -1 || colonIndex > 15) return null

  let label = normalized.slice(0, colonIndex).trim()
  let value = normalized.slice(colonIndex + 1).trim()

  // 잔여 ** 제거
  label = label.replace(/\*\*/g, '')
  value = value.replace(/\*\*/g, '')

  // 값이 없으면 라벨만 있는 경우
  if (!value) return null

  const rule = detectMemoIcon(label)

  return { label, value, rule }
}

/**
 * 체크리스트 아이템 파싱
 * 다양한 체크 형식 지원: - [ ], - [x], ☐, ☑, ✅, ✓
 */
export function parseChecklistItem(line: string): ChecklistItemParsed | null {
  const trimmed = line.trim()

  // 패턴 1: - [ ] / - [x] / - [X]
  const markdownMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)
  if (markdownMatch) {
    return {
      checked: markdownMatch[1] !== ' ',
      text: markdownMatch[2].trim(),
    }
  }

  // 패턴 2: 숫자. [ ] / 숫자. [x]
  const numberedMatch = trimmed.match(/^\d+\.\s*\[([ xX])\]\s*(.+)$/)
  if (numberedMatch) {
    return {
      checked: numberedMatch[1] !== ' ',
      text: numberedMatch[2].trim(),
    }
  }

  // 패턴 3: 유니코드 체크박스 (☐, ☑, ✅, ✓, ✗)
  const unicodeMatch = trimmed.match(/^[-*]?\s*(☐|☑|✅|✓|✗)\s*(.+)$/)
  if (unicodeMatch) {
    const checked = unicodeMatch[1] !== '☐' && unicodeMatch[1] !== '✗'
    return {
      checked,
      text: unicodeMatch[2].trim(),
    }
  }

  return null
}

/**
 * 섹션 헤더 감지
 * 이모지로 시작하거나 키워드를 포함하는 라인
 */
export function parseSectionHeader(line: string): SectionHeaderRule | null {
  const trimmed = line.trim()

  // 빈 줄이나 너무 긴 줄은 헤더가 아님
  if (!trimmed || trimmed.length > 50) return null

  for (const rule of SECTION_HEADER_RULES) {
    // 이모지로 시작하는 경우 (다양한 형태 지원)
    if (trimmed.startsWith(rule.emoji)) {
      return rule
    }
  }

  // 키워드를 포함하는 경우 (단, 콜론이 없고, 짧은 제목 형식)
  // 예: "체크리스트", "기본 정보", "팁", "주의사항" 등
  if (!trimmed.includes(':') && trimmed.length <= 20) {
    const lowerTrimmed = trimmed.toLowerCase()
    for (const rule of SECTION_HEADER_RULES) {
      for (const keyword of rule.keywords) {
        if (lowerTrimmed.includes(keyword.toLowerCase())) {
          return rule
        }
      }
    }
  }

  // 대괄호로 감싼 제목 형식 지원: [체크리스트], [기본 정보] 등
  const bracketMatch = trimmed.match(/^\[([^\]]+)\]$/)
  if (bracketMatch) {
    const innerText = bracketMatch[1].toLowerCase()
    for (const rule of SECTION_HEADER_RULES) {
      for (const keyword of rule.keywords) {
        if (innerText.includes(keyword.toLowerCase())) {
          return rule
        }
      }
    }
  }

  // 해시태그 스타일 제목: # 체크리스트, ## 기본 정보 등
  const hashMatch = trimmed.match(/^#{1,3}\s*(.+)$/)
  if (hashMatch) {
    const innerText = hashMatch[1].toLowerCase()
    for (const rule of SECTION_HEADER_RULES) {
      for (const keyword of rule.keywords) {
        if (innerText.includes(keyword.toLowerCase())) {
          return rule
        }
      }
    }
  }

  return null
}

/**
 * 섹션 헤더 텍스트에서 이모지 제거 (Lucide 아이콘으로 대체됨)
 */
export function cleanSectionTitle(title: string): string {
  // 마크다운 헤더(##) 및 이모지 제거
  return title
    .trim()
    // 마크다운 해시 헤더 제거 (## 제목 → 제목)
    .replace(/^#{1,3}\s+/, '')
    // 기본 이모지 범위
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    // 기호 이모지
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    // 딩뱃 이모지
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    // 보충 기호
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '')
    // 추가 이모지
    .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '')
    // 변형 선택자
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    // 특수 이모지 문자
    .replace(/[✅⚠️⏰💡📍🎫🚗🍽️📞💰📸🚶✈️🏛️⭐☑️❌❗❓✓✗☐☑]/g, '')
    // 앞뒤 공백 정리
    .trim()
}

/**
 * 메모 콘텐츠 전처리: 마크다운 헤더 제거, 구분선 분리
 * MemoRenderer에서 파싱 전에 호출
 */
export function preprocessMemoContent(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      // ## 또는 # 접두사 제거 (이모지 헤더만 남김)
      // 예: "## 📍 기본 정보" → "📍 기본 정보"
      const hashHeader = trimmed.match(/^#{1,3}\s+(.+)$/)
      if (hashHeader) {
        return hashHeader[1]
      }
      return line
    })
    .join('\n')
}
