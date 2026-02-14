// ============================================
// AI Day Schedule Suggest Dialog
// Analyzes existing day plans and suggests improvements
// ============================================

import { useState, useRef } from 'react'
import { Lightbulb, Check, AlertTriangle, X } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  generateStructured,
  buildDaySuggestContext,
  parseDaySuggestionResponse,
} from '@/services/claudeService'
import type { Trip, Plan, DaySuggestion } from '@/types'

interface AIDaySuggestDialogProps {
  trip: Trip
  dayNumber: number
  dayPlans: Plan[]
  dayDate: Date | null
  onApply: (suggestion: DaySuggestion) => void
  onClose: () => void
  open: boolean
}

export function AIDaySuggestDialog({
  trip,
  dayNumber,
  dayPlans,
  dayDate,
  onApply,
  onClose,
  open,
}: AIDaySuggestDialogProps) {
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'

  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DaySuggestion | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleAnalyze = async () => {
    if (!claudeApiKey) {
      setError('API 키가 설정되지 않았습니다. 설정에서 Claude API 키를 입력하세요.')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setIsGenerating(true)
    setError(null)
    setResult(null)
    setShowConfirm(false)

    try {
      const context = buildDaySuggestContext(trip, dayNumber, dayPlans, dayDate)
      const response = await generateStructured<string>(
        { type: 'day-suggest', context },
        claudeApiKey,
        claudeModel,
        controller.signal,
      )

      const parsed =
        typeof response === 'string'
          ? parseDaySuggestionResponse(response)
          : (response as unknown as DaySuggestion)

      if (!parsed || !parsed.revisedPlans) {
        setError('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.')
        return
      }

      setResult(parsed)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'AI 분석에 실패했습니다.')
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
          <Lightbulb className="size-5 text-amber-500" />
          AI 일정 제안 - Day {dayNumber}
        </span>
      </DialogTitle>
      <DialogBody>
        {isGenerating ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500 animate-pulse">AI가 일정을 분석하고 있습니다...</p>
            <p className="text-xs text-zinc-400">보통 10~30초 소요됩니다</p>
          </div>
        ) : !result ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              현재 Day {dayNumber}의 {dayPlans.length}개 일정을 AI가 분석하고 개선안을 제안합니다.
            </p>

            {/* Current plans summary */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">현재 일정</p>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {dayPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                  >
                    <span className="text-xs font-mono text-zinc-400 w-12 flex-shrink-0">
                      {plan.startTime}
                    </span>
                    <span className="text-sm text-[var(--foreground)] truncate flex-1">
                      {plan.placeName}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {planTypeLabels[plan.type] || plan.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Analysis */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">분석</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{result.analysis}</p>
            </div>

            {/* Suggestions */}
            {result.suggestions && result.suggestions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[var(--foreground)] mb-2">개선 제안</p>
                <ul className="space-y-1.5">
                  {result.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                    >
                      <span className="text-amber-500 mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Revised plans */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">개선된 일정</p>
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                {result.revisedPlans.map((plan, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2.5 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-lg"
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
                    <span className="text-xs px-2 py-0.5 bg-green-200 dark:bg-green-800 rounded text-green-700 dark:text-green-300">
                      {planTypeLabels[plan.type] || plan.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning for replacement */}
            {!showConfirm && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  적용 시 기존 Day {dayNumber}의 {dayPlans.length}개 일정이 개선된{' '}
                  {result.revisedPlans.length}개 일정으로 대체됩니다.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={handleClose}>
          {isGenerating ? '닫기' : '취소'}
        </Button>
        {isGenerating && (
          <Button color="danger" outline onClick={handleCancel} leftIcon={<X className="size-4" />}>
            분석 취소
          </Button>
        )}
        {!isGenerating && !result && (
          <Button
            color="primary"
            onClick={handleAnalyze}
            leftIcon={<Lightbulb className="size-4" />}
          >
            일정 분석
          </Button>
        )}
        {result && !showConfirm && (
          <>
            <Button color="secondary" outline onClick={() => setResult(null)}>
              다시 분석
            </Button>
            <Button
              color="primary"
              onClick={() => setShowConfirm(true)}
              leftIcon={<Check className="size-4" />}
            >
              일정에 적용
            </Button>
          </>
        )}
        {result && showConfirm && (
          <>
            <Button color="secondary" onClick={() => setShowConfirm(false)}>
              뒤로
            </Button>
            <Button color="danger" onClick={handleApply}>
              기존 일정 대체 확인
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
