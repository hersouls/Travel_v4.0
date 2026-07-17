// ============================================
// TodayItinerary Component
// 대시보드 '오늘의 여정' — 진행 중 여행의 오늘 일정
// 미니 타임라인 + 지금/다음 하이라이트 + 오늘 지출 요약
// ============================================

import { WeatherBadge } from '@/components/trip/WeatherBadge'
import { PlanTypeBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { getExpensesForTripDay, getPlansForTripDay } from '@/services/database'
import type { Expense, Plan, Trip } from '@/types'
import { PLAN_TYPE_ICONS } from '@/utils/constants'
import { formatTime } from '@/utils/format'
import { formatTripDayDate, getTripDayDate } from '@/utils/timezone'
import {
  Bed,
  BookOpen,
  Bus,
  Camera,
  Car as CarIcon,
  Check,
  ChevronRight,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Navigation,
  Plane,
  PlaneTakeoff,
  Plus,
  Utensils,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const iconMap: Record<string, LucideIcon> = {
  Camera,
  Utensils,
  Bed,
  Bus,
  Car: CarIcon,
  Plane,
  PlaneTakeoff,
  MapPin,
}

const MAX_VISIBLE_PLANS = 5

type PlanTimeState = 'done' | 'now' | 'upcoming'

/** 기기 현재 시각(HH:mm) 기준 일정 상태 — 진행 중 여행은 사용자가 현지에 있다고 가정 */
function getPlanTimeState(plans: Plan[], index: number, nowHM: string): PlanTimeState {
  const plan = plans[index]
  if (plan.startTime > nowHM) return 'upcoming'
  if (plan.endTime) return nowHM <= plan.endTime ? 'now' : 'done'
  // 종료 시각이 없으면 다음 일정 시작 전까지 '지금'으로 간주
  const next = plans[index + 1]
  if (next && next.startTime <= nowHM) return 'done'
  return 'now'
}

/** 통화별 합계 → "₩12,000 · ¥3,200" 형태 (상위 2개 + 나머지 개수) */
function formatDayExpenses(expenses: Expense[]): string | null {
  if (expenses.length === 0) return null
  const totals = new Map<string, number>()
  for (const e of expenses) {
    totals.set(e.currency, (totals.get(e.currency) || 0) + e.totalAmount)
  }
  const parts = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amount]) => {
      try {
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount)
      } catch {
        return `${new Intl.NumberFormat('ko-KR').format(amount)} ${currency}`
      }
    })
  const shown = parts.slice(0, 2).join(' · ')
  return parts.length > 2 ? `${shown} 외 ${parts.length - 2}` : shown
}

interface TodayItineraryProps {
  trip: Trip
  dayN: number
}

