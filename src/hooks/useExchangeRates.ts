// ============================================
// Exchange Rates Hook
// Provides cached exchange rate data with auto-refresh
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchExchangeRates, getCachedRates } from '@/services/exchangeRateService'

interface UseExchangeRatesReturn {
  rates: Record<string, number> | null
  isLoading: boolean
  /** Rates come from expired cache (all APIs failed) */
  isStale: boolean
  lastUpdated: number | null
  refresh: () => void
}

export function useExchangeRates(): UseExchangeRatesReturn {
  const cached = getCachedRates()
  const [rates, setRates] = useState<Record<string, number> | null>(cached?.rates ?? null)
  const [isLoading, setIsLoading] = useState(!cached)
  const [isStale, setIsStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(cached?.updatedAt ?? null)

  // BUG-09: Use ref to track whether initial load has been attempted
  const initialLoadDone = useRef(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchExchangeRates()
      setRates(result.rates)
      setIsStale(result.isStale)
      if (!result.isStale) {
        const c = getCachedRates()
        setLastUpdated(c?.updatedAt ?? Date.now())
      }
    } catch {
      // Keep existing rates if available
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialLoadDone.current && !getCachedRates()) {
      initialLoadDone.current = true
      load()
    } else {
      initialLoadDone.current = true
    }
  }, [load])

  return { rates, isLoading, isStale, lastUpdated, refresh: load }
}
