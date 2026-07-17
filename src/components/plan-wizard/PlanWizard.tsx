// ============================================
// PlanWizard — 표현 오케스트레이터
// 상태/네비/게이팅은 PlanForm 소유 → 여기선 렌더·전환·포커스/키보드만
// ============================================

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  FileText,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
} from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { WizardHeader } from './WizardHeader'
import { WizardNav as WizardNavBar } from './WizardNav'
import { WizardStepper } from './WizardStepper'
import { StepContent } from './steps/StepContent'
import { StepLocation } from './steps/StepLocation'
import { StepPlace } from './steps/StepPlace'
import { StepReview } from './steps/StepReview'
import { StepSchedule } from './steps/StepSchedule'
import type { PlanWizardContext, StepProps, WizardStepId } from './types'
import type { WizardNav } from './useWizard'

interface StepMeta {
  id: WizardStepId
  title: string
  subtitle: string
  short: string
  icon: LucideIcon
  skippable: boolean
  Component: (props: StepProps) => React.JSX.Element
}

const STEPS: StepMeta[] = [
  {
    id: 'place',
    title: '어디를 방문하나요?',
    subtitle: '검색·URL·붙여넣기로 자동 채우거나, 장소 이름을 입력하세요',
    short: '장소',
    icon: MapPin,
    skippable: false,
    Component: StepPlace,
  },
  {
    id: 'location',
    title: '분류와 위치',
    subtitle: '유형을 고르고 위치를 확인해요 (선택)',
    short: '위치',
    icon: MapIcon,
    skippable: true,
    Component: StepLocation,
  },
  {
    id: 'schedule',
    title: '언제 방문하나요?',
    subtitle: '며칠째, 몇 시에 방문하는지 정해요 (선택)',
    short: '일정',
    icon: Clock,
    skippable: true,
    Component: StepSchedule,
  },
  {
    id: 'content',
    title: '기록을 더해요',
    subtitle: '메모·음성 대본·사진으로 풍부하게 (선택)',
    short: '콘텐츠',
    icon: FileText,
    skippable: true,
    Component: StepContent,
  },
  {
    id: 'review',
    title: '확인하고 저장',
    subtitle: '요약을 확인한 뒤 저장하세요',
    short: '리뷰',
    icon: CheckCircle2,
    skippable: false,
    Component: StepReview,
  },
]

const STEPPER_ITEMS = STEPS.map((s) => ({
  id: s.id,
  title: s.short,
  icon: s.icon,
  skippable: s.skippable,
}))

interface PlanWizardProps {
  ctx: PlanWizardContext
  nav: WizardNav
  advanceBlocked: boolean
  maxReachableIndex: number
  onExit: () => void
  onSave: () => void
}

export function PlanWizard({
  ctx,
  nav,
  advanceBlocked,
  maxReachableIndex,
  onExit,
  onSave,
}: PlanWizardProps) {
  const reduce = useReducedMotion()
  const sectionRef = useRef<HTMLDivElement>(null)
  const current = STEPS[nav.index]

  // 단계 변경 시 스크롤 최상단 + 포커스 이동
  // biome-ignore lint/correctness/useExhaustiveDependencies: nav.index 는 단계 변경 트리거(본문 미참조여도 의도된 의존성)
  useEffect(() => {
    const scroller = document.querySelector('main')
    if (scroller) scroller.scrollTop = 0
    const t = setTimeout(() => sectionRef.current?.focus(), reduce ? 0 : 260)
    return () => clearTimeout(t)
  }, [nav.index, reduce])

  // 키보드: Cmd/Ctrl+Enter=저장, Esc=이탈
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 열린 모달(AI 다이얼로그)·이미 소비된 이벤트(팝오버 Esc 등) 위에서는 전역 위저드 단축키 비활성
      if (e.defaultPrevented || document.querySelector('[role="dialog"]')) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onSaveRef.current()
      } else if (e.key === 'Escape') {
        onExitRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleNext = useCallback(() => {
    if (!advanceBlocked) nav.goNext()
  }, [advanceBlocked, nav])

  const StepComponent = current.Component
  const dir = nav.direction

  const variants = {
    enter: (d: number) => ({ x: reduce ? 0 : d * 28, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduce ? 0 : d * -28, opacity: 0 }),
  }

  return (
    <div className="space-y-4">
      <WizardHeader
        tripTitle={ctx.currentTrip?.title}
        isEditing={ctx.isEditing}
        stepTitle={current.title}
        stepSubtitle={current.subtitle}
        stepKey={current.id}
        onBack={onExit}
      />

      <WizardStepper
        steps={STEPPER_ITEMS}
        currentIndex={nav.index}
        maxReachableIndex={maxReachableIndex}
        onJump={(i) => {
          if (i <= maxReachableIndex) nav.goTo(i)
        }}
      />

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={current.id}
          ref={sectionRef}
          tabIndex={-1}
          aria-label={current.title}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={
            reduce
              ? { duration: 0.12 }
              : { type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.2 } }
          }
          className="rounded-2xl bg-[var(--card)] p-4 outline-none ring-1 ring-zinc-950/5 dark:ring-white/10 sm:p-5"
        >
          <StepComponent ctx={ctx} />
        </motion.div>
      </AnimatePresence>

      <WizardNavBar
        isFirst={nav.isFirst}
        isLast={nav.isLast}
        nextDisabled={advanceBlocked}
        skippable={current.skippable}
        isSubmitting={ctx.isSubmitting}
        onCancel={onExit}
        onPrev={nav.goPrev}
        onNext={handleNext}
        onSkip={handleNext}
        onSave={onSave}
      />
    </div>
  )
}
