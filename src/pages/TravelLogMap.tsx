// ============================================
// TravelLog Map Page
// Full-page map view of travel log entries
// with day filter, track lines, clustering,
// photo map mode, and heatmap
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Image, Map, Route, Flame } from 'lucide-react'
import { IconButton, Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { TravelLogMapView } from '@/components/map/TravelLogMapView'
import { useCurrentTrip, useTripLoading, useTripStore } from '@/stores/tripStore'
import { useTravelLogs, useTravelLogLoading, useTravelLogStore } from '@/stores/travelLogStore'
import { getTripDuration } from '@/utils/format'
import { loadGoogleMaps } from '@/services/googleMapsLoader'

export function TravelLogMap() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const isLoadingTrip = useTripLoading()
  const loadTrip = useTripStore((s) => s.loadTrip)

  const logs = useTravelLogs()
  const isLoadingLogs = useTravelLogLoading()
  const loadLogs = useTravelLogStore((s) => s.loadLogs)
  const clearLogs = useTravelLogStore((s) => s.clearLogs)

  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showTrackLine, setShowTrackLine] = useState(true)
  const [showPhotoMap, setShowPhotoMap] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)

  const tripId = id ? Number.parseInt(id) : 0

  useEffect(() => {
    if (tripId) {
      loadTrip(tripId)
      loadLogs(tripId)
    }
    return () => clearLogs()
  }, [tripId, loadTrip, loadLogs, clearLogs])

  // Auto-repair past entries with NaN/missing coordinates by forward-geocoding address/placeName
  const repairAttempted = useRef(new Set<number>())
  useEffect(() => {
    if (!tripId || isLoadingLogs) return

    // Read logs from store imperatively (avoid reactive dependency on logs array)
    const currentLogs = useTravelLogStore.getState().logs

    // CRITICAL: Don't mark as attempted if logs haven't loaded yet.
    // On first render, isLoadingLogs is false (initial state) but logs are empty.
    // We must wait until loadLogs completes and populates the store.
    if (currentLogs.length === 0) return

    if (repairAttempted.current.has(tripId)) return
    repairAttempted.current.add(tripId)

    const needsRepair = currentLogs.filter((l) => {
      const hasValidCoords =
        typeof l.latitude === 'number' && typeof l.longitude === 'number' &&
        isFinite(l.latitude) && isFinite(l.longitude)
      return !hasValidCoords && !!(l.address || l.placeName)
    })

    console.log(`[TravelLogMap] Coordinate check: ${currentLogs.length} total, ${needsRepair.length} need repair`)

    if (needsRepair.length === 0) return

    const repair = async () => {
      try {
        const updateLog = useTravelLogStore.getState().updateLog
        let count = 0
        let failCount = 0

        // Phase 1: Parse coordinate-like strings directly (no API needed)
        const stillNeedsGeocode: typeof needsRepair = []
        for (const log of needsRepair) {
          const query = log.placeName || log.address
          if (!query) continue

          // Try parsing "lat, lng" patterns (e.g., "13.7420, 100.5518")
          const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
          if (coordMatch) {
            const lat = parseFloat(coordMatch[1])
            const lng = parseFloat(coordMatch[2])
            if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
              await updateLog(log.id!, { latitude: lat, longitude: lng })
              count++
              continue
            }
          }
          stillNeedsGeocode.push(log)
        }

        // Phase 2: Forward geocode remaining entries (requires API)
        if (stillNeedsGeocode.length > 0) {
          try {
            const google = await loadGoogleMaps()
            if (!google.maps.Geocoder) {
              await google.maps.importLibrary('geocoding')
            }
            const { forwardGeocode, isGeocodingDenied } = await import('@/services/geocodingService')

            for (const log of stillNeedsGeocode) {
              if (isGeocodingDenied()) {
                failCount += stillNeedsGeocode.length - (count - (needsRepair.length - stillNeedsGeocode.length)) - failCount
                break
              }

              const query = log.placeName || log.address
              if (!query) continue
              try {
                const result = await forwardGeocode(query)
                if (result) {
                  await updateLog(log.id!, { latitude: result.lat, longitude: result.lng })
                  count++
                } else {
                  failCount++
                }
              } catch {
                failCount++
              }
            }
          } catch {
            failCount += stillNeedsGeocode.length
          }
        }

        if (count > 0) {
          console.log(`[TravelLogMap] ${count}/${needsRepair.length}개 좌표 복구 완료`)
        }
        if (failCount > 0) {
          console.warn(`[TravelLogMap] ${failCount}/${needsRepair.length}개 좌표 복구 실패 (Geocoding API 상태 확인 필요)`)
        }
      } catch (e) {
        console.warn('[TravelLogMap] Coordinate repair skipped:', e)
      }
    }

    repair()
  }, [tripId, isLoadingLogs])

  const totalDays = useMemo(() => {
    if (!trip) return 0
    return getTripDuration(trip.startDate, trip.endDate)
  }, [trip])

  const logsWithCoords = useMemo(
    () => logs.filter((l) =>
      typeof l.latitude === 'number' && typeof l.longitude === 'number' &&
      isFinite(l.latitude) && isFinite(l.longitude),
    ),
    [logs],
  )

  if (isLoadingTrip || isLoadingLogs) {
    return (
      <PageContainer fullHeight>
        <div className="flex-1 p-4">
          <Skeleton height="100%" className="rounded-xl" />
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
    <PageContainer fullHeight>
      <div className="flex flex-col h-full p-4 space-y-3 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기">
              <ArrowLeft className="size-5" />
            </IconButton>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[var(--foreground)]">여행 기록 지도</h1>
              <p className="text-xs text-zinc-500">
                {trip.title} · {logsWithCoords.length}개 위치
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Track line toggle */}
            <button
              type="button"
              onClick={() => { setShowTrackLine((p) => !p); setShowHeatmap(false) }}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                showTrackLine && !showHeatmap
                  ? 'bg-primary-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title="경로 표시"
            >
              <Route className="size-3.5" />
              <span className="hidden sm:inline">경로</span>
            </button>

            {/* Photo map toggle */}
            <button
              type="button"
              onClick={() => setShowPhotoMap((p) => !p)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                showPhotoMap
                  ? 'bg-violet-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title="포토맵"
            >
              <Image className="size-3.5" />
              <span className="hidden sm:inline">포토맵</span>
            </button>

            {/* Heatmap toggle */}
            <button
              type="button"
              onClick={() => {
                setShowHeatmap((p) => {
                  if (!p) setShowTrackLine(false)
                  return !p
                })
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                showHeatmap
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title="히트맵"
            >
              <Flame className="size-3.5" />
              <span className="hidden sm:inline">히트맵</span>
            </button>

            {/* Back to log list */}
            <Button
              to={`/trips/${trip.id}/log`}
              outline
              color="secondary"
              size="sm"
              leftIcon={<Map className="size-3.5" />}
            >
              목록
            </Button>
          </div>
        </div>

        {/* Day filter tabs */}
        {totalDays > 0 && (
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                selectedDay === null
                  ? 'bg-primary/10 text-primary'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              전체
            </button>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                  selectedDay === day
                    ? 'bg-primary/10 text-primary'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Day {day}
              </button>
            ))}
          </div>
        )}

        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden ring-1 ring-zinc-950/5 dark:ring-white/10 mb-16 lg:mb-0">
          {logsWithCoords.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
              <div className="text-center">
                <p className="text-zinc-500 mb-4">위치 정보가 있는 기록이 없습니다</p>
                <Button to={`/trips/${trip.id}/log`} color="primary">
                  기록 추가하기
                </Button>
              </div>
            </div>
          ) : (
            <TravelLogMapView
              logs={logs}
              selectedDay={selectedDay}
              className="h-full w-full"
              showTrackLine={showTrackLine}
              showPhotoMap={showPhotoMap}
              showHeatmap={showHeatmap}
            />
          )}
        </div>
      </div>
    </PageContainer>
  )
}
