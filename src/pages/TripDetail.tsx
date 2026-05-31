import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Plus, Map, Star, Calendar, MapPin, Clock, Navigation, Sparkles, Download, FileDown, MessageSquare, Share2, Link2, ChevronDown, ChevronRight, BookOpen, Wallet, LayoutGrid } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { PlanTypeBadge } from '@/components/ui/Badge'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { LocalTimeComparison } from '@/components/timezone'
import { AIItineraryDialog, AIChatPanel } from '@/components/ai'
import { useSettingsStore } from '@/stores/settingsStore'
import type { GeneratedItinerary } from '@/types'
import { useShallow } from 'zustand/react/shallow'
import { useCurrentTrip, useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import { downloadGPX, downloadKML } from '@/utils/routeExport'
import { downloadItineraryPDF } from '@/utils/pdfExport'
import { shareTrip, unshareTrip } from '@/services/sharing'
import { OfflineMapDownloader } from '@/components/map/OfflineMapDownloader'
import { formatDateRange, getTripDuration, formatTime } from '@/utils/format'
import { getTripDayDate, getTimezoneFromCountry } from '@/utils/timezone'
import { PLAN_TYPE_ICONS } from '@/utils/constants'
import { Camera, Utensils, Bed, Bus, Car, Plane, PlaneTakeoff, MapPin as DefaultMapPin, type LucideIcon } from 'lucide-react'

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

export function TripDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const plans = useCurrentPlans()
  const isLoading = useTripLoading()
  const { loadTrip, deleteTrip, toggleFavorite, addPlan, deletePlan } = useTripStore(
    useShallow((s) => ({
      loadTrip: s.loadTrip,
      deleteTrip: s.deleteTrip,
      toggleFavorite: s.toggleFavorite,
      addPlan: s.addPlan,
      deletePlan: s.deletePlan,
    }))
  )

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<number | null>(null)
  const [isAIItineraryOpen, setIsAIItineraryOpen] = useState(false)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const [activeDay, setActiveDay] = useState<number>(1)
  const dayRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const tabBarRef = useRef<HTMLDivElement>(null)

  const { claudeEnabled } = useSettingsStore(
    useShallow((s) => ({
      claudeEnabled: s.claudeEnabled,
    }))
  )

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

  const toggleDay = useCallback((day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }, [])

  // IntersectionObserver: auto-update activeDay on scroll
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    days.forEach((day) => {
      const el = dayRefs.current[day]
      if (!el) return
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveDay(day) },
        { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
      )
      observer.observe(el)
      observers.push(observer)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [days, plansByDay])

  // Auto-scroll tab bar to keep active day visible (horizontal only — no vertical interference)
  useEffect(() => {
    if (!tabBarRef.current) return
    const activeTab = tabBarRef.current.querySelector(`[data-day="${activeDay}"]`) as HTMLElement
    if (!activeTab) return
    const container = tabBarRef.current
    const scrollLeft = activeTab.offsetLeft - container.clientWidth / 2 + activeTab.offsetWidth / 2
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [activeDay])

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

  const handleShare = async () => {
    if (!trip?.id) return
    setIsSharing(true)
    try {
      if (trip.shareId) {
        await unshareTrip(trip.id)
        toast.success('공유가 해제되었습니다')
        loadTrip(trip.id)
      } else {
        const shareId = await shareTrip(trip.id)
        const shareUrl = `${window.location.origin}/shared/${shareId}`
        const shareData = { title: trip.title, text: `${trip.title} 여행 일정`, url: shareUrl }
        // 모바일: 네이티브 공유 시트 / 미지원(데스크톱 등): 클립보드 폴백
        if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData))) {
          try {
            await navigator.share(shareData)
          } catch (e) {
            // 공유 시트 취소(AbortError)는 무시, 그 외엔 클립보드 폴백
            if (!(e instanceof DOMException && e.name === 'AbortError')) {
              await navigator.clipboard.writeText(shareUrl)
              toast.success('공유 링크가 클립보드에 복사되었습니다')
            }
          }
        } else {
          await navigator.clipboard.writeText(shareUrl)
          toast.success('공유 링크가 클립보드에 복사되었습니다')
        }
        loadTrip(trip.id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '공유 처리에 실패했습니다')
    } finally {
      setIsSharing(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton height={200} className="rounded-xl" />
          <Skeleton height={400} className="rounded-xl" />
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기" className="mt-0.5 flex-shrink-0">
            <ArrowLeft className="size-5" />
          </IconButton>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-[var(--foreground)] break-words">{trip.title}</h1>
            <p className="text-xs sm:text-sm text-zinc-500">{formatDateRange(trip.startDate, trip.endDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <IconButton
            plain
            color={trip.isFavorite ? 'warning' : 'secondary'}
            onClick={() => trip.id && toggleFavorite(trip.id)}
            aria-label={trip.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star className={`size-5 ${trip.isFavorite ? 'fill-current' : ''}`} />
          </IconButton>
          <div className="relative">
            <IconButton
              plain
              color="secondary"
              onClick={() => setShowExportMenu(!showExportMenu)}
              aria-label="내보내기"
            >
              <Download className="size-5" />
            </IconButton>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    onClick={() => { downloadGPX(trip, plans); setShowExportMenu(false); toast.success('GPX 파일이 다운로드되었습니다') }}
                  >
                    GPX 내보내기
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    onClick={() => { downloadKML(trip, plans); setShowExportMenu(false); toast.success('KML 파일이 다운로드되었습니다') }}
                  >
                    KML 내보내기
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                    onClick={async () => {
                      setShowExportMenu(false)
                      try {
                        await downloadItineraryPDF(trip, plans)
                        toast.success('PDF 파일이 다운로드되었습니다')
                      } catch {
                        toast.error('PDF 생성에 실패했습니다')
                      }
                    }}
                  >
                    <FileDown className="size-4" />
                    PDF 다운로드
                  </button>
                </div>
              </>
            )}
          </div>
          <IconButton
            plain
            color={trip.shareId ? 'primary' : 'secondary'}
            onClick={handleShare}
            aria-label={trip.shareId ? '공유 해제' : '공유'}
            disabled={isSharing}
          >
            {trip.shareId ? <Link2 className="size-5" /> : <Share2 className="size-5" />}
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
      <Card padding="none" className="overflow-hidden" style={{ viewTransitionName: `trip-card-${trip.id}` }}>
        {trip.coverImage && (
          <div className="h-36 sm:h-48 md:h-64">
            <img src={trip.coverImage} alt={trip.title} className="w-full h-full object-cover" style={{ viewTransitionName: `trip-image-${trip.id}` }} />
          </div>
        )}
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 sm:gap-4">
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

          {/* Local Time Comparison */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <LocalTimeComparison
              tripTimezone={trip.timezone || getTimezoneFromCountry(trip.country)}
            />
          </div>

          {/* Action Buttons - Mobile: icon grid / Desktop: inline flex */}
          <div className="grid grid-cols-3 gap-2 mt-4 sm:hidden">
            <Link
              to={`/trips/${trip.id}/plans/new`}
              className="flex flex-col items-center justify-center min-h-[48px] p-2 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 active:scale-95 transition-transform"
            >
              <Plus className="size-4 mb-0.5" />
              <span className="text-[11px] font-medium leading-tight">추가</span>
            </Link>
            <Link
              to={`/trips/${trip.id}/map`}
              className="flex flex-col items-center justify-center min-h-[48px] p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
            >
              <Map className="size-4 mb-0.5" />
              <span className="text-[11px] font-medium leading-tight">지도</span>
            </Link>
            <Link
              to={`/trips/${trip.id}/navigate`}
              className="flex flex-col items-center justify-center min-h-[48px] p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
            >
              <Navigation className="size-4 mb-0.5" />
              <span className="text-[11px] font-medium leading-tight">내비</span>
            </Link>
            <Link
              to={`/trips/${trip.id}/log`}
              className="flex flex-col items-center justify-center min-h-[48px] p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
            >
              <BookOpen className="size-4 mb-0.5" />
              <span className="text-[11px] font-medium leading-tight">기록</span>
            </Link>
            <Link
              to={`/trips/${trip.id}/expenses`}
              className="flex flex-col items-center justify-center min-h-[48px] p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
            >
              <Wallet className="size-4 mb-0.5" />
              <span className="text-[11px] font-medium leading-tight">경비</span>
            </Link>
            {claudeEnabled && (
              <button
                type="button"
                onClick={() => setIsAIItineraryOpen(true)}
                className="flex flex-col items-center justify-center min-h-[48px] p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
              >
                <Sparkles className="size-4 mb-0.5" />
                <span className="text-[11px] font-medium leading-tight">AI</span>
              </button>
            )}
          </div>
          <div className="hidden sm:flex sm:flex-wrap gap-2 mt-4">
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
            <Button
              to={`/trips/${trip.id}/board`}
              outline
              color="secondary"
              size="sm"
              className="hidden lg:inline-flex"
              leftIcon={<LayoutGrid className="size-4" />}
            >
              플래닝 보드
            </Button>
            <Button
              to={`/trips/${trip.id}/navigate`}
              outline
              color="secondary"
              size="sm"
              leftIcon={<Navigation className="size-4" />}
            >
              내비게이션
            </Button>
            <Button
              to={`/trips/${trip.id}/log`}
              outline
              color="secondary"
              size="sm"
              leftIcon={<BookOpen className="size-4" />}
            >
              여행 기록
            </Button>
            <Button
              to={`/trips/${trip.id}/expenses`}
              outline
              color="secondary"
              size="sm"
              leftIcon={<Wallet className="size-4" />}
            >
              경비 관리
            </Button>
            {claudeEnabled && (
              <Button
                outline
                color="secondary"
                size="sm"
                leftIcon={<Sparkles className="size-4" />}
                onClick={() => setIsAIItineraryOpen(true)}
              >
                AI 일정
              </Button>
            )}
            <OfflineMapDownloader plans={plans} tripTitle={trip.title} />
          </div>
        </div>
      </Card>

      {/* Sticky Day Tab Bar */}
      {days.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[var(--background)] border-b border-zinc-200 dark:border-zinc-800">
          <div ref={tabBarRef} className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {days.map((day) => {
              const dayPlans = plansByDay[day] || []
              return (
                <button
                  key={day}
                  data-day={day}
                  onClick={() => {
                    setActiveDay(day)
                    dayRefs.current[day]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`flex-shrink-0 min-w-[2.75rem] flex flex-col items-center py-1.5 px-1 rounded-xl text-center transition-colors ${
                    activeDay === day
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className="text-sm font-bold leading-tight">{day}</span>
                  {dayPlans.length > 0 && (
                    <span className={`text-[10px] leading-tight ${
                      activeDay === day ? 'text-white/70' : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {dayPlans.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Plans Timeline — Accordion */}
      <div className="space-y-3">
        {days.map((day) => {
          const dayPlans = plansByDay[day] || []
          const dayDate = getTripDayDate(trip.startDate, day)
          const isExpanded = expandedDays.has(day)

          return (
            <div key={day} ref={(el) => { dayRefs.current[day] = el }} style={{ scrollMarginTop: '3.5rem' }}>
              <Card padding="none">
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleDay(day)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-5 text-zinc-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="size-5 text-zinc-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--foreground)]">Day {day}</span>
                      <span className="text-sm text-zinc-500">
                        {dayDate.toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </span>
                    </div>
                    {!isExpanded && dayPlans.length > 0 && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">
                        {dayPlans.map(p => p.placeName).join(' → ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 flex-shrink-0">
                    {dayPlans.length}개 장소
                  </span>
                  <Button
                    to={`/trips/${trip.id}/plans/new?day=${day}`}
                    size="xs"
                    outline
                    color="primary"
                    leftIcon={<Plus className="size-3" />}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  >
                    추가
                  </Button>
                </button>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800">
                    <CardContent>
                      {dayPlans.length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-4">일정이 없습니다</p>
                      ) : (
                        <div className="space-y-3">
                          {dayPlans.map((plan) => {
                            const iconName = PLAN_TYPE_ICONS[plan.type]
                            const Icon = iconMap[iconName] || DefaultMapPin
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
                                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
                    {/* Day Detail link */}
                    <Link
                      to={`/trips/${trip.id}/day/${day}`}
                      className="block px-4 py-3 text-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                    >
                      Day {day} 상세 →
                    </Link>
                  </div>
                )}
              </Card>
            </div>
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
      {/* AI Itinerary Dialog */}
      {claudeEnabled && trip && (
        <AIItineraryDialog
          open={isAIItineraryOpen}
          onClose={() => setIsAIItineraryOpen(false)}
          trip={trip}
          totalDays={getTripDuration(trip.startDate, trip.endDate)}
          existingPlansCount={plans.length}
          onApply={async (itinerary: GeneratedItinerary) => {
            let addedCount = 0
            for (const day of itinerary.days) {
              for (const plan of day.plans) {
                await addPlan({
                  tripId: trip.id!,
                  day: day.day,
                  placeName: plan.placeName,
                  startTime: plan.startTime,
                  endTime: plan.endTime || '',
                  type: plan.type || 'attraction',
                  address: plan.address || '',
                  memo: plan.memo || '',
                  latitude: plan.latitude,
                  longitude: plan.longitude,
                  photos: [],
                  order: addedCount,
                })
                addedCount++
              }
            }
            toast.success(`AI가 ${addedCount}개 일정을 생성했습니다`)
          }}
        />
      )}

      {/* AI Chat Floating Button */}
      {claudeEnabled && (
        <button
          onClick={() => setIsAIChatOpen(true)}
          className="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 z-30 size-14 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 flex items-center justify-center transition-colors"
          aria-label="AI 플래너"
        >
          <MessageSquare className="size-6" />
        </button>
      )}

      {/* AI Chat Panel */}
      <AIChatPanel
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        tripId={trip.id || 0}
        tripTitle={trip.title}
        tripCountry={trip.country}
      />
      </div>
    </PageContainer>
  )
}
