// ============================================
// TripCard Component
// 대시보드 여행 카드 — 상태 배지(진행 중/D-day/완료),
// 진행률 바, 기록·경비·지도 퀵액션
// ============================================

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { Trip } from '@/types'
import { formatDateRange, getTripDuration } from '@/utils/format'
import type { TripStatus } from '@/utils/timezone'
import {
  BookOpen,
  CheckSquare,
  ChevronRight,
  Map as MapIcon,
  MapPin,
  Star,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface TripCardProps {
  trip: Trip
  status: TripStatus
  isSelectionMode: boolean
  isSelected: boolean
  onToggleSelect: (id: number) => void
  onToggleFavorite: (id: number) => void
}

/** 커버 이미지 위 상태 칩 — 이미지 대비 확보를 위한 자체 스타일 */
function StatusChip({ status }: { status: TripStatus }) {
  if (status.kind === 'ongoing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm">
        <span className="relative flex size-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
        </span>
        {status.dayN}일차 여행 중
      </span>
    )
  }
  if (status.kind === 'upcoming') {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm tabular-nums">
        D-{status.dDay}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-900/55 px-2.5 py-1 text-[11px] font-medium text-white/90 shadow-sm backdrop-blur-sm">
      여행 완료
    </span>
  )
}

const quickActions = [
  { key: 'log', label: '기록', icon: BookOpen, path: 'log' },
  { key: 'expense', label: '경비', icon: Wallet, path: 'expenses' },
  { key: 'map', label: '지도', icon: MapIcon, path: 'map' },
] as const

export function TripCard({
  trip,
  status,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
}: TripCardProps) {
  const selected = isSelectionMode && isSelected

  return (
    <Card
      variant="interactive"
      padding="none"
      className={`overflow-hidden group relative ${selected ? 'ring-2 ring-primary-500' : ''}`}
      style={{ viewTransitionName: `trip-card-${trip.id}` }}
      role={isSelectionMode ? 'checkbox' : undefined}
      aria-checked={isSelectionMode ? isSelected : undefined}
      aria-label={isSelectionMode ? `${trip.title} 선택` : undefined}
      tabIndex={isSelectionMode ? 0 : undefined}
      onClick={
        isSelectionMode
          ? (e: React.MouseEvent) => {
              e.preventDefault()
              if (trip.id) onToggleSelect(trip.id)
            }
          : undefined
      }
      onKeyDown={
        isSelectionMode
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (trip.id) onToggleSelect(trip.id)
              }
            }
          : undefined
      }
    >
      <Link
        to={isSelectionMode ? '#' : `/trips/${trip.id}`}
        className="block"
        onClick={isSelectionMode ? (e: React.MouseEvent) => e.preventDefault() : undefined}
      >
        {/* Cover Image */}
        <div className="relative aspect-[16/10] bg-zinc-100 dark:bg-zinc-800">
          {trip.coverImage ? (
            <img
              src={trip.coverImage}
              alt={trip.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              style={{ viewTransitionName: `trip-image-${trip.id}` }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="size-8 text-zinc-300 dark:text-zinc-600" />
            </div>
          )}

          {/* 상태 칩 — 선택 모드에서는 체크박스와 겹치지 않게 숨김 */}
          {!isSelectionMode && (
            <div className="absolute top-2 left-2">
              <StatusChip status={status} />
            </div>
          )}

          {/* Country Badge */}
          <div className="absolute bottom-2 left-2">
            <Badge color="primary" size="sm">
              {trip.country}
            </Badge>
          </div>

          {/* 진행률 바 — 진행 중 여행만 (수치는 아래 콘텐츠 영역에 텍스트로 노출) */}
          {status.kind === 'ongoing' && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25" aria-hidden="true">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-500 transition-[width] duration-500"
                style={{ width: `${Math.min(100, status.progress * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-[var(--foreground)] group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {trip.title}
          </h3>
          <p className="text-sm text-zinc-400 mt-1 tabular-nums">
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-zinc-400 tabular-nums">
              {getTripDuration(trip.startDate, trip.endDate)}일 · {trip.plansCount || 0}개 일정
              {status.kind === 'ongoing' && (
                <span className="ml-1.5 font-semibold text-primary-600 dark:text-primary-400">
                  {Math.round(status.progress * 100)}% 진행
                </span>
              )}
            </span>
            <ChevronRight className="size-4 text-zinc-400 group-hover:text-primary-500 transition-colors" />
          </div>
        </div>
      </Link>

      {/* 퀵액션 — 기록 / 경비 / 지도 (여행 하위 기능 바로가기) */}
      <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
        {quickActions.map(({ key, label, icon: Icon, path }) => (
          <Link
            key={key}
            to={isSelectionMode ? '#' : `/trips/${trip.id}/${path}`}
            onClick={
              isSelectionMode
                ? (e: React.MouseEvent) => e.preventDefault()
                : (e: React.MouseEvent) => e.stopPropagation()
            }
            aria-label={`${trip.title} ${label}`}
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950/30 dark:hover:text-primary-400 transition-colors"
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        ))}
      </div>

      {/* Favorite Button — Link 밖 오버레이 (a 안의 button 중첩 방지) */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (trip.id) onToggleFavorite(trip.id)
        }}
        className="absolute top-2 right-2 p-2 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-900 transition-colors"
        aria-label={trip.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
      >
        <Star
          className={`size-4 ${trip.isFavorite ? 'fill-warning-400 text-warning-400' : 'text-zinc-400'}`}
        />
      </button>

      {/* Selection checkbox overlay */}
      {isSelectionMode && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <div
            className={`size-6 rounded-md border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-zinc-300 dark:border-zinc-600 bg-white/80 dark:bg-zinc-900/80'
            }`}
          >
            {isSelected && <CheckSquare className="size-4" />}
          </div>
        </div>
      )}
    </Card>
  )
}
