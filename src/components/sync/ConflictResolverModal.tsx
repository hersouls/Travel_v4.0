// ============================================
// Conflict Resolver Modal
// 필드 레벨 동기화 충돌 해결 UI
// ============================================

import { useState, useMemo, useCallback } from 'react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useSyncConflictStore, usePendingConflicts, useConflictModalOpen } from '@/stores/syncConflictStore'
import { FIELD_LABELS_KO } from '@/utils/syncConflict'
import type { ConflictResolution } from '@/types'
import { AlertTriangle, Monitor, Cloud, ChevronLeft, ChevronRight } from 'lucide-react'

function formatDate(date: Date | string | undefined): string {
  if (!date) return '-'
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '(없음)'
  if (typeof val === 'boolean') return val ? '예' : '아니오'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return val || '(빈 값)'
  return JSON.stringify(val)
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  trip: '여행',
  plan: '일정',
  place: '장소',
}

export function ConflictResolverModal() {
  const conflicts = usePendingConflicts()
  const isOpen = useConflictModalOpen()
  const { currentIndex, setCurrentIndex, closeModal, resolveConflict, resolveAllAsCloud, resolveAllAsLocal } =
    useSyncConflictStore()

  const conflict = conflicts[currentIndex]

  // Per-field resolution state for current conflict
  const [fieldChoices, setFieldChoices] = useState<Record<string, ConflictResolution>>({})
  const [isResolving, setIsResolving] = useState(false)

  // Reset choices when conflict changes
  const conflictId = conflict?.id
  const [lastConflictId, setLastConflictId] = useState<string | null>(null)
  if (conflictId && conflictId !== lastConflictId) {
    setFieldChoices({})
    setLastConflictId(conflictId)
  }

  const allFieldsChosen = useMemo(() => {
    if (!conflict) return false
    return conflict.conflictFields.every((cf) => fieldChoices[cf.field] != null)
  }, [conflict, fieldChoices])

  const selectAllLocal = useCallback(() => {
    if (!conflict) return
    const choices: Record<string, ConflictResolution> = {}
    for (const cf of conflict.conflictFields) choices[cf.field] = 'local'
    setFieldChoices(choices)
  }, [conflict])

  const selectAllCloud = useCallback(() => {
    if (!conflict) return
    const choices: Record<string, ConflictResolution> = {}
    for (const cf of conflict.conflictFields) choices[cf.field] = 'cloud'
    setFieldChoices(choices)
  }, [conflict])

  const handleResolve = useCallback(async () => {
    if (!conflict || !allFieldsChosen) return
    setIsResolving(true)
    try {
      await resolveConflict(conflict.id, fieldChoices)
      setFieldChoices({})
    } finally {
      setIsResolving(false)
    }
  }, [conflict, allFieldsChosen, fieldChoices, resolveConflict])

  const handleResolveAllLocal = useCallback(async () => {
    setIsResolving(true)
    try {
      await resolveAllAsLocal()
    } finally {
      setIsResolving(false)
    }
  }, [resolveAllAsLocal])

  const handleResolveAllCloud = useCallback(async () => {
    setIsResolving(true)
    try {
      await resolveAllAsCloud()
    } finally {
      setIsResolving(false)
    }
  }, [resolveAllAsCloud])

  if (!isOpen || conflicts.length === 0 || !conflict) return null

  return (
    <Dialog open={isOpen} onClose={closeModal} size="lg">
      <DialogTitle onClose={closeModal}>
        <span className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-warning-500" />
          동기화 충돌 감지
        </span>
      </DialogTitle>

      <DialogBody className="space-y-4">
        {/* Navigation */}
        {conflicts.length > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {conflicts.length}개 충돌 중 {currentIndex + 1}번째
            </span>
            <div className="flex items-center gap-1">
              <Button
                plain
                color="secondary"
                size="xs"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(currentIndex - 1)}
                aria-label="이전 충돌"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                plain
                color="secondary"
                size="xs"
                disabled={currentIndex === conflicts.length - 1}
                onClick={() => setCurrentIndex(currentIndex + 1)}
                aria-label="다음 충돌"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Entity info */}
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {ENTITY_TYPE_LABEL[conflict.entityType] || conflict.entityType}: {conflict.entityLabel}
          </p>
          <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Monitor className="size-3" />
              로컬: {formatDate(conflict.localUpdatedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Cloud className="size-3" />
              클라우드: {formatDate(conflict.cloudUpdatedAt)}
            </span>
          </div>
        </div>

        {/* Bulk select buttons */}
        <div className="flex gap-2">
          <Button size="xs" outline color="secondary" onClick={selectAllLocal}>
            전체 로컬 선택
          </Button>
          <Button size="xs" outline color="secondary" onClick={selectAllCloud}>
            전체 클라우드 선택
          </Button>
        </div>

        {/* Field comparison table */}
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>필드</span>
            <span className="flex items-center gap-1">
              <Monitor className="size-3" /> 로컬
            </span>
            <span className="flex items-center gap-1">
              <Cloud className="size-3" /> 클라우드
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--border)] max-h-[40vh] overflow-y-auto">
            {conflict.conflictFields.map((cf) => {
              const choice = fieldChoices[cf.field]
              return (
                <div key={cf.field} className="grid grid-cols-[1fr_1fr_1fr] px-3 py-2 gap-1 items-start">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 pt-1">
                    {FIELD_LABELS_KO[cf.field] || cf.field}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFieldChoices((prev) => ({ ...prev, [cf.field]: 'local' }))}
                    className={`text-left text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                      choice === 'local'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500/50'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <span className="break-all line-clamp-3">{formatValue(cf.localValue)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldChoices((prev) => ({ ...prev, [cf.field]: 'cloud' }))}
                    className={`text-left text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                      choice === 'cloud'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500/50'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <span className="break-all line-clamp-3">{formatValue(cf.cloudValue)}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </DialogBody>

      <DialogActions>
        {conflicts.length > 1 && (
          <>
            <Button size="sm" outline color="secondary" onClick={handleResolveAllLocal} isLoading={isResolving}>
              전체 로컬 유지
            </Button>
            <Button size="sm" outline color="secondary" onClick={handleResolveAllCloud} isLoading={isResolving}>
              전체 클라우드 적용
            </Button>
          </>
        )}
        <Button
          size="sm"
          color="primary"
          onClick={handleResolve}
          disabled={!allFieldsChosen}
          isLoading={isResolving}
        >
          해결
        </Button>
      </DialogActions>
    </Dialog>
  )
}
