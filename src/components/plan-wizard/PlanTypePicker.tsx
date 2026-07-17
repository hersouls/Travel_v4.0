// ============================================
// PlanTypePicker — 유형 8종 아이콘 그리드 (radiogroup)
// ============================================

import type { PlanType } from '@/types'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Bed,
  Bus,
  Camera,
  Car,
  type LucideIcon,
  MapPin,
  Plane,
  PlaneTakeoff,
  Utensils,
} from 'lucide-react'

const TYPES: { type: PlanType; icon: LucideIcon }[] = [
  { type: 'attraction', icon: Camera },
  { type: 'restaurant', icon: Utensils },
  { type: 'hotel', icon: Bed },
  { type: 'transport', icon: Bus },
  { type: 'car', icon: Car },
  { type: 'plane', icon: Plane },
  { type: 'airport', icon: PlaneTakeoff },
  { type: 'other', icon: MapPin },
]

interface PlanTypePickerProps {
  value: PlanType
  onChange: (type: PlanType) => void
  recommended?: PlanType | null
}

export function PlanTypePicker({ value, onChange, recommended }: PlanTypePickerProps) {
  const reduce = useReducedMotion()

  const handleKeyNav = (e: React.KeyboardEvent, index: number) => {
    let target = index
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (index + 1) % TYPES.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      target = (index - 1 + TYPES.length) % TYPES.length
    else return
    e.preventDefault()
    onChange(TYPES[target].type)
    const group = e.currentTarget.parentElement
    const next = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[target]
    next?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="일정 유형"
      className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-2"
    >
      {TYPES.map(({ type, icon: Icon }, i) => {
        const selected = value === type
        const isRecommended = recommended === type && !selected
        return (
          <motion.button
            key={type}
            type="button"
            // biome-ignore lint/a11y/useSemanticElements: 아이콘 그리드 radiogroup 커스텀 위젯 (input[type=radio] 로 표현 불가)
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!TYPES.some((t) => t.type === value) && i === 0) ? 0 : -1}
            onClick={() => onChange(type)}
            onKeyDown={(e) => handleKeyNav(e, i)}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-medium transition-colors ${
              selected
                ? 'border-primary-500 bg-primary-500 text-white shadow-sm'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-primary-300 hover:bg-primary-50/50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-primary-700 dark:hover:bg-primary-950/20'
            }`}
          >
            {isRecommended && (
              <span className="absolute -top-1.5 right-1 rounded-full bg-primary-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                추천
              </span>
            )}
            <Icon className={`size-5 ${selected ? 'text-white' : 'text-primary-500'}`} />
            {PLAN_TYPE_LABELS[type]}
          </motion.button>
        )
      })}
    </div>
  )
}
