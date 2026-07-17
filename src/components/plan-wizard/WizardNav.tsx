// ============================================
// WizardNav — 하단 sticky 글래스 네비게이션
// 이전/취소 · 건너뛰기 · 다음/저장 (단일 주액션)
// ============================================

import { Button } from '@/components/ui/Button'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

interface WizardNavProps {
  isFirst: boolean
  isLast: boolean
  /** 다음 버튼 비활성 (예: 1단계 장소명 미입력) */
  nextDisabled: boolean
  skippable: boolean
  isSubmitting: boolean
  onCancel: () => void
  onPrev: () => void
  onNext: () => void
  onSkip: () => void
  onSave: () => void
}

export function WizardNav({
  isFirst,
  isLast,
  nextDisabled,
  skippable,
  isSubmitting,
  onCancel,
  onPrev,
  onNext,
  onSkip,
  onSave,
}: WizardNavProps) {
  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-3 mt-6 border-t border-zinc-200/70 bg-[var(--background)]/85 px-3 pt-3 pb-3 backdrop-blur-lg lg:bottom-0 lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-zinc-800/70 sm:-mx-4 sm:px-4">
      <div className="mx-auto flex max-w-screen-md items-center gap-2">
        <Button
          type="button"
          color="secondary"
          outline
          onClick={isFirst ? onCancel : onPrev}
          leftIcon={isFirst ? undefined : <ArrowLeft className="size-4" />}
          className="min-h-[44px]"
        >
          {isFirst ? '취소' : '이전'}
        </Button>

        <div className="flex-1" />

        {skippable && !isLast && (
          <button
            type="button"
            onClick={onSkip}
            disabled={nextDisabled}
            aria-disabled={nextDisabled || undefined}
            className="inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-40 dark:hover:text-zinc-300"
          >
            건너뛰기
          </button>
        )}

        {isLast ? (
          <Button
            type="button"
            color="primary"
            onClick={onSave}
            isLoading={isSubmitting}
            leftIcon={<Check className="size-4" />}
            className="min-h-[44px]"
          >
            저장
          </Button>
        ) : (
          <Button
            type="button"
            color="primary"
            onClick={onNext}
            disabled={nextDisabled}
            aria-disabled={nextDisabled || undefined}
            className="min-h-[44px]"
          >
            <span className="inline-flex items-center gap-1.5">
              다음
              <ArrowRight className="size-4" />
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
