// ============================================
// Timezone Utilities for Travel v4.0
// ============================================

import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { differenceInCalendarDays, addDays } from 'date-fns'

// 28개 국가 → IANA 시간대 매핑
export const COUNTRY_TIMEZONES: Record<string, string> = {
  '대한민국': 'Asia/Seoul',
  '일본': 'Asia/Tokyo',
  '중국': 'Asia/Shanghai',
  '대만': 'Asia/Taipei',
  '홍콩': 'Asia/Hong_Kong',
  '베트남': 'Asia/Ho_Chi_Minh',
  '태국': 'Asia/Bangkok',
  '싱가포르': 'Asia/Singapore',
  '말레이시아': 'Asia/Kuala_Lumpur',
  '인도네시아': 'Asia/Jakarta',
  '필리핀': 'Asia/Manila',
  '호주': 'Australia/Sydney',
  '뉴질랜드': 'Pacific/Auckland',
  '미국': 'America/New_York',
  '캐나다': 'America/Toronto',
  '영국': 'Europe/London',
  '프랑스': 'Europe/Paris',
  '독일': 'Europe/Berlin',
  '이탈리아': 'Europe/Rome',
  '스페인': 'Europe/Madrid',
  '스위스': 'Europe/Zurich',
  '네덜란드': 'Europe/Amsterdam',
  '체코': 'Europe/Prague',
  '오스트리아': 'Europe/Vienna',
  '그리스': 'Europe/Athens',
  '터키': 'Europe/Istanbul',
  '두바이': 'Asia/Dubai',
  '기타': 'Asia/Seoul',
}

export const DEFAULT_TIMEZONE = 'Asia/Seoul'

// 시간대 한글 표시 이름 매핑
export const TIMEZONE_DISPLAY_NAMES: Record<string, string> = {
  'Asia/Seoul': '서울',
  'Asia/Tokyo': '도쿄',
  'Asia/Bangkok': '방콕',
  'Asia/Ho_Chi_Minh': '호치민',
  'Asia/Singapore': '싱가포르',
  'Asia/Shanghai': '상하이',
  'Asia/Taipei': '타이베이',
  'Asia/Hong_Kong': '홍콩',
  'Asia/Jakarta': '자카르타',
  'Asia/Manila': '마닐라',
  'Asia/Kuala_Lumpur': '쿠알라룸푸르',
  'Asia/Dubai': '두바이',
  'Europe/London': '런던',
  'Europe/Paris': '파리',
  'Europe/Berlin': '베를린',
  'Europe/Rome': '로마',
  'Europe/Madrid': '마드리드',
  'Europe/Amsterdam': '암스테르담',
  'Europe/Prague': '프라하',
  'Europe/Vienna': '비엔나',
  'Europe/Athens': '아테네',
  'Europe/Istanbul': '이스탄불',
  'Europe/Zurich': '취리히',
  'America/New_York': '뉴욕',
  'America/Toronto': '토론토',
  'Australia/Sydney': '시드니',
  'Pacific/Auckland': '오클랜드',
}

/**
 * 국가명에서 IANA 시간대 반환
 * 알 수 없는 국가는 Asia/Seoul로 폴백
 */
export function getTimezoneFromCountry(country: string): string {
  return COUNTRY_TIMEZONES[country] || DEFAULT_TIMEZONE
}

/**
 * 날짜 문자열(YYYY-MM-DD)을 시간대 영향 없이 파싱
 * 정오(12:00) 기준으로 파싱하여 DST 문제 방지
 */
export function parseDateAsLocal(dateString: string): Date {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    console.warn(`Invalid date string: ${dateString}`)
    return new Date()
  }
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

/**
 * 특정 시간대 기준 날짜 포맷팅
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  formatStr: string
): string {
  try {
    const d = typeof date === 'string' ? parseDateAsLocal(date) : date
    return formatInTimeZone(d, timezone, formatStr)
  } catch (error) {
    console.error(`Timezone format error: ${error}`)
    return date instanceof Date ? date.toISOString() : date
  }
}

/**
 * 두 시간대 간 시차 반환 (시간 단위)
 * 양수: tz1이 tz2보다 앞서있음
 */
