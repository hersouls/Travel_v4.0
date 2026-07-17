// ============================================
// StepSchedule — 3단계: 일정 (선택)
// 일차 칩 · 시작/종료 시간 · 미니 타임라인 충돌 시각화
// ============================================

import { Label } from '@/components/ui/Input'
import { TimePicker } from '@/components/ui/TimePicker'
import { useCurrentPlans } from '@/stores/tripStore'
import { formatTime } from '@/utils/format'
import { checkPlanConflict } from '@/utils/timeConflict'
import { getTripDayDate } from '@/utils/timezone'
import { AlertTriangle, CalendarDays } from 'lucide-react'
import { useMemo } from 'react'
import type { StepProps } from '../types'

export function StepSchedule({ ctx }: StepProps) {
  const { data, update, currentTrip, tripDuration, planIdNum } = ctx
  const allPlans = useCurrentPlans()

  const days = useMemo(
    () => Array.from({ length: Math.max(1, tripDuration) }, (_, i) => i + 1),
    [tripDuration],
  )

  const sameDayPlans = useMemo(
    () =>
      allPlans
        .filter((p) => p.day === data.day && p.id !== planIdNum)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [allPlans, data.day, planIdNum],
  )

  const conflict = useMemo(
    () =>
      data.placeName
        ? checkPlanConflict(
            {
              startTime: data.startTime,
              endTime: data.endTime || undefined,
              placeName: data.placeName || '이 일정',
              id: planIdNum,
            },
            sameDayPlans,
          )
        : null,
    [data.startTime, data.endTime, data.placeName, sameDayPlans, planIdNum],
  )

  const conflictingIds = new Set(conflict ? [conflict.planB.id] : [])

  // 미니 타임라인: 같은 날 일정 + 현재 초안
  const timeline = useMemo(() => {
    const draft = {
      id: planIdNum ?? -1,
      startTime: data.startTime,
      endTime: data.endTime,
      placeName: data.placeName || '이 일정',
      isDraft: true,
    }
    const rows = [
      ...sameDayPlans.map((p) => ({
        id: p.id ?? 0,
        startTime: p.startTime,
        endTime: p.endTime || '',
        placeName: p.placeName,
        isDraft: false,
      })),
      draft,
    ]
    return rows.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [sameDayPlans, data.startTime, data.endTime, data.placeName, planIdNum])

  return (
    <div className="space-y-5">
      {/* 일차 선택 */}
      <div>
        <Label className="mb-2 flex items-center gap-1.5">
          <CalendarDays className="size-4 text-primary-500" />
          며칠째 방문하나요?
        </Label>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d) => {
            const active = data.day === d
            const date = currentTrip ? getTripDayDate(currentTrip.startDate, d) : null
            return (
              <button
                key={d}
                type="button"
                onClick={() => update({ day: d })}
                aria-pressed={active}
                className={`flex min-h-[3.5rem] shrink-0 snap-start flex-col items-center justify-center rounded-xl px-3.5 transition-colors ${
                  active
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <span className="text-sm font-bold">Day {d}</span>
                {date && (
                  <span
                    className={`text-[10px] tabular-nums ${active ? 'text-white/75' : 'text-zinc-400'}`}
                  >
                    {date.getMonth() + 1}/{date.getDate()}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 시간 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TimePicker
          label="시작 시간"
          value={data.startTime}
          onChange={(value) => update({ startTime: value })}
          required
        />
        <TimePicker
          label="종료 시간"
          value={data.endTime}
          onChange={(value) => update({ endTime: value })}
          minTime={data.startTime}
          align="end"
        />
      </div>

      {/* 시간 충돌 경고 */}
      {conflict && (
        <div
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30"
          aria-live="polite"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="text-amber-700 dark:text-amber-300">
            <span className="font-semibold">시간이 겹칩니다</span> — "{conflict.planB.placeName}" (
            {formatTime(conflict.planB.startTime)}
            {conflict.planB.endTime ? `~${formatTime(conflict.planB.endTime)}` : ''})과 겹쳐요.
            그대로 저장할 수 있어요.
          </div>
        </div>
      )}

      {/* 미니 타임라인 */}
      {timeline.length > 1 && (
        <div>
          <Label className="mb-2 block">Day {data.day} 타임라인</Label>
          <ol className="space-y-1.5">
            {timeline.map((row, i) => {
              const conflicting = row.isDraft ? !!conflict : conflictingIds.has(row.id)
              return (
                <li
                  key={`${row.id}-${i}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    row.isDraft
                      ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-950/30'
                      : conflicting
                        ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20'
                        : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50'
                  }`}
                >
                  <span className="w-20 shrink-0 text-xs font-semibold tabular-nums text-zinc-500">
                    {formatTime(row.startTime)}
                    {row.endTime ? `~${formatTime(row.endTime)}` : ''}
                  </span>
                  <span
                    className={`flex-1 truncate text-sm ${
                      row.isDraft
                        ? 'font-semibold text-primary-700 dark:text-primary-300'
                        : 'text-[var(--foreground)]'
                    }`}
                  >
                    {row.placeName}
                  </span>
                  {row.isDraft && (
                    <span className="shrink-0 rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      이 일정
                    </span>
                  )}
                  {conflicting && !row.isDraft && (
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
