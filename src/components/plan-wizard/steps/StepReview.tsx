import { RingProgress } from '@/components/ui/RingProgress'
import { useCurrentPlans } from '@/stores/tripStore'
import type { PlanType } from '@/types'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import { formatTime, getTripDuration } from '@/utils/format'
import { checkPlanConflict } from '@/utils/timeConflict'
import { getTripDayDate } from '@/utils/timezone'
import {
  AlertTriangle,
  Bed,
  BookmarkPlus,
  Bus,
  Camera,
  Car,
  Clock,
  type LucideIcon,
  MapPin,
  Pencil,
  Plane,
  PlaneTakeoff,
  Star,
  Utensils,
} from 'lucide-react'
import type { StepProps, WizardStepId } from '../types'

const TYPE_ICON: Record<PlanType, LucideIcon> = {
  attraction: Camera,
  restaurant: Utensils,
  hotel: Bed,
  transport: Bus,
  car: Car,
  plane: Plane,
  airport: PlaneTakeoff,
  other: MapPin,
}

export function StepReview({ ctx }: StepProps) {
  const { data, currentTrip, jumpToStep, planIdNum } = ctx
  const allPlans = useCurrentPlans()

  const TypeIcon = TYPE_ICON[data.type] ?? MapPin
  const dayDate = currentTrip ? getTripDayDate(currentTrip.startDate, data.day) : null

  // 완성도: 채워진 항목 비율
  const checks = [
    !!data.placeName,
    true, // 유형은 항상
    true, // 일차/시간은 항상
    !!data.address,
    data.latitude !== undefined && data.longitude !== undefined,
    !!data.website,
    !!data.openingHours,
    !!data.memo,
    data.photos.length > 0,
    !!data.audioScript,
  ]
  const filled = checks.filter(Boolean).length

  const conflict = checkPlanConflict(
    {
      startTime: data.startTime,
      endTime: data.endTime || undefined,
      placeName: data.placeName || '이 일정',
      id: planIdNum,
    },
    allPlans.filter((p) => p.day === data.day && p.id !== planIdNum),
  )

  const editLink = (step: WizardStepId, label: string) => (
    <button
      type="button"
      onClick={() => jumpToStep(step)}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400"
    >
      <Pencil className="size-3" />
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      {/* 완성도 + 티켓 요약 */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-[var(--card)] dark:border-zinc-800">
        {/* 헤더 */}
        <div className="flex items-center gap-3 border-b border-zinc-100 bg-gradient-to-r from-primary-50/60 to-blue-50/40 p-4 dark:border-zinc-800 dark:from-primary-950/30 dark:to-blue-950/20">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white">
            <TypeIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-bold text-[var(--foreground)]">
                {data.placeName || '(장소 이름 없음)'}
              </h3>
            </div>
            <p className="text-xs text-zinc-500">
              {PLAN_TYPE_LABELS[data.type]} · {currentTrip?.title ?? ''}
            </p>
          </div>
          <RingProgress value={filled} max={checks.length} size={44} strokeWidth={5} animateOnMount>
            <span className="text-[11px] font-bold tabular-nums text-primary-600 dark:text-primary-400">
              {Math.round((filled / checks.length) * 100)}%
            </span>
          </RingProgress>
        </div>

        {/* 상세 요약 */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <ReviewRow
            icon={<Clock className="size-4 text-zinc-400" />}
            label="일정"
            action={editLink('schedule', '수정')}
          >
            <span className="tabular-nums">
              Day {data.day}
              {dayDate ? ` · ${dayDate.getMonth() + 1}/${dayDate.getDate()}` : ''} ·{' '}
              {formatTime(data.startTime)}
              {data.endTime ? `~${formatTime(data.endTime)}` : ''}
            </span>
          </ReviewRow>

          <ReviewRow
            icon={<MapPin className="size-4 text-zinc-400" />}
            label="위치"
            action={editLink('location', '수정')}
          >
            {data.address ? (
              <span className="line-clamp-2">{data.address}</span>
            ) : data.latitude !== undefined && data.longitude !== undefined ? (
              <span className="tabular-nums">
                {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
              </span>
            ) : (
              <span className="text-zinc-400">미입력</span>
            )}
            {data.googleInfo?.rating !== undefined && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Star className="size-3 fill-current" />
                {data.googleInfo.rating.toFixed(1)}
              </span>
            )}
          </ReviewRow>

          <ReviewRow
            icon={<Camera className="size-4 text-zinc-400" />}
            label="콘텐츠"
            action={editLink('content', '수정')}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {data.photos.length > 0 && (
                <img src={data.photos[0]} alt="" className="size-8 rounded-md object-cover" />
              )}
              <SummaryBadge on={data.photos.length > 0} label={`사진 ${data.photos.length}`} />
              <SummaryBadge on={!!data.memo} label="메모" />
              <SummaryBadge on={!!data.audioScript} label="음성" />
              <SummaryBadge on={!!data.youtubeLink} label="YouTube" />
              {!data.photos.length && !data.memo && !data.audioScript && !data.youtubeLink && (
                <span className="text-xs text-zinc-400">미입력</span>
              )}
            </div>
          </ReviewRow>
        </div>
      </div>

      {/* 시간 충돌 최종 경고 */}
      {conflict && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span className="text-amber-700 dark:text-amber-300">
            "{conflict.planB.placeName}"과 시간이 겹칩니다. 그대로 저장할 수 있어요.
          </span>
        </div>
      )}

      {/* 장소 라이브러리 자동 등록 */}
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="flex items-center gap-2.5">
          <BookmarkPlus className="size-4 text-zinc-500" />
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            장소 라이브러리에 자동 등록
          </span>
        </span>
        <input
          type="checkbox"
          checked={ctx.saveToLibrary}
          onChange={(e) => ctx.setSaveToLibrary(e.target.checked)}
          className="size-4 rounded border-zinc-300 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 dark:border-zinc-600"
        />
      </label>

      <p className="text-center text-xs text-zinc-400">
        {currentTrip
          ? `${getTripDuration(currentTrip.startDate, currentTrip.endDate)}일 일정 중 Day ${data.day}에 추가됩니다`
          : ''}
      </p>
    </div>
  )
}

function ReviewRow({
  icon,
  label,
  action,
  children,
}: {
  icon: React.ReactNode
  label: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400">{label}</span>
          {action}
        </div>
        <div className="mt-0.5 text-sm text-[var(--foreground)]">{children}</div>
      </div>
    </div>
  )
}

function SummaryBadge({ on, label }: { on: boolean; label: string }) {
  if (!on) return null
  return (
    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
      {label}
    </span>
  )
}
