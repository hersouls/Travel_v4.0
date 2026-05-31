// ============================================
// Exchange Rate Service
// Primary: open.er-api.com (free, no key)
// Fallback: fawazahmed0/currency-api (free CDN)
// Caches in localStorage for 24 hours
// ============================================

const PRIMARY_API_URL = 'https://open.er-api.com/v6/latest/KRW'
const FALLBACK_API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/krw.json'
const CACHE_KEY = 'moonwave_exchange_rates'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const FETCH_TIMEOUT_MS = 8_000

interface CachedRates {
  rates: Record<string, number> // 1 KRW = X foreign currency
  updatedAt: number
}

export interface FetchRatesResult {
  rates: Record<string, number>
  /** true when rates come from expired cache because all APIs failed */
  isStale: boolean
}

export function getCachedRates(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as Partial<CachedRates>
    // 구조 검증 — updatedAt/rates가 깨진 캐시를 유효한 것처럼 반환하면 네트워크 갱신이 영구 스킵됨
    if (
      !cached ||
      typeof cached.updatedAt !== 'number' ||
      !Number.isFinite(cached.updatedAt) ||
      typeof cached.rates !== 'object' ||
      cached.rates === null
    ) {
      return null
    }
    if (Date.now() - cached.updatedAt > CACHE_DURATION) return null
    return cached as CachedRates
  } catch {
    return null
  }
}

/** Get expired cache (any age) as last resort */
function getExpiredCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedRates
  } catch {
    return null
  }
}

/** Fetch with timeout to avoid hanging on slow networks */
async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Try primary API (open.er-api.com) */
async function fetchFromPrimary(): Promise<Record<string, number>> {
  const res = await fetchWithTimeout(PRIMARY_API_URL)
  if (!res.ok) throw new Error(`Primary API returned ${res.status}`)
  const data = await res.json()
  return data.rates as Record<string, number>
}

/** Try fallback API (fawazahmed0/currency-api) - different response format */
async function fetchFromFallback(): Promise<Record<string, number>> {
  const res = await fetchWithTimeout(FALLBACK_API_URL)
  if (!res.ok) throw new Error(`Fallback API returned ${res.status}`)
  const data = await res.json()
  // Format: { date: "...", krw: { usd: 0.00074, jpy: 0.1057, ... } }
  const krwRates = data.krw as Record<string, number> | undefined
  if (!krwRates || typeof krwRates !== 'object') {
    throw new Error('Unexpected fallback API response format')
  }
  // Normalize keys to uppercase to match primary API format
  const normalized: Record<string, number> = {}
  for (const [key, value] of Object.entries(krwRates)) {
    normalized[key.toUpperCase()] = value
  }
  return normalized
}

function saveToCache(rates: Record<string, number>): void {
  const cacheEntry: CachedRates = { rates, updatedAt: Date.now() }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry))
  } catch { /* storage full — ignore */ }
}

export async function fetchExchangeRates(): Promise<FetchRatesResult> {
  // Return cache if still valid
  const cached = getCachedRates()
  if (cached) return { rates: cached.rates, isStale: false }

  // Try primary API
  try {
    const rates = await fetchFromPrimary()
    saveToCache(rates)
    return { rates, isStale: false }
  } catch (e) {
    console.warn('[ExchangeRate] Primary API failed, trying fallback...', e)
  }

  // Try fallback API
  try {
    const rates = await fetchFromFallback()
    saveToCache(rates)
    return { rates, isStale: false }
  } catch (e) {
    console.warn('[ExchangeRate] Fallback API also failed', e)
  }

  // Both APIs failed — use expired cache if available
  const expired = getExpiredCache()
  if (expired) {
    return { rates: expired.rates, isStale: true }
  }

  throw new Error('환율 정보를 가져올 수 없습니다.')
}

/**
 * Convert an amount in a foreign currency to KRW.
 * rates format: 1 KRW = rates[currency] (e.g. rates['JPY'] = 0.1057)
 * So: amountInKRW = amount / rates[currency]
 */
export function convertToKRW(
  amount: number,
  currency: string,
  rates: Record<string, number>,
): number | null {
  if (currency === 'KRW') return amount
  const rate = rates[currency]
  if (!rate || rate === 0) return null
  return Math.round(amount / rate)
}
