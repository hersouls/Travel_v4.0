import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Plus, Map, Star, Calendar, MapPin, Clock } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge, PlanTypeBadge } from '@/components/ui/Badge'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCurrentTrip, useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { useUIStore, toast } from '@/stores/uiStore'
import { formatDateRange, getTripDuration, formatTime } from '@/utils/format'
import { PLAN_TYPE_ICONS } from '@/utils/constants'
import * as LucideIcons from 'lucide-react'
import { useState } from 'react'

export function TripDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const plans = useCurrentPlans()
  const isLoading = useTripLoading()
  const loadTrip = useTripStore((state) => state.loadTrip)
  const deleteTrip = useTripStore((state) => state.deleteTrip)
  const toggleFavorite = useTripStore((state) => state.toggleFavorite)
  const deletePlan = useTripStore((state) => state.deletePlan)

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<number | null>(null)

  useEffect(() => {
    if (id) {
      loadTrip(parseInt(id))
    }
  }, [id, loadTrip])

  // Group plans by day
  const plansByDay = useMemo(() => {
    const grouped: Record<number, typeof plans> = {}
    for (const plan of plans) {
      if (!grouped[plan.day]) grouped[plan.day] = []
      grouped[plan.day].push(plan)
    }
    // Sort by start time within each day
    for (const day of Object.keys(grouped)) {
      grouped[parseInt(day)].sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return grouped
  }, [plans])

  const days = useMemo(() => {
    if (!trip) return []
    return Array.from({ length: getTripDuration(trip.startDate, trip.endDate) }, (_, i) => i + 1)
  }, [trip])

  const handleDeleteTrip = async () => {
    if (trip?.id) {
      await deleteTrip(trip.id)
      toast.success('여행이 삭제되었습니다')
      navigate('/dashboard')
    }
    setIsDeleteDialogOpen(false)
  }

  const handleDeletePlan = async () => {
    if (planToDelete) {
      await deletePlan(planToDelete)
      toast.success('일정이 삭제되었습니다')
    }
    setPlanToDelete(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton height={200} className="rounded-xl" />
        <Skeleton height={400} className="rounded-xl" />
      </div>
    )
  }

  if (!trip) {
    return (
      <Card padding="lg" className="text-center">
        <MapPin className="size-12 mx-auto text-zinc-300 mb-4" />
        <h2 className="text-lg font-semibold mb-2">여행을 찾을 수 없습니다</h2>
        <Button to="/dashboard" color="primary">
          대시보드로 이동
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <ArrowLeft className="size-5" />
        </IconButton>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{trip.title}</h1>
          <p className="text-sm text-zinc-500">{formatDateRange(trip.startDate, trip.endDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            plain
            color={trip.isFavorite ? 'warning' : 'secondary'}
            onClick={() => trip.id && toggleFavorite(trip.id)}
            aria-label={trip.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star className={`size-5 ${trip.isFavorite ? 'fill-current' : ''}`} />
          </IconButton>
          <IconButton plain color="secondary" to={`/trips/${trip.id}/edit`} aria-label="편집">
            <Edit className="size-5" />
          </IconButton>
          <IconButton plain color="danger" onClick={() => setIsDeleteDialogOpen(true)} aria-label="삭제">
            <Trash2 className="size-5" />
          </IconButton>
        </div>
      </div>

      {/* Trip Info Card */}
      <Card padding="none" className="overflow-hidden">
        {trip.coverImage && (
          <div className="h-48 sm:h-64">
            <img src={trip.coverImage} alt={trip.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-zinc-400" />
              <span className="text-sm">{trip.country}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-zinc-400" />
              <span className="text-sm">
                {getTripDuration(trip.startDate, trip.endDate)}일
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-zinc-400" />
              <span className="text-sm">{plans.length}개 일정</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              to={`/trips/${trip.id}/plans/new`}
              color="primary"
              size="sm"
              leftIcon={<Plus className="size-4" />}
            >
              일정 추가
            </Button>
            <Button
              to={`/trips/${trip.id}/map`}
              outline
              color="secondary"
              size="sm"
              leftIcon={<Map className="size-4" />}
            >
              지도 보기
            </Button>
          </div>
        </div>
      </Card>

      {/* Plans Timeline */}
      <div className="space-y-6">
        {days.map((day) => {
          const dayPlans = plansByDay[day] || []
          const dayDate = new Date(trip.startDate)
          dayDate.setDate(dayDate.getDate() + day - 1)

          return (
            <Card key={day} padding="md">
              <CardHeader
                title={`Day ${day}`}
                description={dayDate.toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
                action={
                  <Button
                    to={`/trips/${trip.id}/plans/new?day=${day}`}
                    size="xs"
                    outline
                    color="primary"
                    leftIcon={<Plus className="size-3" />}
                  >
                    추가
                  </Button>
                }
              />
              <CardContent>
                {dayPlans.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">일정이 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {dayPlans.map((plan) => {
                      const iconName = PLAN_TYPE_ICONS[plan.type] as keyof typeof LucideIcons
                      const Icon = LucideIcons[iconName] || LucideIcons.MapPin
                      return (
                        <Link
                          key={plan.id}
                          to={`/trips/${trip.id}/plans/${plan.id}`}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group"
                        >
                          <div className="size-10 rounded-lg bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center flex-shrink-0">
                            <Icon className="size-5 text-primary-600 dark:text-primary-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--foreground)] truncate">
                                {plan.placeName}
                              </span>
                              <PlanTypeBadge type={plan.type} />
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                              <Clock className="size-3" />
                              <span>{formatTime(plan.startTime)}</span>
                              {plan.endTime && <span>- {formatTime(plan.endTime)}</span>}
                            </div>
                            {plan.address && (
                              <p className="text-sm text-zinc-400 mt-1 truncate">{plan.address}</p>
                            )}
                          </div>
                          <IconButton
                            plain
                            color="danger"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setPlanToDelete(plan.id!)
                            }}
                            aria-label="삭제"
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Delete Trip Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle onClose={() => setIsDeleteDialogOpen(false)}>여행 삭제</DialogTitle>
        <DialogBody>
          <p className="text-zinc-600 dark:text-zinc-400">
            "{trip.title}" 여행을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 일정도 함께 삭제됩니다.
          </p>
        </DialogBody>
        <DialogActions>
          <Button color="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
            취소
          </Button>
          <Button color="danger" onClick={handleDeleteTrip}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Plan Dialog */}
      <Dialog open={planToDelete !== null} onClose={() => setPlanToDelete(null)}>
        <DialogTitle onClose={() => setPlanToDelete(null)}>일정 삭제</DialogTitle>
        <DialogBody>
          <p className="text-zinc-600 dark:text-zinc-400">
            이 일정을 삭제하시겠습니까?
          </p>
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
  )
}
