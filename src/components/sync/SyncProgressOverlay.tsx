// ============================================
// Sync Progress Overlay
// Firebase 초기 동기화 시 진행률 표시
// Tier 1: 파괴적 작업(로컬 데이터 삭제) → 풀스크린 모달
// Tier 2: 일반 동기화 → 우하단 플로팅 카드 (non-blocking)
// Tier 3: 쿨다운 스킵 → UI 없음
// ============================================

import { useEffect, useState } from 'react'
import { useSyncProgress } from '@/stores/uiStore'
import { Cloud, CloudOff, Loader2, Check, ImageIcon } from 'lucide-react'

export function SyncProgressOverlay() {
  const syncProgress = useSyncProgress()
  const [visible, setVisible] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    // Skipped syncs (cooldown active) — show nothing
    if (syncProgress.skipped) {
      setVisible(false)
      return
    }

    if (syncProgress.status === 'checking' || syncProgress.status === 'syncing') {
      setVisible(true)
      setFadingOut(false)
    } else if (syncProgress.status === 'done' && visible) {
      const timer = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => setVisible(false), 300)
      }, 800)
      return () => clearTimeout(timer)
    } else if (syncProgress.status === 'error' && visible) {
      const timer = setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => setVisible(false), 300)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [syncProgress.status, syncProgress.skipped, visible])

  if (!visible || syncProgress.skipped) return null

  const isDestructive = (syncProgress.localOnlyCount ?? 0) > 0
  const isImageSync = syncProgress.step?.includes('이미지') ?? false

  // Tier 1: Destructive operation — blocking modal
  if (isDestructive && syncProgress.status === 'syncing') {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          fadingOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-warning-100 dark:bg-warning-900/40 flex items-center justify-center">
              <Cloud className="w-7 h-7 text-warning-500 animate-pulse" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            데이터 동기화
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            {syncProgress.step}
          </p>
          <p className="text-xs text-warning-600 dark:text-warning-400 mb-3">
            로컬 전용 데이터 {syncProgress.localOnlyCount}건을 클라우드에 업로드합니다
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  // Tier 2: Routine sync — small non-blocking floating indicator
  return (
    <div
      className={`fixed bottom-24 lg:bottom-8 right-4 z-40 transition-all duration-300 ${
        fadingOut ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-center gap-2.5 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-[var(--border)] px-3.5 py-2.5 min-w-[200px]">
        {syncProgress.status === 'error' ? (
          <CloudOff className="w-4 h-4 text-danger-500 shrink-0" />
        ) : syncProgress.status === 'done' ? (
          <Check className="w-4 h-4 text-success-500 shrink-0" />
        ) : isImageSync ? (
          <ImageIcon className="w-4 h-4 text-primary-500 animate-pulse shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 text-primary-500 animate-spin shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {syncProgress.status === 'done'
              ? '동기화 완료'
              : syncProgress.status === 'error'
                ? '동기화 오류'
                : isImageSync
                  ? '이미지 동기화'
                  : 'Firebase 동기화'}
          </p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
            {syncProgress.step}
          </p>
        </div>
        {syncProgress.status === 'error' && syncProgress.error && (
          <p className="text-[10px] text-danger-500 truncate max-w-[120px]">{syncProgress.error}</p>
        )}
      </div>
    </div>
  )
}
