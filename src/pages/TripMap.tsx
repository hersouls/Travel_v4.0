import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, List } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { Icon, divIcon } from 'leaflet'
import { IconButton, Button } from '@/components/ui/Button'
import { Badge, PlanTypeBadge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCurrentTrip, useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { formatTime } from '@/utils/format'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// @ts-ignore
delete Icon.Default.prototype._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export function TripMap() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const plans = useCurrentPlans()
  const isLoading = useTripLoading()
  const loadTrip = useTripStore((state) => state.loadTrip)

  useEffect(() => {
    if (id) {
      loadTrip(parseInt(id))
    }
  }, [id, loadTrip])

  // Filter plans with coordinates
  const plansWithCoords = useMemo(() => {
    return plans.filter((p) => p.latitude && p.longitude)
  }, [plans])

  // Calculate center and bounds
  const mapCenter = useMemo(() => {
    if (plansWithCoords.length === 0) return { lat: 37.5665, lng: 126.978 } // Seoul default
    const lats = plansWithCoords.map((p) => p.latitude!)
    const lngs = plansWithCoords.map((p) => p.longitude!)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  }, [plansWithCoords])

  // Create polyline for routes
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
      <div className="h-[calc(100vh-8rem)]">
        <Skeleton height="100%" className="rounded-xl" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">여행을 찾을 수 없습니다</p>
        <Button to="/dashboard" color="primary" className="mt-4">
          대시보드로 이동
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
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
        <Button to={`/trips/${trip.id}`} outline color="secondary" size="sm" leftIcon={<List className="size-4" />}>
          목록 보기
        </Button>
      </div>

      {/* Map */}
      <div className="h-[calc(100vh-12rem)] rounded-xl overflow-hidden ring-1 ring-zinc-950/5 dark:ring-white/10">
        {plansWithCoords.length === 0 ? (
          <div className="h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
            <div className="text-center">
              <p className="text-zinc-500 mb-4">위치 정보가 있는 일정이 없습니다</p>
              <Button to={`/trips/${trip.id}`} color="primary">
                일정 추가하기
              </Button>
            </div>
          </div>
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
  )
}
