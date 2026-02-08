// ============================================
// AI Itinerary Generator Dialog
// Auto-generates full trip itinerary using Claude AI
// ============================================

import { useState } from 'react'
import { Sparkles, Loader2, Check, Calendar } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateStructured, buildItineraryContext, parseItineraryResponse } from '@/services/claudeService'
import type { Trip, GeneratedItinerary, PlanType } from '@/types'

const INTEREST_OPTIONS = [
  { value: '관광', label: '관광' },
  { value: '맛집', label: '맛집' },
  { value: '쇼핑', label: '쇼핑' },
  { value: '자연', label: '자연' },
  { value: '문화', label: '문화' },
  { value: '야경', label: '야경' },
]

const STYLE_OPTIONS = [
  { value: '여유로운', label: '여유로운' },
  { value: '알찬', label: '알찬' },
  { value: '균형', label: '균형' },
]

const BUDGET_OPTIONS = [
  { value: '절약', label: '절약' },
  { value: '보통', label: '보통' },
  { value: '럭셔리', label: '럭셔리' },
]

interface AIItineraryDialogProps {
  trip: Trip
  totalDays: number
  existingPlansCount: number
  onApply: (itinerary: GeneratedItinerary) => void
  onClose: () => void
  open: boolean
}

export function AIItineraryDialog({
  trip,
  totalDays,
  existingPlansCount,
  onApply,
  onClose,
  open,
}: AIItineraryDialogProps) {
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'

  const [interests, setInterests] = useState<string[]>(['관광', '맛집'])
  const [style, setStyle] = useState('균형')
  const [budget, setBudget] = useState('보통')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedItinerary | null>(null)

  const toggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  const handleGenerate = async () => {
    if (!claudeApiKey) {
      setError('API 키가 설정되지 않았습니다. 설정에서 Claude API 키를 입력하세요.')
      return
    }

    if (interests.length === 0) {
      setError('관심사를 하나 이상 선택하세요.')
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const context = buildItineraryContext(trip, totalDays, { interests, style, budget })
      const response = await generateStructured<string>(
        { type: 'itinerary', context },
        claudeApiKey,
        claudeModel,
      )

      const parsed = typeof response === 'string'
        ? parseItineraryResponse(response)
        : response as unknown as GeneratedItinerary

      if (!parsed || !parsed.days) {
        setError('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.')
        return
      }

      setResult(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 일정 생성에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApply = () => {
    if (result) {
      onApply(result)
      onClose()
    }
  }

  const planTypeLabels: Record<string, string> = {
    attraction: '관광',
    restaurant: '맛집',
    hotel: '숙소',
    transport: '교통',
    other: '기타',
  }

  return (
    <Dialog open={open} onClose={onClose} size="xl">
      <DialogTitle onClose={onClose}>
        <span className="flex items-center gap-2">
          <Calendar className="size-5 text-purple-500" />
          AI 일정 생성
        </span>
      </DialogTitle>
      <DialogBody>
        {!result ? (
          <div className="space-y-5">
            <p className="text-sm text-zinc-500">
              {trip.country} 여행 ({totalDays}일)에 맞는 일정을 AI가 자동 생성합니다.
            </p>

            {existingPlansCount > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                기존 {existingPlansCount}개 일정이 있습니다. AI 일정은 새로 추가됩니다.
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Interests */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">관심사</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleInterest(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      interests.includes(option.value)
                        ? 'bg-purple-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">여행 스타일</p>
              <div className="flex gap-2">
                {STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStyle(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 ${
                      style === option.value
                        ? 'bg-purple-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">예산</p>
              <div className="flex gap-2">
                {BUDGET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBudget(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 ${
                      budget === option.value
                        ? 'bg-purple-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              AI가 생성한 일정을 검토하세요. "적용"을 클릭하면 일정에 추가됩니다.
            </p>

            <div className="max-h-[400px] overflow-y-auto space-y-4">
              {result.days.map((day) => (
                <div key={day.day} className="space-y-2">
                  <h3 className="text-sm font-bold text-[var(--foreground)] sticky top-0 bg-white dark:bg-zinc-900 py-1">
                    Day {day.day}
                  </h3>
                  {day.plans.map((plan, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                    >
                      <span className="text-xs font-mono text-zinc-400 w-12 flex-shrink-0">
                        {plan.startTime}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {plan.placeName}
                        </p>
                        {plan.address && (
                          <p className="text-xs text-zinc-400 truncate">{plan.address}</p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300">
                        {planTypeLabels[plan.type] || plan.type}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={onClose}>
          취소
        </Button>
        {!result && (
          <Button
            color="primary"
            onClick={handleGenerate}
            isLoading={isGenerating}
            leftIcon={!isGenerating ? <Sparkles className="size-4" /> : undefined}
          >
            {isGenerating ? '생성 중...' : '일정 생성'}
          </Button>
        )}
        {result && (
          <>
            <Button
              color="secondary"
              outline
              onClick={() => setResult(null)}
            >
              다시 생성
            </Button>
            <Button
              color="primary"
              onClick={handleApply}
              leftIcon={<Check className="size-4" />}
            >
              일정에 적용
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
