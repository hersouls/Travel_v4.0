// ============================================
// Route Optimize Button + Dialog
// ============================================

import { useState } from 'react'
import { Route, Loader2, ArrowRight, Check } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { optimizeRoute, type OptimizeResult } from '@/services/routeOptimizer'
import type { Plan, TravelMode } from '@/types'
import { PLAN_TYPE_LABELS } from '@/utils/constants'

interface RouteOptimizeButtonProps {
  plans: Plan[]
  travelMode: TravelMode
  onOptimized: (optimizedPlanIds: number[]) => void
  className?: string
}

export function RouteOptimizeButton({
  plans,
  travelMode,
  onOptimized,
  className = '',
}: RouteOptimizeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const plansWithCoords = plans.filter(
    (p) => p.latitude != null && p.longitude != null,
  )

  const canOptimize = plansWithCoords.length >= 3

  const handleOptimize = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const optimized = await optimizeRoute(plans, travelMode)
      setResult(optimized)
      setShowDialog(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (!result) return
    onOptimized(result.optimizedOrder)
    setShowDialog(false)
    setResult(null)
  }

  if (!canOptimize) return null

  return (
    <>
      <button
        type="button"
        onClick={handleOptimize}
        disabled={isLoading}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-lg transition-all disabled:opacity-50 ${className}`}
        title="경로 최적화"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Route className="size-3.5" />
        )}
        경로 최적화
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {/* Result Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} size="md">
        <DialogTitle onClose={() => setShowDialog(false)}>
          경로 최적화 결과
        </DialogTitle>
        <DialogBody>
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <Check className="size-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    최적 경로를 찾았습니다
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    총 이동: {(result.totalDistanceMeters / 1000).toFixed(1)} km · {result.totalDurationText}
                  </p>
                </div>
              </div>

              {/* Optimized Order */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  최적화된 순서
                </p>
                {result.optimizedOrder.map((planId, i) => {
                  const plan = plans.find((p) => p.id === planId)
                  if (!plan) return null
                  return (
                    <div key={planId} className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {plan.placeName}
                      </span>
                      <span className="text-xs text-zinc-400 flex-shrink-0">
                        {PLAN_TYPE_LABELS[plan.type]}
                      </span>
                      {i < result.optimizedOrder.length - 1 && result.legs[i] && (
                        <>
                          <ArrowRight className="size-3 text-zinc-300 flex-shrink-0" />
                          <span className="text-xs text-zinc-400 flex-shrink-0">
                            {result.legs[i].durationText}
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
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
