import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Clock,
  MapPin,
  Phone,
  Globe,
  Star,
  RefreshCw,
  Trash2,
  ExternalLink,
  Volume2,
  Edit,
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { Icon, divIcon } from 'leaflet'
import { Card, CardContent } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge, PlanTypeBadge } from '@/components/ui/Badge'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { AudioPlayer } from '@/components/audio'
import { MemoRenderer } from '@/components/memo'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { useCurrentTrip, useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import { formatTime } from '@/utils/format'
import { formatRating, formatReviewCount, extractPlaceInfo } from '@/services/googleMaps'
import { PLAN_TYPE_ICONS } from '@/utils/constants'
import {
  Camera,
  Utensils,
  Bed,
  Bus,
  Car,
  Plane,
  PlaneTakeoff,
  MapPin as DefaultMapPin,
  type LucideIcon,
} from 'lucide-react'
import type { Plan } from '@/types'

// Fix Leaflet default marker icon issue
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const iconMap: Record<string, LucideIcon> = {
  Camera,
  Utensils,
  Bed,
  Bus,
  Car,
  Plane,
  PlaneTakeoff,
  MapPin: DefaultMapPin,
}

export function DayDetail() {
  const { id, day } = useParams<{ id: string; day: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const plans = useCurrentPlans()
  const isLoading = useTripLoading()
  const loadTrip = useTripStore((state) => state.loadTrip)
  const deletePlan = useTripStore((state) => state.deletePlan)
  const updatePlan = useTripStore((state) => state.updatePlan)

  const [planToDelete, setPlanToDelete] = useState<number | null>(null)
  const [refreshingPlanId, setRefreshingPlanId] = useState<number | null>(null)

  const dayNumber = day ? Number.parseInt(day) : 1

  useEffect(() => {
    if (id) {
      loadTrip(Number.parseInt(id))
    }
  }, [id, loadTrip])

  // Filter plans for this day only
  const dayPlans = useMemo(() => {
    return plans
      .filter((p) => p.day === dayNumber)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [plans, dayNumber])

  // Plans with coordinates for map
  const plansWithCoords = useMemo(() => {
    return dayPlans.filter((p) => p.latitude && p.longitude)
  }, [dayPlans])

  // Calculate map center
  const mapCenter = useMemo(() => {
    if (plansWithCoords.length === 0) return { lat: 37.5665, lng: 126.978 }
    const lats = plansWithCoords.map((p) => p.latitude!)
    const lngs = plansWithCoords.map((p) => p.longitude!)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  }, [plansWithCoords])

  // Route positions for polyline
  const routePositions = useMemo(() => {
    return plansWithCoords.map((p) => [p.latitude!, p.longitude!] as [number, number])
  }, [plansWithCoords])

  // Calculate day date
  const dayDate = useMemo(() => {
    if (!trip) return null
    const date = new Date(trip.startDate)
    date.setDate(date.getDate() + dayNumber - 1)
    return date
  }, [trip, dayNumber])

  // Marker colors by type
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

  const createCustomMarker = (type: string, index: number) => {
    const color = getMarkerColor(type)
    return divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 28px;
          height: 28px;
          background: ${color};
          border: 2px solid white;
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
            font-size: 11px;
            font-weight: bold;
          ">${index + 1}</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    })
  }

  const handleDeletePlan = async () => {
    if (planToDelete) {
      await deletePlan(planToDelete)
      toast.success('일정이 삭제되었습니다')
    }
    setPlanToDelete(null)
  }

  const handleRefreshGoogleInfo = async (plan: Plan) => {
    if (!plan.mapUrl || !plan.id) return

    setRefreshingPlanId(plan.id)
    try {
      const extracted = await extractPlaceInfo(plan.mapUrl)
      await updatePlan(plan.id, {
        ...plan,
        address: extracted.address || plan.address,
        latitude: extracted.latitude || plan.latitude,
        longitude: extracted.longitude || plan.longitude,
        website: extracted.website || plan.website,
        googlePlaceId: extracted.googleInfo.placeId,
        googleInfo: extracted.googleInfo,
      })
      toast.success('장소 정보가 업데이트되었습니다')
    } catch (error) {
      toast.error('정보 업데이트에 실패했습니다')
    } finally {
      setRefreshingPlanId(null)
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton height={60} className="rounded-xl" />
          <Skeleton height={200} className="rounded-xl" />
          <Skeleton height={300} className="rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!trip) {
    return (
      <PageContainer>
        <Card padding="lg" className="text-center">
          <MapPin className="size-12 mx-auto text-zinc-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">여행을 찾을 수 없습니다</h2>
          <Button to="/dashboard" color="primary">
            대시보드로 이동
          </Button>
        </Card>
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Day {dayNumber}</h1>
          {dayDate && (
            <p className="text-sm text-zinc-500">
              {dayDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
          )}
        </div>
        <Badge color="primary" size="md">
          {dayPlans.length}개 장소
        </Badge>
      </div>

      {/* Mini Map */}
      {plansWithCoords.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="h-48 sm:h-56">
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
              dragging={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {routePositions.length > 1 && (
                <Polyline
                  positions={routePositions}
                  pathOptions={{
                    color: '#2effb4',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '8, 8',
                  }}
                />
              )}
              {plansWithCoords.map((plan, index) => (
                <Marker
                  key={plan.id}
                  position={[plan.latitude!, plan.longitude!]}
                  icon={createCustomMarker(plan.type, index)}
                >
                  <Popup>
                    <div className="min-w-[160px]">
                      <h3 className="font-semibold text-zinc-900">{plan.placeName}</h3>
                      <p className="text-sm text-zinc-500">{formatTime(plan.startTime)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>
      )}

      {/* Plans Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">일정</h2>
          <Button
            to={`/trips/${trip.id}/plans/new?day=${dayNumber}`}
            size="sm"
            color="primary"
            leftIcon={<Plus className="size-4" />}
          >
            일정 추가
          </Button>
        </div>

        {dayPlans.length === 0 ? (
          <Card padding="lg" className="text-center">
            <Clock className="size-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500 mb-4">이 날에 등록된 일정이 없습니다</p>
            <Button
              to={`/trips/${trip.id}/plans/new?day=${dayNumber}`}
              color="primary"
              leftIcon={<Plus className="size-4" />}
            >
              첫 일정 추가하기
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {dayPlans.map((plan, index) => {
              const iconName = PLAN_TYPE_ICONS[plan.type]
              const PlanIcon = iconMap[iconName] || DefaultMapPin
              const hasGoogleInfo = plan.googleInfo && (plan.googleInfo.rating || plan.googleInfo.phone)

              return (
                <Card key={plan.id} padding="none" className="overflow-hidden group">
                  <div className="p-4">
                    {/* Plan Header */}
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center flex-shrink-0">
                        <PlanIcon className="size-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge color="zinc" size="sm">
                            {index + 1}
                          </Badge>
                          <Link
                            to={`/trips/${trip.id}/plans/${plan.id}`}
                            className="font-semibold text-[var(--foreground)] hover:text-primary-600 transition-colors"
                          >
                            {plan.placeName}
                          </Link>
                          <PlanTypeBadge type={plan.type} />
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                          <Clock className="size-3.5" />
                          <span>{formatTime(plan.startTime)}</span>
                          {plan.endTime && <span>- {formatTime(plan.endTime)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {plan.mapUrl && (
                          <IconButton
                            plain
                            color="secondary"
                            onClick={() => handleRefreshGoogleInfo(plan)}
                            disabled={refreshingPlanId === plan.id}
                            aria-label="정보 새로고침"
                          >
                            <RefreshCw
                              className={`size-4 ${refreshingPlanId === plan.id ? 'animate-spin' : ''}`}
                            />
                          </IconButton>
                        )}
                        <Link to={`/trips/${trip.id}/plans/${plan.id}/edit`}>
                          <IconButton
                            plain
                            color="secondary"
                            aria-label="편집"
                          >
                            <Edit className="size-4" />
                          </IconButton>
                        </Link>
                        <IconButton
                          plain
                          color="danger"
                          onClick={() => setPlanToDelete(plan.id!)}
                          aria-label="삭제"
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </div>

                    {/* Address */}
                    {plan.address && (
                      <div className="flex items-start gap-2 mt-3 text-sm text-zinc-500">
                        <MapPin className="size-4 flex-shrink-0 mt-0.5" />
                        <span>{plan.address}</span>
                      </div>
                    )}

                    {/* Google Info */}
                    {hasGoogleInfo && (
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex flex-wrap gap-3 text-sm">
                          {plan.googleInfo?.rating && (
                            <div className="flex items-center gap-1.5 text-amber-600">
                              <Star className="size-4 fill-current" />
                              <span className="font-medium">{plan.googleInfo.rating.toFixed(1)}</span>
                              {plan.googleInfo.reviewCount && (
                                <span className="text-zinc-400">
                                  ({formatReviewCount(plan.googleInfo.reviewCount)})
                                </span>
                              )}
                            </div>
                          )}
                          {plan.googleInfo?.phone && (
                            <a
                              href={`tel:${plan.googleInfo.phone}`}
                              className="flex items-center gap-1.5 text-zinc-500 hover:text-primary-600 transition-colors"
                            >
                              <Phone className="size-4" />
                              <span>{plan.googleInfo.phone}</span>
                            </a>
                          )}
                          {(plan.googleInfo?.website || plan.website) && (
                            <a
                              href={plan.googleInfo?.website || plan.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-zinc-500 hover:text-primary-600 transition-colors"
                            >
                              <Globe className="size-4" />
                              <span>웹사이트</span>
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                        {plan.googleInfo?.openingHours && plan.googleInfo.openingHours.length > 0 && (
                          <div className="mt-2 text-sm text-zinc-500">
                            <div className="flex items-start gap-1.5">
                              <Clock className="size-4 flex-shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                {plan.googleInfo.openingHours.slice(0, 2).map((hour, i) => (
                                  <div key={i}>{hour}</div>
                                ))}
                                {plan.googleInfo.openingHours.length > 2 && (
                                  <div className="text-zinc-400">...</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {plan.googleInfo?.category && (
                          <div className="mt-2">
                            <Badge color="zinc" size="sm">
                              {plan.googleInfo.category}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Memo */}
                    {plan.memo && (
                      <div className="mt-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                        <MemoRenderer content={plan.memo} />
                      </div>
                    )}

                    {/* Moonyou Guide Audio */}
                    {plan.audioScript && (
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 className="size-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                            Moonyou Guide
                          </span>
                        </div>
                        <AudioPlayer text={plan.audioScript} compact />
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Plan Dialog */}
      <Dialog open={planToDelete !== null} onClose={() => setPlanToDelete(null)}>
        <DialogTitle onClose={() => setPlanToDelete(null)}>일정 삭제</DialogTitle>
        <DialogBody>
          <p className="text-zinc-600 dark:text-zinc-400">이 일정을 삭제하시겠습니까?</p>
        </DialogBody>
        <DialogActions>
          <Button color="secondary" onClick={() => setPlanToDelete(null)}>
            취소
          </Button>
          <Button color="danger" onClick={handleDeletePlan}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
      </div>
    </PageContainer>
  )
}
