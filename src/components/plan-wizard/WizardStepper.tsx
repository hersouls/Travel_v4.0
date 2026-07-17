// ============================================
// WizardStepper — 진행 표시
// sm+: 5-세그먼트 레일 / 모바일: 컴팩트 진행바
// ============================================

import { Check, type LucideIcon } from 'lucide-react'

export interface StepperItem {
  id: string
  title: string
  icon: LucideIcon
  skippable: boolean
}

interface WizardStepperProps {
  steps: StepperItem[]
  currentIndex: number
  /** 점프 가능한 최대 단계 index (placeName 게이트) — 이보다 앞 단계로는 이동 불가 */
  maxReachableIndex: number
  onJump: (index: number) => void
}

export function WizardStepper({
  steps,
  currentIndex,
  maxReachableIndex,
  onJump,
}: WizardStepperProps) {
  const progress = steps.length > 1 ? currentIndex / (steps.length - 1) : 1
  const current = steps[currentIndex]

  return (
    <nav aria-label="진행 단계" className="w-full">
      {/* 모바일: 컴팩트 — 현재 단계명 · n/5 + 그라데이션 진행바 */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {current && (
              <current.icon className="size-4 shrink-0 text-primary-500" aria-hidden="true" />
            )}
            <span className="truncate text-sm font-semibold text-[var(--foreground)]">
              {current?.title}
            </span>
            {current?.skippable && (
              <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                선택
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-500">
            {currentIndex + 1}/{steps.length}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(8, progress * 100)}%` }}
          />
        </div>
      </div>

      {/* sm+: 5-세그먼트 레일 */}
      <ol className="hidden sm:flex items-center">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isDone = i < currentIndex
          const isCurrent = i === currentIndex
          const reachable = i <= maxReachableIndex
          const isLast = i === steps.length - 1
          return (
            <li key={step.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => reachable && onJump(i)}
                  disabled={!reachable}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-disabled={!reachable || undefined}
                  className={`group relative flex size-10 items-center justify-center rounded-full transition-all ${
                    isCurrent
                      ? 'bg-primary-500 text-white shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-500)_25%,transparent)]'
                      : isDone
                        ? 'bg-primary-500 text-white'
                        : reachable
                          ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                          : 'bg-zinc-100/60 text-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {isCurrent && (
                    <span
                      className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-30"
                      aria-hidden="true"
                    />
                  )}
                  {isDone ? <Check className="size-5" /> : <Icon className="size-5" />}
                </button>
                <span
                  className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
                    isCurrent
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {step.title}
                  {step.skippable && (
                    <span className="rounded bg-zinc-100 px-1 text-[9px] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                      선택
                    </span>
                  )}
                </span>
              </div>
              {!isLast && (
                <div className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-transform duration-500 ease-out ${
                      i < currentIndex ? 'scale-x-100' : 'scale-x-0'
                    } origin-left`}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
