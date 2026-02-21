// ============================================
// Exchange Rates Hook
// Provides cached exchange rate data with auto-refresh
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { fetchExchangeRates, getCachedRates } from '@/services/exchangeRateService'

interface UseExchangeRatesReturn {
  rates: Record<string, number> | null
  isLoading: boolean
  lastUpdated: number | null
  refresh: () => void
}

export function useExchangeRates(): UseExchangeRatesReturn {
  const cached = getCachedRates()
  const [rates, setRates] = useState<Record<string, number> | null>(cached?.rates ?? null)
  const [isLoading, setIsLoading] = useState(!cached)
  const [lastUpdated, setLastUpdated] = useState<number | null>(cached?.updatedAt ?? null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const newRates = await fetchExchangeRates()
      setRates(newRates)
      const c = getCachedRates()
      setLastUpdated(c?.updatedAt ?? Date.now())
    } catch {
      // Keep existing rates if available
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cached) load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { rates, isLoading, lastUpdated, refresh: load }
}
