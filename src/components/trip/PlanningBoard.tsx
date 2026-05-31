// ============================================
// PlanningBoard — 크로스데이 드래그앤드롭 일정 편성 보드 (PC xl+ 전용)
// Day = 컬럼(droppable), 일정 카드 = sortable. 일정을 다른 Day로 드래그해 이동.
// @dnd-kit 멀티컨테이너 sortable 패턴. 모바일은 DayDetail 세로 재정렬을 유지(여기 미사용).
// ============================================

import { useEffect, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { GripVertical } from 'lucide-react'
import { PlanTypeBadge } from '@/components/ui/Badge'
import { formatTime } from '@/utils/format'
import { useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import type { Plan } from '@/types'

type Columns = Record<number, Plan[]>

function buildColumns(plans: Plan[], totalDays: number): Columns {
  const cols: Columns = {}
  for (let d = 1; d <= totalDays; d++) cols[d] = []
  for (const p of plans) {
    if (!cols[p.day]) cols[p.day] = []
    cols[p.day].push(p)
  }
  for (const key of Object.keys(cols)) {
    cols[Number(key)].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.startTime.localeCompare(b.startTime),
    )
  }
  return cols
}

const planKey = (id: number | undefined) => `plan-${id}`
const parsePlanId = (id: string) => Number(id.replace('plan-', ''))

function SortableCard({ plan, onClick }: { plan: Plan; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: planKey(plan.id) })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5',
        isDragging && 'opacity-50 ring-2 ring-primary-500',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab touch-none text-zinc-400 active:cursor-grabbing"
        aria-label="드래그하여 이동"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="mb-0.5 flex items-center gap-1.5">
          <PlanTypeBadge type={plan.type} />
          <span className="text-xs text-zinc-500">{formatTime(plan.startTime)}</span>
        </div>
        <div className="truncate text-sm font-medium text-[var(--foreground)]">{plan.placeName}</div>
      </button>
    </div>
  )
}

function DayColumn({ day, plans, onPlanClick }: { day: number; plans: Plan[]; onPlanClick?: (p: Plan) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col rounded-xl bg-[var(--muted)]/40 p-2">
      <div className="px-1 pb-2 text-sm font-semibold text-[var(--foreground)]">
        Day {day} <span className="text-xs font-normal text-zinc-400">{plans.length}</span>
      </div>
      <SortableContext items={plans.map((p) => planKey(p.id))} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={clsx(
            'min-h-[60px] flex-1 space-y-2 rounded-lg p-0.5 transition-colors',
            isOver && 'bg-primary-500/10 ring-1 ring-primary-500/30',
          )}
        >
          {plans.map((p) => (
            <SortableCard key={p.id} plan={p} onClick={() => onPlanClick?.(p)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

interface PlanningBoardProps {
  tripId: number
  plans: Plan[]
  totalDays: number
  onPlanClick?: (plan: Plan) => void
}

export function PlanningBoard({ tripId, plans, totalDays, onPlanClick }: PlanningBoardProps) {
  const [columns, setColumns] = useState<Columns>(() => buildColumns(plans, totalDays))
  const movePlanToDay = useTripStore((s) => s.movePlanToDay)
  const reorderPlans = useTripStore((s) => s.reorderPlans)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 외부 변경(동기화/재정렬 persist 후 reload) 반영
  useEffect(() => {
    setColumns(buildColumns(plans, totalDays))
  }, [plans, totalDays])

  const dayOf = (id: string): number | null => {
    if (id.startsWith('day-')) return Number(id.slice(4))
    const pid = parsePlanId(id)
    for (const key of Object.keys(columns)) {
      if (columns[Number(key)].some((p) => p.id === pid)) return Number(key)
    }
    return null
  }

  // 드래그 중 다른 컬럼 위로 이동하면 로컬 상태에서 옮겨 시각적으로 반영
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeDay = dayOf(String(active.id))
    const overDay = dayOf(String(over.id))
    if (activeDay == null || overDay == null || activeDay === overDay) return

    setColumns((prev) => {
      const activePid = parsePlanId(String(active.id))
      const moved = prev[activeDay]?.find((p) => p.id === activePid)
      if (!moved) return prev
      const overArr = prev[overDay] || []
      const overIdx = String(over.id).startsWith('plan-')
        ? overArr.findIndex((p) => planKey(p.id) === over.id)
        : overArr.length
      const insertAt = overIdx < 0 ? overArr.length : overIdx
      return {
        ...prev,
        [activeDay]: prev[activeDay].filter((p) => p.id !== activePid),
        [overDay]: [...overArr.slice(0, insertAt), { ...moved, day: overDay }, ...overArr.slice(insertAt)],
      }
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const activePid = parsePlanId(String(active.id))
    const targetDay = dayOf(String(over.id))
    if (targetDay == null) return

    const arr = columns[targetDay] || []
    const oldIndex = arr.findIndex((p) => p.id === activePid)
    if (oldIndex === -1) return

    let newArr = arr
    if (String(over.id).startsWith('plan-')) {
      const overPid = parsePlanId(String(over.id))
      const newIndex = arr.findIndex((p) => p.id === overPid)
      if (overPid !== activePid && newIndex !== -1) newArr = arrayMove(arr, oldIndex, newIndex)
    }
    setColumns((prev) => ({ ...prev, [targetDay]: newArr }))

    const orderedTargetIds = newArr.map((p) => p.id!).filter(Boolean)
    const originalDay = plans.find((p) => p.id === activePid)?.day
    if (originalDay != null && originalDay !== targetDay) {
      void movePlanToDay(tripId, activePid, targetDay, orderedTargetIds).then(() =>
        toast.success(`Day ${targetDay}(으)로 이동했습니다`),
      )
    } else {
      void reorderPlans(tripId, targetDay, orderedTargetIds)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto overscroll-contain pb-2">
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
          <DayColumn key={day} day={day} plans={columns[day] || []} onPlanClick={onPlanClick} />
        ))}
      </div>
    </DndContext>
  )
}
