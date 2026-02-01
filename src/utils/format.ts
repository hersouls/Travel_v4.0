// ============================================
// Formatting Utilities
// ============================================

/**
 * Format date to Korean locale string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format date to short format (YYYY.MM.DD)
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '.').replace('.', '')
}

/**
 * Format date range
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()

  if (sameMonth) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getDate()}일`
  }

  if (sameYear) {
    return `${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getMonth() + 1}월 ${end.getDate()}일, ${start.getFullYear()}`
  }

  return `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
}

/**
 * Calculate trip duration in days
 */
export function getTripDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Format time (HH:mm)
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours, 10)
  const period = h >= 12 ? '오후' : '오전'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hour}:${minutes}`
}

/**
 * Parse YouTube URL to get video ID
 */
export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/,
    /youtube\.com\/v\/([^&?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Get YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Parse map URL to extract coordinates
 */
export function parseMapUrl(url: string): { lat: number; lng: number } | null {
  // Google Maps
  const googleMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (googleMatch) {
    return { lat: parseFloat(googleMatch[1]), lng: parseFloat(googleMatch[2]) }
  }

  // Naver Maps
  const naverMatch = url.match(/y=(-?\d+\.\d+)&x=(-?\d+\.\d+)/)
  if (naverMatch) {
    return { lat: parseFloat(naverMatch[1]), lng: parseFloat(naverMatch[2]) }
  }

  // Kakao Maps
  const kakaoMatch = url.match(/map\/(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (kakaoMatch) {
    return { lat: parseFloat(kakaoMatch[1]), lng: parseFloat(kakaoMatch[2]) }
  }

  return null
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
