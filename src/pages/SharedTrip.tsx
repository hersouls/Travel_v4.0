// ============================================
// SharedTrip Page - Read-only shared trip view
// Public page, no auth required
// ============================================

import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { getFirebaseDb } from '@/services/firebase'
import { MapPin, Calendar, Clock, ArrowLeft, Globe } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PlanTypeBadge } from '@/components/ui/Badge'
import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/Skeleton'
import type { PlanType } from '@/types'

// ============================================
// Shared Trip Data Types
// ============================================

interface SharedTripData {
  trip: {
    title: string
    country: string
    timezone?: string
    startDate: string
    endDate: string
    plansCount: number
  }
  plans: Array<{
    day: number
    order?: number
    placeName: string
    startTime: string
    endTime?: string
    type: PlanType
    address?: string
    memo?: string
    latitude?: number
    longitude?: number
  }>
  sharedAt: Timestamp
  sharedBy: string
}

// ============================================
// Format Utilities (self-contained)
// ============================================

function formatDateRange(start: string, end: string): string {
  return `${start} ~ ${end}`
}

function getTripDuration(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function formatTime(time: string): string {
  return time // HH:mm format
}

// ============================================
// SharedTrip Component
// ============================================

export function SharedTrip() {
  const { shareId } = useParams<{ shareId: string }>()
  const [data, setData] = useState<SharedTripData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSharedTrip() {
      if (!shareId) {
        setError('공유 링크가 올바르지 않습니다.')
        setIsLoading(false)
        return
      }

      try {
        const db = getFirebaseDb()

        const docRef = doc(db, 'sharedTrips', shareId)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
          setError('공유된 여행을 찾을 수 없습니다.')
          setIsLoading(false)
          return
        }

        setData(docSnap.data() as SharedTripData)
      } catch (err) {
        console.error('[SharedTrip] Failed to fetch shared trip:', err)
        const message = err instanceof Error ? err.message : String(err)

        if (message.includes('missing configuration') || message.includes('Cannot initialize')) {
          setError('Firebase가 구성되지 않았습니다.')
        } else {
          setError('공유된 여행을 불러오는 데 실패했습니다.')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchSharedTrip()
  }, [shareId])

  // Group plans by day, sorted by startTime
  const plansByDay = useMemo(() => {
    if (!data?.plans) return {}

    const grouped: Record<number, SharedTripData['plans']> = {}
    for (const plan of data.plans) {
      if (!grouped[plan.day]) grouped[plan.day] = []
      grouped[plan.day].push(plan)
    }

    // Sort by startTime within each day
    for (const day of Object.keys(grouped)) {
      grouped[parseInt(day)].sort((a, b) => a.startTime.localeCompare(b.startTime))
    }

    return grouped
  }, [data?.plans])

  // Generate day list from trip duration
  const days = useMemo(() => {
    if (!data?.trip) return []
    return Array.from(
      { length: getTripDuration(data.trip.startDate, data.trip.endDate) },
      (_, i) => i + 1,
    )
  }, [data?.trip])

  // ---- Loading State ----
  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6 animate-fade-in">
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton variant="rectangular" width={36} height={36} className="rounded-lg" />
            <Skeleton className="w-40" />
          </div>

          {/* Trip info card skeleton */}
          <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 sm:p-6 ring-1 ring-zinc-950/5 dark:ring-white/10 space-y-4">
            <Skeleton className="w-3/4 h-6" />
            <Skeleton className="w-1/2" />
            <div className="flex gap-4">
              <Skeleton className="w-24" />
              <Skeleton className="w-24" />
              <Skeleton className="w-24" />
            </div>
          </div>

          {/* Day cards skeleton */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-white dark:bg-zinc-900 p-4 sm:p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 space-y-3"
            >
              <Skeleton className="w-24 h-5" />
              <Skeleton className="w-full" />
              <Skeleton className="w-full" />
            </div>
          ))}
        </div>
      </PageContainer>
    )
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <PageContainer>
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-[var(--foreground)] transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>홈으로</span>
            </Link>
          </div>

          {/* Error card */}
          <Card padding="lg" className="text-center">
            <MapPin className="size-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {error || '공유된 여행을 찾을 수 없습니다.'}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              링크가 만료되었거나 올바르지 않을 수 있습니다.
            </p>
            <Button to="/" color="primary">
              홈으로 이동
            </Button>
          </Card>
        </div>
      </PageContainer>
    )
  }

  const { trip, plans } = data

  // ---- Success State ----
  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>홈으로</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 text-xs font-medium ring-1 ring-primary-500/20">
            <Globe className="size-3" />
            Shared Trip
          </span>
        </div>

        {/* Trip Info Card */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] break-words">
              {trip.title}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>

            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-zinc-400" />
                <span className="text-sm text-[var(--foreground)]">{trip.country}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-zinc-400" />
                <span className="text-sm text-[var(--foreground)]">
                  {getTripDuration(trip.startDate, trip.endDate)}일
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-zinc-400" />
                <span className="text-sm text-[var(--foreground)]">
                  {plans.length}개 일정
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Plans by Day */}
        <div className="space-y-4">
          {days.map((day) => {
            const dayPlans = plansByDay[day] || []

            return (
              <Card key={day} padding="md">
                <CardHeader
                  title={`Day ${day}`}
                  description={`${dayPlans.length}개 일정`}
                />
                <CardContent>
                  {dayPlans.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-4">
                      일정이 없습니다
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dayPlans.map((plan, idx) => (
                        <div
                          key={`${day}-${idx}`}
                          className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                        >
                          {/* Time column */}
                          <div className="flex-shrink-0 w-14 text-center pt-0.5">
                            <span className="text-sm font-medium text-[var(--foreground)]">
                              {formatTime(plan.startTime)}
                            </span>
                            {plan.endTime && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {formatTime(plan.endTime)}
                              </p>
                            )}
                          </div>

                          {/* Divider */}
                          <div className="flex-shrink-0 w-px self-stretch bg-zinc-200 dark:bg-zinc-700" />

                          {/* Plan info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-[var(--foreground)] break-words">
                                {plan.placeName}
                              </span>
                              <PlanTypeBadge type={plan.type} />
                            </div>
                            {plan.address && (
                              <p className="text-sm text-zinc-500 mt-1 break-words">
                                <MapPin className="size-3 inline mr-1 align-text-top" />
                                {plan.address}
                              </p>
                            )}
                            {plan.memo && (
                              <p className="text-sm text-zinc-400 mt-1 break-words">
                                {plan.memo}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-xs text-zinc-400">
            Powered by Moonwave Travel
          </p>
        </div>
      </div>
    </PageContainer>
  )
}
