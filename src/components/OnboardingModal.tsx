// ============================================
// Onboarding Modal Component
// ============================================

import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { PlaneTakeoff, CalendarPlus, MapPin, Map } from 'lucide-react'

const STORAGE_KEY = 'onboarding-completed'

interface OnboardingStep {
  icon: React.ReactNode
  title: string
  description: string
}

const steps: OnboardingStep[] = [
  {
    icon: <PlaneTakeoff className="size-12 text-primary-500" />,
    title: '여행을 만들어보세요',
    description: '새 여행 버튼을 눌러 여행 제목, 날짜, 방문 국가를 입력하세요. 여러 여행을 한 곳에서 관리할 수 있습니다.',
  },
  {
    icon: <CalendarPlus className="size-12 text-primary-500" />,
    title: '일정을 추가하세요',
    description: 'Day별로 방문할 장소, 식당, 숙소 등을 추가하세요. 시간과 메모를 함께 기록할 수 있습니다.',
  },
  {
    icon: <MapPin className="size-12 text-primary-500" />,
    title: '지도 URL로 자동 입력',
    description: 'Google Maps URL을 붙여넣으면 장소명, 주소, 좌표가 자동으로 추출됩니다. 정보 입력이 훨씬 쉬워집니다!',
  },
  {
    icon: <Map className="size-12 text-primary-500" />,
    title: '지도에서 확인하세요',
    description: '등록한 일정을 지도에서 한눈에 확인하세요. 이동 경로와 장소들의 위치를 시각적으로 볼 수 있습니다.',
  },
]

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      setIsOpen(true)
    }
  }, [])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setIsOpen(false)
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const step = steps[currentStep]

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle onClose={handleClose}>
        <span className="text-primary-500">Moonwave Travel</span> 시작하기
      </DialogTitle>
      <DialogBody>
        <div className="text-center py-6">
          {/* Step Indicator */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-primary-500'
                    : index < currentStep
                    ? 'bg-primary-300'
                    : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            {step.icon}
          </div>

          {/* Content */}
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            {step.title}
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
            {step.description}
          </p>

          {/* Step Counter */}
          <p className="text-xs text-zinc-400 mt-4">
            {currentStep + 1} / {steps.length}
          </p>
        </div>

        {/* Don't show again checkbox (only on last step) */}
        {currentStep === steps.length - 1 && (
          <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-zinc-300 text-primary-500 focus:ring-primary-500"
            />
            다시 보지 않기
          </label>
        )}
      </DialogBody>
      <DialogActions>
        {currentStep > 0 && (
          <Button color="secondary" onClick={handlePrev}>
            이전
          </Button>
        )}
        <Button color="primary" onClick={handleNext}>
          {currentStep === steps.length - 1 ? '시작하기' : '다음'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
