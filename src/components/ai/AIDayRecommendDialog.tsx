// ============================================
// AI Day Schedule Recommend Dialog
// Generates a single day itinerary from keywords using Claude AI
// ============================================

import { useState, useRef } from 'react'
import { Sparkles, Check, X } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  generateStructured,
  buildDayRecommendContext,
  parseItineraryResponse,
} from '@/services/claudeService'
import type { Trip, GeneratedItinerary } from '@/types'

const INTEREST_OPTIONS = [
  { value: '관광', label: '관광' },
  { value: '맛집', label: '맛집' },
  { value: '쇼핑', label: '쇼핑' },
  { value: '자연', label: '자연' },
  { value: '문화', label: '문화' },
  { value: '야경', label: '야경' },
  { value: '카페', label: '카페' },
]

const STYLE_OPTIONS = [
  { value: '여유로운', label: '여유로운' },
  { value: '알찬', label: '알찬' },
  { value: '균형', label: '균형' },
]

interface AIDayRecommendDialogProps {
  trip: Trip
  dayNumber: number
  totalDays: number
  dayDate: Date | null
  existingPlansCount: number
  onApply: (itinerary: GeneratedItinerary) => void
  onClose: () => void
  open: boolean
}

export function AIDayRecommendDialog({
  trip,
  dayNumber,
  totalDays,
  dayDate,
  existingPlansCount,
  onApply,
  onClose,
  open,
}: AIDayRecommendDialogProps) {
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'

  const [keywords, setKeywords] = useState('')
  const [interests, setInterests] = useState<string[]>(['관광', '맛집'])
  const [style, setStyle] = useState('균형')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedItinerary | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    if (!keywords.trim() && interests.length === 0) {
      setError('키워드를 입력하거나 관심사를 하나 이상 선택하세요.')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const context = buildDayRecommendContext(trip, dayNumber, totalDays, dayDate, {
        keywords: keywords.trim(),
        interests,
        style,
      })
      const response = await generateStructured<string>(
        { type: 'day-recommend', context },
        claudeApiKey,
        claudeModel,
        controller.signal,
      )

      const parsed =
        typeof response === 'string'
          ? parseItineraryResponse(response)
          : (response as unknown as GeneratedItinerary)

      if (!parsed || !parsed.days) {
        setError('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.')
        return
      }

      setResult(parsed)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'AI 일정 추천에 실패했습니다.')
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }

  const handleClose = () => {
    abortRef.current?.abort()
    onClose()
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
    <Dialog open={open} onClose={handleClose} size="xl">
      <DialogTitle onClose={handleClose}>
        <span className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary-500" />
          AI 일정 추천 - Day {dayNumber}
        </span>
      </DialogTitle>
      <DialogBody>
        {isGenerating ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500 animate-pulse">AI가 일정을 생성하고 있습니다...</p>
            <p className="text-xs text-zinc-400">보통 10~30초 소요됩니다</p>
          </div>
        ) : !result ? (
          <div className="space-y-5">
            <p className="text-sm text-zinc-500">
              {trip.country} 여행 Day {dayNumber}에 맞는 일정을 AI가 추천합니다.
            </p>

            {existingPlansCount > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                기존 {existingPlansCount}개 일정이 있습니다. AI 추천 일정은 기존 일정 뒤에
                추가됩니다.
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Keywords input */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                관심 키워드 / 가고 싶은 장소
              </p>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="예: 에펠탑, 세느강, 마레지구, 크루아상"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-[var(--foreground)] placeholder-zinc-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-zinc-400 mt-1">
                쉼표로 구분하여 장소명, 지역명, 키워드 등을 입력하세요
              </p>
            </div>

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
                        ? 'bg-primary-500 text-white'
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
                        ? 'bg-primary-500 text-white'
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
              AI가 추천한 일정을 검토하세요. "적용"을 클릭하면 일정에 추가됩니다.
            </p>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {result.days[0]?.plans.map((plan, idx) => (
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
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={handleClose}>
          {isGenerating ? '닫기' : '취소'}
        </Button>
        {isGenerating && (
          <Button color="danger" outline onClick={handleCancel} leftIcon={<X className="size-4" />}>
            생성 취소
          </Button>
        )}
        {!isGenerating && !result && (
          <Button
            color="primary"
            onClick={handleGenerate}
            leftIcon={<Sparkles className="size-4" />}
          >
            일정 추천
          </Button>
        )}
        {result && (
          <>
            <Button color="secondary" outline onClick={() => setResult(null)}>
              다시 생성
            </Button>
            <Button color="primary" onClick={handleApply} leftIcon={<Check className="size-4" />}>
              일정에 적용
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
