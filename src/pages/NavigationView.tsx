// ============================================
// Real-time Navigation View
// ============================================

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Navigation, MapPin, Loader2, AlertTriangle } from 'lucide-react'
import { IconButton, Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageContainer } from '@/components/layout'
import { useCurrentTrip, useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

const TRAVEL_SPEEDS: Record<string, number> = {
  DRIVE: 40,
  WALK: 5,
  TRANSIT: 30,
  BICYCLE: 15,
}

function formatETA(meters: number, speedKmh = 4.5): string {
  const hours = meters / 1000 / speedKmh
  const mins = Math.round(hours * 60)
  if (mins < 1) return '곧 도착'
  if (mins >= 60) return `${Math.floor(mins / 60)}시간 ${mins % 60}분`
  return `${mins}분`
}

export function NavigationView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const plans = useCurrentPlans()
  const isLoading = useTripLoading()
  const loadTrip = useTripStore((state) => state.loadTrip)
  const defaultTravelMode = useSettingsStore((state) => state.defaultTravelMode) || 'DRIVE'
  const travelSpeed = TRAVEL_SPEEDS[defaultTravelMode] || 40

  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (id) loadTrip(parseInt(id))
  }, [id, loadTrip])

  // Filter plans with coords, sorted by day + time
  const sortedPlans = useMemo(() => {
    return plans
      .filter((p) => p.latitude && p.longitude)
      .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime))
  }, [plans])

  // Start geolocation tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('이 브라우저에서 위치 서비스를 사용할 수 없습니다')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        })
        setGeoError(null)
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError('위치 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.')
            break
          case err.POSITION_UNAVAILABLE:
            setGeoError('위치 정보를 가져올 수 없습니다')
            break
          default:
            setGeoError('위치 추적 중 오류가 발생했습니다')
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Auto-advance to next target when close enough (50m)
  useEffect(() => {
    if (!position || sortedPlans.length === 0) return
    const target = sortedPlans[currentTargetIndex]
    if (!target) return

    const dist = haversineDistance(
      position.lat,
      position.lng,
      target.latitude!,
      target.longitude!,
    )

    if (dist < 50 && currentTargetIndex < sortedPlans.length - 1) {
      setCurrentTargetIndex((prev) => prev + 1)
    }
  }, [position, sortedPlans, currentTargetIndex])

  const currentTarget = sortedPlans[currentTargetIndex]
  const distanceToTarget =
    position && currentTarget
      ? haversineDistance(
          position.lat,
          position.lng,
          currentTarget.latitude!,
          currentTarget.longitude!,
        )
      : null

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="size-8 animate-spin text-zinc-400" />
        </div>
      </PageContainer>
    )
  }

  if (!trip) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-zinc-500">여행을 찾을 수 없습니다</p>
          <Button to="/dashboard" color="primary" className="mt-4">
            대시보드로 이동
          </Button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <ArrowLeft className="size-5" />
          </IconButton>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--foreground)]">내비게이션</h1>
            <p className="text-sm text-zinc-500">{trip.title}</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20">
            <div className={`size-2 rounded-full ${position ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">
              {position ? 'GPS 활성' : 'GPS 대기 중'}
            </span>
          </div>
        </div>

        {/* Error */}
        {geoError && (
          <Card padding="md" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{geoError}</p>
            </div>
          </Card>
        )}

        {/* Current Target */}
        {currentTarget && (
          <Card padding="lg" className="text-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/20">
                <Navigation className="size-5 text-primary-600 dark:text-primary-400" />
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  다음 목적지
                </span>
              </div>

              <h2 className="text-2xl font-bold text-[var(--foreground)]">
                {currentTarget.placeName}
              </h2>

              {currentTarget.address && (
                <p className="text-sm text-zinc-500">{currentTarget.address}</p>
              )}

              {distanceToTarget !== null && (
                <div className="flex justify-center gap-6">
                  <div>
                    <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      {formatDistance(distanceToTarget)}
                    </p>
                    <p className="text-xs text-zinc-500">남은 거리</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {formatETA(distanceToTarget, travelSpeed)}
                    </p>
                    <p className="text-xs text-zinc-500">예상 도착</p>
                  </div>
                </div>
              )}

              {/* Open in Google Maps */}
              <Button
                color="primary"
                size="sm"
                onClick={() => {
                  const gmapMode = defaultTravelMode === 'WALK' ? 'walking'
                    : defaultTravelMode === 'TRANSIT' ? 'transit'
                    : defaultTravelMode === 'BICYCLE' ? 'bicycling'
                    : 'driving'
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${currentTarget.latitude},${currentTarget.longitude}&travelmode=${gmapMode}`
                  window.open(url, '_blank')
                }}
              >
                Google Maps로 길찾기
              </Button>
            </div>
          </Card>
        )}

        {/* Plan List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500">전체 경로</p>
          {sortedPlans.map((plan, index) => {
            const isCurrent = index === currentTargetIndex
            const isPast = index < currentTargetIndex
            const dist =
              position && plan.latitude && plan.longitude
                ? haversineDistance(position.lat, position.lng, plan.latitude, plan.longitude)
                : null

            return (
              <div
                key={plan.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isCurrent
                    ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500'
                    : isPast
                      ? 'bg-zinc-50 dark:bg-zinc-800/30 opacity-50'
                      : 'bg-zinc-50 dark:bg-zinc-800/50'
                }`}
                onClick={() => setCurrentTargetIndex(index)}
              >
                <span
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isCurrent
                      ? 'bg-primary-500 text-white'
                      : isPast
                        ? 'bg-zinc-300 dark:bg-zinc-600 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {isPast ? '✓' : index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isCurrent ? 'text-primary-700 dark:text-primary-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {plan.placeName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Day {plan.day} · {plan.startTime}
                  </p>
                </div>
                {dist !== null && (
                  <span className="text-xs text-zinc-400 flex-shrink-0">
                    {formatDistance(dist)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Accuracy Info */}
        {position && (
          <p className="text-xs text-zinc-400 text-center">
            GPS 정확도: ±{Math.round(position.accuracy)}m
          </p>
        )}
      </div>
    </PageContainer>
  )
}
