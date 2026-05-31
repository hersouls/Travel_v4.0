// ============================================
// URL safety helpers
// ============================================

/**
 * 사용자/원격/AI 출처 URL을 안전한 href로 정규화한다.
 * - http/https만 허용
 * - 스킴이 없는 도메인은 https:// 부여
 * - javascript:/data:/vbscript: 등 위험 스킴은 undefined 반환(링크 렌더 생략 → XSS 차단)
 */
export function safeHref(url?: string | null): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // 스킴 구분자(scheme:)가 있는데 http/https가 아니면 위험 스킴으로 간주하고 차단
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return undefined
  // 스킴 없는 bare 도메인/경로 → https 부여
  return `https://${trimmed}`
}
