// ============================================
// Visited Countries Widget
// Shows countries visited across all trips
// Used on Dashboard as a compact summary
// ============================================

import type { Trip } from '@/types'
import { Globe } from 'lucide-react'
import { useMemo } from 'react'

// Country → flag emoji mapping (common travel destinations)
const COUNTRY_FLAGS: Record<string, string> = {
  한국: '🇰🇷',
  일본: '🇯🇵',
  중국: '🇨🇳',
  대만: '🇹🇼',
  홍콩: '🇭🇰',
  태국: '🇹🇭',
  베트남: '🇻🇳',
  싱가포르: '🇸🇬',
  말레이시아: '🇲🇾',
  인도네시아: '🇮🇩',
  필리핀: '🇵🇭',
  캄보디아: '🇰🇭',
  라오스: '🇱🇦',
  미얀마: '🇲🇲',
  인도: '🇮🇳',
  미국: '🇺🇸',
  캐나다: '🇨🇦',
  멕시코: '🇲🇽',
  영국: '🇬🇧',
  프랑스: '🇫🇷',
  독일: '🇩🇪',
  이탈리아: '🇮🇹',
  스페인: '🇪🇸',
  포르투갈: '🇵🇹',
  네덜란드: '🇳🇱',
  스위스: '🇨🇭',
  오스트리아: '🇦🇹',
  체코: '🇨🇿',
  폴란드: '🇵🇱',
  헝가리: '🇭🇺',
  그리스: '🇬🇷',
  터키: '🇹🇷',
  호주: '🇦🇺',
  뉴질랜드: '🇳🇿',
  러시아: '🇷🇺',
  브라질: '🇧🇷',
  아르헨티나: '🇦🇷',
  이집트: '🇪🇬',
  모로코: '🇲🇦',
  남아프리카공화국: '🇿🇦',
  Korea: '🇰🇷',
  Japan: '🇯🇵',
  China: '🇨🇳',
  Taiwan: '🇹🇼',
  Thailand: '🇹🇭',
  Vietnam: '🇻🇳',
  Singapore: '🇸🇬',
  USA: '🇺🇸',
  UK: '🇬🇧',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Italy: '🇮🇹',
  Spain: '🇪🇸',
  Australia: '🇦🇺',
}

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🌍'
}

interface VisitedCountriesProps {
  trips: Trip[]
}

export function VisitedCountries({ trips }: VisitedCountriesProps) {
  const countries = useMemo(() => {
    const countryMap = new Map<string, number>()
    for (const trip of trips) {
      if (trip.country) {
        countryMap.set(trip.country, (countryMap.get(trip.country) || 0) + 1)
      }
    }
    return [...countryMap.entries()].sort((a, b) => b[1] - a[1])
  }, [trips])

  if (countries.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-primary-500" />
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          방문 국가 ({countries.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {countries.map(([country, count]) => (
          <span
            key={country}
            className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs text-zinc-700 dark:text-zinc-300"
          >
            <span>{getFlag(country)}</span>
            <span>{country}</span>
            {count > 1 && <span className="text-[10px] text-zinc-400">x{count}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
