// ============================================
// Weather Badge Component
// Displays weather info for a trip day
// ============================================

import { useState, useEffect } from 'react'
import {
  fetchWeatherForecast,
  getCountryCoordinates,
  getWeatherInfo,
  isRainyWeather,
  type DayWeather,
} from '@/services/weatherService'

interface WeatherBadgeProps {
  country: string
  date: string // YYYY-MM-DD
  compact?: boolean
}

export function WeatherBadge({ country, date, compact = false }: WeatherBadgeProps) {
  const [weather, setWeather] = useState<DayWeather | null>(null)

  useEffect(() => {
    const coords = getCountryCoordinates(country)
    if (!coords) return

    // Only fetch for dates within 16 days (Open-Meteo limit)
    const targetDate = new Date(date)
    const now = new Date()
    const diffDays = Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < -1 || diffDays > 15) return

    let cancelled = false
    fetchWeatherForecast(coords.lat, coords.lon, date, date)
      .then((forecast) => {
        if (!cancelled && forecast.daily.length > 0) {
          setWeather(forecast.daily[0])
        }
      })
      .catch(() => {/* silently fail */})

    return () => { cancelled = true }
  }, [country, date])

  if (!weather) return null

  const info = getWeatherInfo(weather.weatherCode)
  const rainy = isRainyWeather(weather.weatherCode)

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs ${
          rainy ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'
        }`}
        title={`${info.description} ${weather.temperatureMin}°~${weather.temperatureMax}°C`}
      >
        <span>{info.icon}</span>
        <span>{weather.temperatureMax}°</span>
      </span>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium ${
        rainy
          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
      }`}
    >
      <span className="text-sm">{info.icon}</span>
      <span>{info.description}</span>
      <span>{weather.temperatureMin}°~{weather.temperatureMax}°C</span>
      {weather.precipitationProbability > 30 && (
        <span className="text-blue-500">💧 {weather.precipitationProbability}%</span>
      )}
    </div>
  )
}
