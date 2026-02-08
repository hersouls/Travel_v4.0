// ============================================
// Auto Distribute Button + Dialog
// ============================================

import { useState } from 'react'
import { Wand2, Loader2, Check } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { distributePlansTodays, type DayDistribution } from '@/services/dayDistributor'
import type { Plan } from '@/types'

interface AutoDistributeButtonProps {
  plans: Plan[]
  totalDays: number
  onApply: (assignments: Array<{ planId: number; day: number }>) => void
  className?: string
}

export function AutoDistributeButton({
  plans,
  totalDays,
  onApply,
  className = '',
}: AutoDistributeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DayDistribution[] | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const plansWithCoords = plans.filter(
    (p) => p.latitude != null && p.longitude != null,
  )

  const canDistribute = plansWithCoords.length >= 2 && totalDays >= 2

  const handleDistribute = async () => {
    setIsLoading(true)
    try {
      const distributed = distributePlansTodays(plans, totalDays)
      setResult(distributed)
      setShowDialog(true)
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (!result) return
    const assignments = result.flatMap((day: DayDistribution) =>
      day.plans.map((plan) => ({ planId: plan.id!, day: day.day })),
    )
    onApply(assignments)
    setShowDialog(false)
    setResult(null)
  }

  if (!canDistribute) return null

  return (
    <>
      <button
        type="button"
        onClick={handleDistribute}
        disabled={isLoading}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:text-violet-500 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 dark:hover:bg-violet-900/30 dark:text-violet-400 rounded-lg transition-all disabled:opacity-50 ${className}`}
        title="일정 자동 배분"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Wand2 className="size-3.5" />
        )}
        자동 배분
      </button>

      {/* Result Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} size="md">
        <DialogTitle onClose={() => setShowDialog(false)}>
          일정 자동 배분 결과
        </DialogTitle>
        <DialogBody>
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <Check className="size-5 text-violet-600" />
                <div>
                  <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
                    {totalDays}일에 {plansWithCoords.length}개 장소를 배분했습니다
                  </p>
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                    위치 기반 클러스터링으로 이동 거리를 최소화합니다
                  </p>
                </div>
              </div>

              {/* Day Breakdown */}
              <div className="space-y-2">
                {result.map((day: DayDistribution) => (
                  <div key={day.day} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                      Day {day.day}
                      <span className="text-xs text-zinc-400 ml-2">
                        {day.plans.length}개 장소
                      </span>
                    </p>
                    <div className="space-y-0.5">
                      {day.plans.map((plan) => (
                        <p
                          key={plan.id}
                          className="text-xs text-zinc-600 dark:text-zinc-400 truncate"
                        >
                          {plan.placeName}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button outline color="secondary" onClick={() => setShowDialog(false)}>
            취소
          </Button>
          <Button onClick={handleApply}>적용</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
