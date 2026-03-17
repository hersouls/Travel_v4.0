// ============================================
// Weather Tool (WeatherAPI.com)
// Returns null if WEATHERAPI_KEY not set
// ============================================

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export function createWeatherTool() {
  const apiKey = process.env.WEATHERAPI_KEY
  if (!apiKey) return null

  return new DynamicStructuredTool({
    name: 'get_weather',
    description: '특정 도시의 현재 날씨와 일기예보를 조회합니다. 여행 날씨 관련 질문에 사용하세요.',
    schema: z.object({
      city: z.string().describe('도시 이름 (영어, 예: Tokyo, Bangkok, Paris)'),
      days: z.number().min(1).max(7).default(3).describe('예보 일수 (1-7일)'),
    }),
    func: async ({ city, days }) => {
      try {
        const res = await fetch(
          `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=${days}&lang=ko`
        )
        if (!res.ok) return `${city}의 날씨 정보를 가져올 수 없습니다.`
        const data = await res.json()

        const current = data.current
        const forecast = data.forecast?.forecastday || []

        const parts = [
          `📍 ${data.location.name}, ${data.location.country}`,
          `🌡 현재: ${current.temp_c}°C, ${current.condition.text}`,
          `💧 습도: ${current.humidity}%`,
          '',
          '📅 예보:',
        ]

        for (const day of forecast) {
          parts.push(
            `  ${day.date}: ${day.day.mintemp_c}~${day.day.maxtemp_c}°C, ${day.day.condition.text}, 강수확률 ${day.day.daily_chance_of_rain}%`
          )
        }

        return parts.join('\n')
      } catch (err) {
        return `날씨 조회 오류: ${err instanceof Error ? err.message : 'unknown'}`
      }
    },
  })
}
