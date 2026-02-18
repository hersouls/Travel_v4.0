// ============================================
// Edit Log Modal Component
// Handles editing of all 3 log types: photo, receipt, memo
// ============================================

import { useState, useCallback, useEffect } from 'react'
import { Camera, Receipt, FileText, X } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Label } from '@/components/ui/Input'
import { compressImage } from '@/services/imageStorage'
import { EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import type { TravelLog, ExpenseData, ExpenseCategory } from '@/types'

interface EditLogModalProps {
  log: TravelLog | null
  totalDays: number
  onSave: (id: number, updates: Partial<TravelLog>) => Promise<void>
  onClose: () => void
}

const CATEGORY_OPTIONS: ExpenseCategory[] = [
  'food', 'transport', 'accommodation', 'shopping', 'attraction', 'other',
]

const SELECT_CLASS =
  'mt-2 w-full px-3 py-2 text-sm rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent dark:bg-white/5 text-zinc-950 dark:text-white'

const titleConfig = {
  photo: { icon: Camera, label: '사진 기록 수정', iconClass: 'text-primary-600 dark:text-primary-400' },
  receipt: { icon: Receipt, label: '영수증 기록 수정', iconClass: 'text-warning-600 dark:text-warning-400' },
  memo: { icon: FileText, label: '메모 기록 수정', iconClass: 'text-success-600 dark:text-success-400' },
} as const

export function EditLogModal({ log, totalDays, onSave, onClose }: EditLogModalProps) {
  // Common fields
  const [day, setDay] = useState(1)
  const [time, setTime] = useState('')
  const [memo, setMemo] = useState('')
  const [placeName, setPlaceName] = useState('')

  // Photo change (optional — keep existing if null)
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null)
  const [newThumbnailBase64, setNewThumbnailBase64] = useState<string | null>(null)

  // Receipt-specific
  const [expense, setExpense] = useState<ExpenseData | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize state from log prop
  useEffect(() => {
    if (!log) return
    setDay(log.day)
    const d = new Date(log.timestamp)
    setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    setMemo(log.memo || '')
    setPlaceName(log.placeName || '')
    setNewPhotoPreview(null)
    setNewThumbnailBase64(null)
    setExpense(log.expense ? { ...log.expense } : null)
    setError(null)
  }, [log])

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const full = await compressImage(file, { maxWidth: 1920, quality: 0.85 })
      const thumb = await compressImage(file, { maxWidth: 200, quality: 0.6 })
      setNewPhotoPreview(full)
      setNewThumbnailBase64(thumb)
    } catch {
      setError('이미지 처리에 실패했습니다.')
    }
  }, [])

  const removeNewPhoto = useCallback(() => {
    setNewPhotoPreview(null)
    setNewThumbnailBase64(null)
  }, [])

  const updateExpense = useCallback((field: keyof ExpenseData, value: unknown) => {
    setExpense((prev) => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const handleSave = useCallback(async () => {
    if (!log?.id) return
    setIsSaving(true)
    setError(null)
    try {
      const [hours, minutes] = time.split(':').map(Number)
      const ts = new Date(log.timestamp)
      ts.setHours(hours, minutes, 0, 0)

      const updates: Partial<TravelLog> = {
        day,
        timestamp: ts.toISOString(),
        memo: memo.trim() || undefined,
        placeName: placeName.trim() || undefined,
      }

      // Only include new photo if user selected one
      if (newPhotoPreview && newThumbnailBase64) {
        updates.photo = newPhotoPreview
        updates.thumbnailPhoto = newThumbnailBase64
      }

      // Receipt-specific
      if (log.type === 'receipt' && expense) {
        updates.expense = expense
        updates.placeName = expense.storeName || placeName.trim() || undefined
      }

      await onSave(log.id, updates)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }, [log, day, time, memo, placeName, newPhotoPreview, newThumbnailBase64, expense, onSave, onClose])

  const handleClose = useCallback(() => {
    setError(null)
    onClose()
  }, [onClose])

  if (!log) return null

  const TitleIcon = titleConfig[log.type].icon
  const currentPhoto = newPhotoPreview || log.thumbnailPhoto

  return (
    <Dialog open={!!log} onClose={handleClose} size="lg">
      <DialogTitle onClose={handleClose}>
        <span className="flex items-center gap-2">
          <TitleIcon className={`size-5 ${titleConfig[log.type].iconClass}`} />
          {titleConfig[log.type].label}
        </span>
      </DialogTitle>

      <DialogBody>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-600 dark:text-danger-400">
              {error}
            </div>
          )}

          {/* Common: Day + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>일차</Label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className={SELECT_CLASS}
              >
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>Day {d}</option>
                ))}
              </select>
            </div>
            <Input
              label="시간"
              type="time"
              value={time}
              onChange={setTime}
            />
          </div>

          {/* Photo preview + change (photo & memo types) */}
          {(log.type === 'photo' || log.type === 'memo') && (
            <div>
              {currentPhoto && (
                <div className="relative mb-3">
                  <img
                    src={currentPhoto}
                    alt="사진"
                    className="w-full max-h-48 object-cover rounded-lg"
                  />
                  {newPhotoPreview && (
                    <button
                      type="button"
                      onClick={removeNewPhoto}
                      className="absolute -top-2 -right-2 size-5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center"
                      aria-label="새 사진 취소"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] cursor-pointer hover:bg-[var(--muted)] transition-colors">
                <Camera className="size-4" />
                {log.thumbnailPhoto ? '사진 변경 (선택)' : '사진 추가 (선택)'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
          )}

          {/* Receipt photo preview + change */}
          {log.type === 'receipt' && (
            <div>
              {currentPhoto && (
                <div className="relative inline-block mb-3">
                  <img
                    src={currentPhoto}
                    alt="영수증"
                    className="w-24 h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-600"
                  />
                  {newPhotoPreview && (
                    <button
                      type="button"
                      onClick={removeNewPhoto}
                      className="absolute -top-2 -right-2 size-5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center"
                      aria-label="새 사진 취소"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] cursor-pointer hover:bg-[var(--muted)] transition-colors">
                <Camera className="size-4" />
                영수증 사진 변경 (선택)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
          )}

          {/* Receipt expense fields */}
          {log.type === 'receipt' && expense && (
            <div className="space-y-3 p-4 bg-[var(--card)] rounded-lg border border-[var(--border)]">
              <Input
                label="가게명"
                value={expense.storeName}
                onChange={(val) => updateExpense('storeName', val)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>카테고리</Label>
                  <select
                    value={expense.category}
                    onChange={(e) => updateExpense('category', e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>{EXPENSE_CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="통화"
                  value={expense.currency}
                  onChange={(val) => updateExpense('currency', val.toUpperCase())}
                  placeholder="KRW"
                />
              </div>
              <Input
                label="총 금액"
                type="number"
                value={String(expense.totalAmount)}
                onChange={(val) => updateExpense('totalAmount', Number(val))}
              />
              {expense.items.length > 0 && (
                <div>
                  <Label>항목</Label>
                  <div className="mt-2 space-y-1.5">
                    {expense.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-zinc-700 dark:text-zinc-300 truncate">{item.name}</span>
                        {item.quantity && item.quantity > 1 && (
                          <span className="text-zinc-400">x{item.quantity}</span>
                        )}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Input
                label="날짜"
                type="date"
                value={expense.receiptDate || ''}
                onChange={(val) => updateExpense('receiptDate', val)}
              />
            </div>
          )}

          {/* Common: Place Name */}
          {log.type !== 'receipt' && (
            <Input
              label="장소명 (선택)"
              value={placeName}
              onChange={setPlaceName}
              placeholder="예: 도쿄타워, 하카타 라멘집"
            />
          )}

          {/* Common: Memo */}
          <Textarea
            label={log.type === 'memo' ? '메모' : '메모 (선택)'}
            value={memo}
            onChange={setMemo}
            rows={log.type === 'memo' ? 4 : 2}
            placeholder="기록을 수정하세요..."
            resizable={log.type === 'memo'}
          />
        </div>
      </DialogBody>

      <DialogActions>
        <Button color="secondary" onClick={handleClose}>
          취소
        </Button>
        <Button
          color="primary"
          onClick={handleSave}
          isLoading={isSaving}
          disabled={log.type === 'memo' && !memo.trim()}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  )
}
