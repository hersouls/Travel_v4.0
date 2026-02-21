// ============================================
// Exchange Rate Service
// Fetches rates from open.er-api.com (free, no key)
// Caches in localStorage for 24 hours
// ============================================

const API_URL = 'https://open.er-api.com/v6/latest/KRW'
const CACHE_KEY = 'moonwave_exchange_rates'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface CachedRates {
  rates: Record<string, number> // 1 KRW = X foreign currency
  updatedAt: number
}

export function getCachedRates(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedRates = JSON.parse(raw)
    if (Date.now() - cached.updatedAt > CACHE_DURATION) return null
    return cached
  } catch {
    return null
  }
}

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  // Return cache if still valid
  const cached = getCachedRates()
  if (cached) return cached.rates

  const res = await fetch(API_URL)
  if (!res.ok) {
    // Fall back to expired cache if available
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) return (JSON.parse(raw) as CachedRates).rates
    } catch { /* ignore */ }
    throw new Error('환율 정보를 가져올 수 없습니다.')
  }

  const data = await res.json()
  const rates: Record<string, number> = data.rates

  // Save to cache
  const cacheEntry: CachedRates = { rates, updatedAt: Date.now() }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry))
  } catch { /* storage full — ignore */ }

  return rates
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