export function TodayItinerary({ trip, dayN }: TodayItineraryProps) {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [now, setNow] = useState(() => new Date())

  // 오늘 일정 + 오늘 지출 로드
  useEffect(() => {
    if (!trip.id) return
    let cancelled = false
    Promise.all([getPlansForTripDay(trip.id, dayN), getExpensesForTripDay(trip.id, dayN)])
      .then(([dayPlans, dayExpenses]) => {
        if (cancelled) return
        setPlans(dayPlans)
        setExpenses(dayExpenses)
      })
      .catch(() => {
        if (!cancelled) setPlans([])
      })
    return () => {
      cancelled = true
    }
  }, [trip.id, dayN])

  // '지금/다음' 하이라이트를 위한 1분 주기 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const { states, nextIndex } = useMemo(() => {
    if (!plans) return { states: [] as PlanTimeState[], nextIndex: -1 }
    const s = plans.map((_, i) => getPlanTimeState(plans, i, nowHM))
    return { states: s, nextIndex: s.findIndex((st) => st === 'upcoming') }
  }, [plans, nowHM])

  const expenseSummary = useMemo(() => formatDayExpenses(expenses), [expenses])
  const doneCount = states.filter((s) => s === 'done').length

  if (!plans) {
    return <div className="h-40 animate-shimmer rounded-xl" aria-hidden="true" />
  }

  const visiblePlans = plans.slice(0, MAX_VISIBLE_PLANS)
  const hiddenCount = plans.length - visiblePlans.length
  const dayDateISO = (() => {
    const d = getTripDayDate(trip.startDate, dayN)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 sm:px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/50 ring-1 ring-primary-500/20">
          <Navigation className="size-4.5 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--foreground)]">오늘의 여정</h2>
            <WeatherBadge country={trip.country} date={dayDateISO} compact />
          </div>
          <p className="truncate text-xs text-zinc-500 tabular-nums">
            Day {dayN} · {formatTripDayDate(trip.startDate, dayN)} · {trip.title}
          </p>
        </div>
        <Link
          to={`/trips/${trip.id}/day/${dayN}`}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
        >
          Day 상세
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {/* Timeline */}
      {plans.length === 0 ? (
        <div className="px-4 py-6 text-center sm:px-5">
          <p className="text-sm text-zinc-400">오늘 등록된 일정이 없습니다</p>
          <Link
            to={`/trips/${trip.id}/plans/new?day=${dayN}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-600 transition-colors"
          >
            <Plus className="size-3.5" />
            오늘 일정 추가
          </Link>
        </div>
      ) : (
        <div className="mt-3 px-4 pb-1 sm:px-5">
          <ol className="relative">
            {visiblePlans.map((plan, i) => {
              const state = states[i]
              const isNext = i === nextIndex
              const iconName = PLAN_TYPE_ICONS[plan.type]
              const Icon = iconMap[iconName] || MapPin
              const isLast = i === visiblePlans.length - 1 && hiddenCount === 0
              return (
                <li key={plan.id} className="relative flex gap-3 pb-1">
                  {/* 시간 레일 */}
                  <div className="w-11 shrink-0 pt-2 text-right">
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        state === 'now'
                          ? 'text-primary-600 dark:text-primary-400'
                          : state === 'done'
                            ? 'text-zinc-300 dark:text-zinc-600'
                            : 'text-zinc-500'
                      }`}
                    >
                      {formatTime(plan.startTime)}
                    </span>
                  </div>

                  {/* 도트 + 커넥터 */}
                  <div className="flex shrink-0 flex-col items-center">
                    <span
                      className={`relative mt-2.5 flex size-3 items-center justify-center rounded-full ring-2 ${
                        state === 'now'
                          ? 'bg-primary-500 ring-primary-200 dark:ring-primary-800'
                          : state === 'done'
                            ? 'bg-zinc-300 dark:bg-zinc-600 ring-transparent'
                            : 'bg-white dark:bg-zinc-900 ring-zinc-300 dark:ring-zinc-600'
                      }`}
                    >
                      {state === 'now' && (
                        <span className="absolute size-3 animate-ping rounded-full bg-primary-400 opacity-60" />
                      )}
                    </span>
                    {!isLast && <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                  </div>

                  {/* 일정 내용 */}
                  <Link
                    to={`/trips/${trip.id}/plans/${plan.id}`}
                    className={`mb-2 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                      state === 'done' ? 'opacity-55' : ''
                    } ${state === 'now' ? 'bg-primary-50/70 dark:bg-primary-950/30 ring-1 ring-primary-500/20' : ''}`}
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        state === 'now'
                          ? 'bg-primary-500 text-white'
                          : 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
                      }`}
                    >
                      {state === 'done' ? (
                        <Check className="size-4" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`truncate text-sm font-medium ${
                            state === 'now'
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-[var(--foreground)]'
                          }`}
                        >
                          {plan.placeName}
                        </span>
                        {state === 'now' && (
                          <span className="shrink-0 rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            지금
                          </span>
                        )}
                        {isNext && (
                          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600">
                            다음
                          </span>
                        )}
                        <PlanTypeBadge type={plan.type} className="hidden sm:inline-flex" />
                      </div>
                      {plan.endTime && (
                        <p className="mt-0.5 text-[11px] text-zinc-400 tabular-nums">
                          {formatTime(plan.startTime)} - {formatTime(plan.endTime)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                  </Link>
                </li>
              )
            })}
          </ol>
          {hiddenCount > 0 && (
            <Link
              to={`/trips/${trip.id}/day/${dayN}`}
              className="mb-2 ml-[4.25rem] inline-flex items-center gap-0.5 text-xs font-medium text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400"
            >
              외 {hiddenCount}개 일정 더 보기
              <ChevronRight className="size-3" />
            </Link>
          )}
        </div>
      )}

      {/* Footer — 오늘 요약 + 퀵액션 */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-xs text-zinc-500 tabular-nums">
          {plans.length > 0 && (
            <span>
              일정 {doneCount}/{plans.length} 완료
            </span>
          )}
          {expenseSummary && (
            <span>
              {plans.length > 0 && ' · '}오늘 지출{' '}
              <span className="font-semibold text-[var(--foreground)]">{expenseSummary}</span>
            </span>
          )}
          {plans.length === 0 && !expenseSummary && '오늘의 기록을 남겨보세요'}
        </p>
        <div className="flex items-center gap-1.5">
          {(
            [
              { label: '지도', icon: MapIcon, path: 'map' },
              { label: '기록', icon: BookOpen, path: 'log' },
              { label: '경비', icon: Wallet, path: 'expenses' },
            ] as const
          ).map(({ label, icon: Icon, path }) => (
            <Link
              key={path}
              to={`/trips/${trip.id}/${path}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-primary-700 dark:hover:bg-primary-950/30 dark:hover:text-primary-400"
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </Card>
  )
}
