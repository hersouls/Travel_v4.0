// ============================================
// Shared in-memory rate limiter for Google-billed proxy routes
// NOTE: Per-serverless-instance only (best-effort). Resets on cold start and
// is not shared across concurrent Vercel instances. For hard guarantees back
// it with a durable store (e.g. Upstash/Redis). This still meaningfully caps
// trivial single-client abuse loops against billed Google/OpenAI endpoints.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

const _rlStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, max = 30, windowMs = 60_000) {
  const now = Date.now()
  // Opportunistically evict expired entries to bound memory.
  for (const [k, e] of _rlStore) {
    if (e.resetAt <= now) _rlStore.delete(k)
  }
  const entry = _rlStore.get(key)
  if (!entry || entry.resetAt <= now) {
    _rlStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }
  entry.count++
  return {
    allowed: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt,
  }
}

export function getClientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const raw = Array.isArray(fwd) ? fwd[0] : fwd || ''
  return (raw.split(',')[0] || '').trim() || 'unknown'
}

/**
 * Enforce an IP-keyed rate limit and set the standard X-RateLimit-* headers.
 * Returns true when the request may proceed; when the limit is exceeded it
 * sends a 429 JSON response and returns false (callers should `return`).
 */
export function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  bucket: string,
  max = 30,
  windowMs = 60_000,
): boolean {
  const ip = getClientIp(req)
  const { allowed, remaining, resetAt } = checkRateLimit(`${bucket}:${ip}`, max, windowMs)
  res.setHeader('X-RateLimit-Limit', String(max))
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' })
    return false
  }
  return true
}
