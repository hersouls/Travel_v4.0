// ============================================
// AI Budget Estimator
// Uses Claude to estimate trip budget
// ============================================

import { useState } from 'react'
import { DollarSign, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/uiStore'
import type { Trip, Plan } from '@/types'

interface BudgetEstimate {
  total: string
  breakdown: Array<{ category: string; amount: string; details: string }>
  tips: string[]
}

interface AIBudgetEstimatorProps {
  trip: Trip
  plans: Plan[]
}

export function AIBudgetEstimator({ trip, plans }: AIBudgetEstimatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [estimate, setEstimate] = useState<BudgetEstimate | null>(null)

  const claudeEnabled = useSettingsStore((s) => s.claudeEnabled)
  const claudeApiKey = useSettingsStore((s) => s.claudeApiKey)
  const claudeModel = useSettingsStore((s) => s.claudeModel)

  if (!claudeEnabled && !claudeApiKey) return null

  const handleEstimate = async () => {
    setIsLoading(true)
    try {
      const planSummary = plans
        .map((p) => `Day${p.day}: ${p.placeName} (${p.type})`)
        .join('\n')

      const prompt = `다음 여행의 예상 여행 경비를 한국 원(KRW)으로 추정해주세요.

여행지: ${trip.country}
기간: ${trip.startDate} ~ ${trip.endDate}
일정:
${planSummary || '일정이 없습니다'}

아래 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{
  "total": "총 예상 금액 (예: 약 150만원)",
  "breakdown": [
    { "category": "항공", "amount": "약 50만원", "details": "왕복 항공권 기준" },
    { "category": "숙박", "amount": "약 40만원", "details": "3성급 호텔 기준" }
  ],
  "tips": ["팁1", "팁2"]
}`

      const response = await fetch('/api/claude/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          apiKey: claudeApiKey,
          model: claudeModel || 'sonnet',
          type: 'budget',
        }),
      })

      if (!response.ok) throw new Error('API 요청 실패')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('스트림 없음')

      let fullText = ''
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) fullText += parsed.text
            } catch { /* skip */ }
          }
        }
      }

      // Extract JSON from response
      const jsonMatch = fullText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as BudgetEstimate
        setEstimate(parsed)
      } else {
        throw new Error('응답 파싱 실패')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '예산 추정 실패')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        color="secondary"
        outline
        size="sm"
        leftIcon={<DollarSign className="size-4" />}
        onClick={() => {
          setIsOpen(true)
          if (!estimate) handleEstimate()
        }}
      >
        예산 추정
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle onClose={() => setIsOpen(false)}>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary-500" />
            AI 예산 추정
          </div>
        </DialogTitle>
        <DialogBody>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="size-8 text-primary-500 animate-spin mb-4" />
              <p className="text-sm text-zinc-500">예산을 추정하고 있습니다...</p>
            </div>
          ) : estimate ? (
            <div className="space-y-4">
              {/* Total */}
              <Card padding="md">
                <div className="text-center">
                  <p className="text-sm text-zinc-500">총 예상 경비</p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                    {estimate.total}
                  </p>
                </div>
              </Card>

              {/* Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">항목별 내역</h4>
                <div className="space-y-2">
                  {estimate.breakdown.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                    >
                      <div>
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {item.category}
                        </span>
                        <p className="text-xs text-zinc-500">{item.details}</p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {item.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              {estimate.tips && estimate.tips.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">절약 팁</h4>
                  <ul className="space-y-1">
                    {estimate.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex gap-2">
                        <span className="text-primary-500 flex-shrink-0">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500 text-sm">
              예산 추정을 시작할 수 없습니다
            </div>
          )}
        </DialogBody>
        <DialogActions>
          {estimate && (
            <Button
              color="secondary"
              outline
              size="sm"
              onClick={handleEstimate}
              isLoading={isLoading}
            >
              다시 추정
            </Button>
          )}
          <Button color="primary" onClick={() => setIsOpen(false)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
