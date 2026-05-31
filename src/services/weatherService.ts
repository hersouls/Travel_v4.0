// ============================================
// Weather Service (Open-Meteo API)
// Free, no API key required
// ============================================

export interface DayWeather {
  date: string
  temperatureMax: number
  temperatureMin: number
  weatherCode: number
  precipitationProbability: number
  windSpeedMax: number
}

export interface WeatherForecast {
  daily: DayWeather[]
  timezone: string
}

// WMO Weather codes → description + icon
const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: '맑음', icon: '☀️' },
  1: { description: '대체로 맑음', icon: '🌤️' },
  2: { description: '구름 조금', icon: '⛅' },
  3: { description: '흐림', icon: '☁️' },
  45: { description: '안개', icon: '🌫️' },
  48: { description: '서리 안개', icon: '🌫️' },
  51: { description: '이슬비', icon: '🌦️' },
  53: { description: '이슬비', icon: '🌦️' },
  55: { description: '이슬비', icon: '🌦️' },
  61: { description: '약한 비', icon: '🌧️' },
  63: { description: '비', icon: '🌧️' },
  65: { description: '강한 비', icon: '🌧️' },
  71: { description: '약한 눈', icon: '🌨️' },
  73: { description: '눈', icon: '🌨️' },
  75: { description: '강한 눈', icon: '❄️' },
  80: { description: '소나기', icon: '🌦️' },
  81: { description: '소나기', icon: '🌦️' },
  82: { description: '강한 소나기', icon: '⛈️' },
  95: { description: '뇌우', icon: '⛈️' },
  96: { description: '우박 뇌우', icon: '⛈️' },
  99: { description: '강한 우박 뇌우', icon: '⛈️' },
}

export function getWeatherInfo(code: number): { description: string; icon: string } {
  return WEATHER_CODES[code] || { description: '알 수 없음', icon: '❓' }
}

export function isRainyWeather(code: number): boolean {
  return code >= 51 && code <= 99
}

/**
 * Fetch weather forecast for given coordinates and date range
 * Uses Open-Meteo free API (no key needed)
 */
export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  timezone: string = 'auto'
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    start_date: startDate,
    end_date: endDate,
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max',
    timezone,
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  let response: Response
  try {
    response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`)
  }

  const data = await response.json()

  const daily: DayWeather[] = (data.daily.time as string[])
    .map((date: string, i: number): DayWeather | null => {
      const tMax = data.daily.temperature_2m_max[i]
      const tMin = data.daily.temperature_2m_min[i]
      // null(예보 없는 날)을 0°C로 강제 변환하지 않고 해당 날짜를 제외
      if (tMax == null || tMin == null) return null
      return {
        date,
        temperatureMax: Math.round(tMax),
        temperatureMin: Math.round(tMin),
        weatherCode: data.daily.weather_code[i] ?? 0,
        precipitationProbability: data.daily.precipitation_probability_max[i] || 0,
        windSpeedMax: Math.round(data.daily.wind_speed_10m_max[i] ?? 0),
      }
    })
    .filter((d): d is DayWeather => d !== null)

  return { daily, timezone: data.timezone }
}

/**
 * Get approximate coordinates for a country name
 * Simplified mapping for common travel destinations
 */
export function getCountryCoordinates(country: string): { lat: number; lon: number } | null {
  const coords: Record<string, { lat: number; lon: number }> = {
    '대한민국': { lat: 37.5665, lon: 126.978 },
    '한국': { lat: 37.5665, lon: 126.978 },
    '일본': { lat: 35.6762, lon: 139.6503 },
    '중국': { lat: 39.9042, lon: 116.4074 },
    '대만': { lat: 25.033, lon: 121.5654 },
    '태국': { lat: 13.7563, lon: 100.5018 },
    '베트남': { lat: 21.0285, lon: 105.8542 },
    '싱가포르': { lat: 1.3521, lon: 103.8198 },
    '미국': { lat: 40.7128, lon: -74.006 },
    '영국': { lat: 51.5074, lon: -0.1278 },
    '프랑스': { lat: 48.8566, lon: 2.3522 },
    '독일': { lat: 52.52, lon: 13.405 },
    '이탈리아': { lat: 41.9028, lon: 12.4964 },
    '스페인': { lat: 40.4168, lon: -3.7038 },
    '호주': { lat: -33.8688, lon: 151.2093 },
    '캐나다': { lat: 43.6532, lon: -79.3832 },
    '인도네시아': { lat: -6.2088, lon: 106.8456 },
    '필리핀': { lat: 14.5995, lon: 120.9842 },
    '말레이시아': { lat: 3.139, lon: 101.6869 },
    '터키': { lat: 41.0082, lon: 28.9784 },
    '그리스': { lat: 37.9838, lon: 23.7275 },
    '포르투갈': { lat: 38.7223, lon: -9.1393 },
    '스위스': { lat: 46.9481, lon: 7.4474 },
    '오스트리아': { lat: 48.2082, lon: 16.3738 },
    '체코': { lat: 50.0755, lon: 14.4378 },
    '크로아티아': { lat: 45.815, lon: 15.9819 },
    '멕시코': { lat: 19.4326, lon: -99.1332 },
    '브라질': { lat: -23.5505, lon: -46.6333 },
    '아르헨티나': { lat: -34.6037, lon: -58.3816 },
    '뉴질랜드': { lat: -36.8485, lon: 174.7633 },
    '이집트': { lat: 30.0444, lon: 31.2357 },
    '모로코': { lat: 33.9716, lon: -6.8498 },
  }

  return coords[country] || null
}
