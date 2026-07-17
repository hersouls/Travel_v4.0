// ============================================
// WizardHeader — .dash-hero 슬림 오로라 배너 (단일 인스턴스)
// 뒤로가기 + 여행 컨텍스트 + 현재 단계 질문
// ============================================

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

interface WizardHeaderProps {
  tripTitle?: string
  isEditing: boolean
  stepTitle: string
  stepSubtitle: string
  stepKey: string
  onBack: () => void
}

export function WizardHeader({
  tripTitle,
  isEditing,
  stepTitle,
  stepSubtitle,
  stepKey,
  onBack,
}: WizardHeaderProps) {
  const reduce = useReducedMotion()

  return (
    <div className="dash-hero px-4 py-4 sm:px-6 sm:py-5">
      <div className="dash-hero__shapes" aria-hidden="true">
        <span className="dash-hero__shape dash-hero__shape--a" />
        <span className="dash-hero__shape dash-hero__shape--b" />
        <span className="dash-hero__shape dash-hero__shape--c" />
      </div>

      <div className="dash-hero__content">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로 가기"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <ArrowLeft className="hero-ink-1 size-4" />
          </button>
          <div className="min-w-0">
            <p className="hero-ink-3 text-[11px] font-semibold [letter-spacing:0.02em]">
              {isEditing ? '일정 편집' : '새 일정'}
              {tripTitle ? ` · ${tripTitle}` : ''}
            </p>
          </div>
        </div>

        {/* 단계 질문 — 단계 변경 시 크로스페이드 교체 */}
        <motion.div
          key={stepKey}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3"
        >
          <h1 className="hero-ink-1 text-xl font-bold leading-tight [letter-spacing:-0.014em] sm:text-2xl">
            {stepTitle}
          </h1>
          <p className="hero-ink-2 mt-1 text-sm leading-snug">{stepSubtitle}</p>
        </motion.div>
      </div>
    </div>
  )
}
