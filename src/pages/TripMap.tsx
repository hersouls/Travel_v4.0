import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, List } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { Icon, divIcon } from 'leaflet'
import { IconButton, Button } from '@/components/ui/Button'
import { Badge, PlanTypeBadge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { GoogleMapView } from '@/components/map/GoogleMapView'
import { MapProviderSwitch } from '@/components/map/MapProviderSwitch'
import { useCurrentTrip, useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDirections } from '@/hooks/useDirections'
import { formatTime } from '@/utils/format'
import { getTripDurationSafe } from '@/utils/timezone'
import type { MapProvider, TravelMode } from '@/types'

// Fix Leaflet default marker icon issue
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export function TripMap() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const plans = useCurrentPlans()
  const isLoading = useTripLoading()
  const loadTrip = useTripStore((state) => state.loadTrip)

  const savedMapProvider = useSettingsStore((state) => state.mapProvider) as MapProvider || 'google'
  const defaultTravelMode = useSettingsStore((state) => state.defaultTravelMode) as TravelMode || 'DRIVE'

  const [mapProvider, setMapProvider] = useState<MapProvider>(savedMapProvider)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const tripId = trip?.id || 0
  const { segments: routeSegments } = useDirections(plans, tripId, defaultTravelMode)

  useEffect(() => {
    if (id) {
      loadTrip(parseInt(id))
    }
  }, [id, loadTrip])

  const totalDays = useMemo(() => {
    if (!trip) return 0
    return getTripDurationSafe(trip.startDate, trip.endDate)
  }, [trip])

  // Filter plans with coordinates
  const plansWithCoords = useMemo(() => {
    return plans.filter((p) => {
      if (!p.latitude || !p.longitude) return false
      if (selectedDay != null && p.day !== selectedDay) return false
      return true
    })
  }, [plans, selectedDay])

  // Calculate center and bounds
  const mapCenter = useMemo(() => {
    if (plansWithCoords.length === 0) return { lat: 37.5665, lng: 126.978 }
    const lats = plansWithCoords.map((p) => p.latitude!)
    const lngs = plansWithCoords.map((p) => p.longitude!)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  }, [plansWithCoords])

  // Create polyline for Leaflet
  const routePositions = useMemo(() => {
    return plansWithCoords
      .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime))
      .map((p) => [p.latitude!, p.longitude!] as [number, number])
  }, [plansWithCoords])

  // Custom marker colors by type
  const getMarkerColor = (type: string) => {
    const colors: Record<string, string> = {
      attraction: '#8b5cf6',
      restaurant: '#f97316',
      hotel: '#3b82f6',
      transport: '#6b7280',
      car: '#84cc16',
      plane: '#06b6d4',
      airport: '#0ea5e9',
      other: '#a1a1aa',
    }
    return colors[type] || '#a1a1aa'
  }

  const createCustomMarker = (type: string, day: number) => {
    const color = getMarkerColor(type)
    return divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-size: 12px;
            font-weight: bold;
          ">${day}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
  }

  if (isLoading) {
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
      <div className="flex flex-col h-full p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <ArrowLeft className="size-5" />
          </IconButton>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">{trip.title} 지도</h1>
            <p className="text-sm text-zinc-500">{plansWithCoords.length}개 장소</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MapProviderSwitch value={mapProvider} onChange={setMapProvider} />
          <Button to={`/trips/${trip.id}`} outline color="secondary" size="sm" leftIcon={<List className="size-4" />}>
            목록
          </Button>
        </div>
      </div>

      {/* Day Filter Tabs */}
      {totalDays > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
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
        {plansWithCoords.length === 0 ? (
          <div className="h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
            <div className="text-center">
              <p className="text-zinc-500 mb-4">위치 정보가 있는 일정이 없습니다</p>
              <Button to={`/trips/${trip.id}`} color="primary">
                일정 추가하기
              </Button>
            </div>
          </div>
        ) : mapProvider === 'google' ? (
          <GoogleMapView
            plans={plans}
            routeSegments={routeSegments}
            center={mapCenter}
            className="h-full w-full"
            selectedDay={selectedDay}
          />
        ) : (
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Route Polyline */}
            {routePositions.length > 1 && (
              <Polyline
                positions={routePositions}
                pathOptions={{
                  color: '#2effb4',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '10, 10',
                }}
              />
            )}

            {/* Markers */}
            {plansWithCoords.map((plan) => (
              <Marker
                key={plan.id}
                position={[plan.latitude!, plan.longitude!]}
                icon={createCustomMarker(plan.type, plan.day)}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge color="primary" size="sm">
                        Day {plan.day}
                      </Badge>
                      <PlanTypeBadge type={plan.type} />
                    </div>
                    <h3 className="font-semibold text-zinc-900">{plan.placeName}</h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {formatTime(plan.startTime)}
                      {plan.endTime && ` - ${formatTime(plan.endTime)}`}
                    </p>
                    {plan.address && (
                      <p className="text-sm text-zinc-400 mt-1">{plan.address}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
      </div>
    </PageContainer>
  )
}