export function getTimezoneOffset(tz1: string, tz2: string): number {
  const now = new Date()
  const date1 = toZonedTime(now, tz1)
  const date2 = toZonedTime(now, tz2)
  return (date2.getTimezoneOffset() - date1.getTimezoneOffset()) / 60
}

/**
 * 특정 시간대의 현재 시간 반환
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone)
}

/**
 * 현재 시간을 특정 시간대 기준으로 포맷
 */
export function getCurrentTimeDisplay(timezone: string, formatStr = 'HH:mm'): string {
  return formatInTimeZone(new Date(), timezone, formatStr)
}

/**
 * 여행 기간 계산 (시간대 안전)
 * 시작일과 종료일 모두 포함하여 일수 반환
 */
export function getTripDurationSafe(startDate: string, endDate: string): number {
  const start = parseDateAsLocal(startDate)
  const end = parseDateAsLocal(endDate)
  return differenceInCalendarDays(end, start) + 1
}

/**
 * 여행 N일차 날짜 계산
 * dayNumber는 1부터 시작 (1일차 = startDate)
 */
export function getTripDayDate(startDate: string, dayNumber: number): Date {
  const start = parseDateAsLocal(startDate)
  return addDays(start, dayNumber - 1)
}

/**
 * 여행 N일차 날짜를 포맷된 문자열로 반환
 */
export function formatTripDayDate(
  startDate: string,
  dayNumber: number,
  locale = 'ko-KR'
): string {
  const date = getTripDayDate(startDate, dayNumber)
  return date.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

/**
 * 여행 일수 배열 생성
 * 예: 3일 여행 → [1, 2, 3]
 */
export function getTripDayNumbers(startDate: string, endDate: string): number[] {
  const duration = getTripDurationSafe(startDate, endDate)
  return Array.from({ length: duration }, (_, i) => i + 1)
}

// ============================================
// 시스템 시간대 감지 유틸리티
// ============================================

/**
 * 시스템 시간대 감지 (Intl API 사용)
 */
export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/**
 * 시간대 UTC 오프셋 문자열 반환 (예: "UTC+9", "UTC-5")
 */
export function getTimezoneUTCOffset(timezone: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(now)
    const offsetPart = parts.find(p => p.type === 'timeZoneName')
    return offsetPart?.value || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * 시간대 표시 이름 반환 (예: "서울 (UTC+9)")
 */
export function getTimezoneDisplayName(timezone: string): string {
  const cityName = TIMEZONE_DISPLAY_NAMES[timezone] || timezone.split('/').pop()?.replace(/_/g, ' ')
  const offset = getTimezoneUTCOffset(timezone)
  return `${cityName} (${offset})`
}

/**
 * 두 시간대 간 시차 설명 반환 (예: "2시간 느림", "1시간 빠름")
 * fromTz 기준으로 toTz가 얼마나 빠르거나 느린지 표시
 */
export function getTimezoneDifference(fromTz: string, toTz: string): string {
  const diff = getTimezoneOffset(fromTz, toTz)
  if (diff === 0) return '동일'
  if (diff > 0) return `${diff}시간 빠름`
  return `${Math.abs(diff)}시간 느림`
}

/**
 * 시간 변환 (HH:mm 형식, 시간대 간 변환)
 */
export function convertTimeBetweenZones(
  time: string,
  date: Date,
  fromTimezone: string,
  toTimezone: string
): string {
  try {
    const [hours, minutes] = time.split(':').map(Number)
    const sourceDate = new Date(date)
    sourceDate.setHours(hours, minutes, 0, 0)

    // fromTimezone 기준의 시간을 toTimezone으로 변환
    const zonedDate = toZonedTime(sourceDate, fromTimezone)
    return formatInTimeZone(zonedDate, toTimezone, 'HH:mm')
  } catch {
    return time
  }
}
