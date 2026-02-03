// ============================================
// PWA Update Prompt Component
// ============================================

import { RefreshCw, X } from 'lucide-react'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { Button } from '@/components/ui/Button'

export function PWAUpdatePrompt() {
  const { isUpdateAvailable, isUpdating, applyUpdate, dismissUpdate } = useServiceWorker()

  if (!isUpdateAvailable) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900 dark:bg-zinc-800 px-4 py-3 shadow-lg border border-zinc-700">
          {/* Icon & Message */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 size-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <RefreshCw className={`size-5 text-primary-400 ${isUpdating ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                새 버전이 있습니다
              </p>
              <p className="text-xs text-zinc-400">
                최신 기능을 사용하려면 업데이트하세요
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dismissUpdate}
              disabled={isUpdating}
              className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
              aria-label="나중에"
            >
              <X className="size-5" />
            </button>
            <Button
              color="primary"
              size="sm"
              onClick={applyUpdate}
              disabled={isUpdating}
              isLoading={isUpdating}
            >
              {isUpdating ? '업데이트 중...' : '업데이트'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
