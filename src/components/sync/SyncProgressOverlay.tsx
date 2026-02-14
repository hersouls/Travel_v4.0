// ============================================
// Sync Progress Overlay
// Firebase 초기 동기화 시 진행률 표시
// ============================================

import { useEffect, useState } from 'react'
import { useSyncProgress } from '@/stores/uiStore'
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react'

export function SyncProgressOverlay() {
  const syncProgress = useSyncProgress()
  const [visible, setVisible] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    if (syncProgress.status === 'checking' || syncProgress.status === 'syncing') {
      setVisible(true)
      setFadingOut(false)
    } else if (syncProgress.status === 'done' && visible) {
      const timer = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => setVisible(false), 500)
      }, 1200)
      return () => clearTimeout(timer)
    } else if (syncProgress.status === 'error' && visible) {
      const timer = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => setVisible(false), 500)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [syncProgress.status, visible])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-500 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {syncProgress.status === 'error' ? (
            <div className="w-14 h-14 rounded-full bg-danger-100 dark:bg-danger-900/40 flex items-center justify-center">
              <CloudOff className="w-7 h-7 text-danger-500" />
            </div>
          ) : syncProgress.status === 'done' ? (
            <div className="w-14 h-14 rounded-full bg-success-100 dark:bg-success-900/40 flex items-center justify-center">
              <Check className="w-7 h-7 text-success-500" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Cloud className="w-7 h-7 text-primary-500 animate-pulse" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          {syncProgress.status === 'done'
            ? '동기화 완료'
            : syncProgress.status === 'error'
              ? '동기화 오류'
              : 'Firebase 동기화'}
        </h3>

        {/* Step text */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          {syncProgress.step || '데이터를 확인하고 있습니다...'}
        </p>

        {/* Local-only count warning */}
        {syncProgress.localOnlyCount != null && syncProgress.localOnlyCount > 0 && syncProgress.status === 'syncing' && (
          <p className="text-xs text-warning-600 dark:text-warning-400 mb-3">
            로컬 전용 데이터 {syncProgress.localOnlyCount}건이 삭제됩니다
          </p>
        )}

        {/* Spinner for active states */}
        {(syncProgress.status === 'checking' || syncProgress.status === 'syncing') && (
          <div className="flex justify-center">
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
          </div>
        )}

        {/* Error message */}
        {syncProgress.status === 'error' && syncProgress.error && (
          <p className="text-xs text-danger-500 mt-2 break-words">{syncProgress.error}</p>
        )}
      </div>
    </div>
  )
}
