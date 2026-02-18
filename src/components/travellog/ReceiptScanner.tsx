// ============================================
// Receipt Scanner Component
// Photo capture → Claude Vision OCR → editable form
// ============================================

import { useState, useCallback } from 'react'
import { Receipt, Camera, Loader2, Sparkles, Check } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateStructured, buildReceiptFoodContext, buildReceiptGeneralContext } from '@/services/claudeService'
import { compressImage } from '@/services/imageStorage'
import { extractExif } from '@/services/exifService'
import { AI_MESSAGES, EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import type { TravelLog, ExpenseData, ExpenseCategory, ExifMetadata } from '@/types'

type ReceiptMode = 'food' | 'general'

interface ReceiptScannerProps {
  tripId: number
  defaultDay: number
  totalDays: number
  onComplete: (log: Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  open: boolean
}

const CATEGORY_OPTIONS: ExpenseCategory[] = ['food', 'transport', 'accommodation', 'shopping', 'attraction', 'other']

export function ReceiptScanner({
  tripId, defaultDay, totalDays, onComplete, onClose, open,
}: ReceiptScannerProps) {
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'

  const [mode, setMode] = useState<ReceiptMode>('food')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [thumbnailBase64, setThumbnailBase64] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expense, setExpense] = useState<ExpenseData | null>(null)
  const [day, setDay] = useState(defaultDay)
  const [memo, setMemo] = useState('')
  const [extractedExif, setExtractedExif] = useState<ExifMetadata | null>(null)

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // 1. Extract EXIF BEFORE compression (canvas destroys EXIF)
      const exif = await extractExif(file)
      setExtractedExif(exif)

      // 2. Compress images
      const full = await compressImage(file, { maxWidth: 1920, quality: 0.85 })
      const thumb = await compressImage(file, { maxWidth: 200, quality: 0.6 })
      setImagePreview(full)
      setImageBase64(full.split(',')[1])
      setThumbnailBase64(thumb)
      setExpense(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 처리에 실패했습니다.')
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!claudeApiKey) {
      setError(AI_MESSAGES.API_KEY_MISSING)
      return
    }
    if (!imageBase64) {
      setError('영수증 사진을 선택하세요.')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const request = mode === 'food'
        ? buildReceiptFoodContext(imageBase64)
        : buildReceiptGeneralContext(imageBase64)

      const result = await generateStructured<ExpenseData>(request, claudeApiKey, claudeModel)

      if (typeof result === 'string') {
        try {
          setExpense(JSON.parse(result))
        } catch {
          setError(AI_MESSAGES.PARSE_ERROR)
        }
      } else {
        setExpense(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '영수증 분석에 실패했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [claudeApiKey, claudeModel, imageBase64, mode])

  const handleConfirm = useCallback(() => {
    if (!expense || !imagePreview) return

    const log: Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'> = {
      tripId,
      day,
      timestamp: expense.receiptDate ? new Date(expense.receiptDate).toISOString() : new Date().toISOString(),
      type: 'receipt',
      photo: imagePreview,
      thumbnailPhoto: thumbnailBase64 || undefined,
      expense,
      memo: memo || undefined,
      placeName: expense.storeName,
      exif: extractedExif || undefined,
      latitude: extractedExif?.latitude,
      longitude: extractedExif?.longitude,
    }
    onComplete(log)
    handleClose()
  }, [expense, imagePreview, thumbnailBase64, tripId, day, memo, onComplete])

  const handleClose = useCallback(() => {
    setImagePreview(null)
    setImageBase64(null)
    setThumbnailBase64(null)
    setExpense(null)
    setError(null)
    setMemo('')
    setExtractedExif(null)
    onClose()
  }, [onClose])

  // Update expense field
  const updateExpense = useCallback((field: keyof ExpenseData, value: unknown) => {
    setExpense((prev) => prev ? { ...prev, [field]: value } : prev)
  }, [])

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogTitle onClose={handleClose}>
        <span className="flex items-center gap-2">
          <Receipt className="size-5 text-warning-600 dark:text-warning-400" />
          영수증 스캔
        </span>
      </DialogTitle>
      <DialogBody>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-600 dark:text-danger-400">
              {error}
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('food')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                mode === 'food'
                  ? 'bg-warning-50 dark:bg-warning-900/20 border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              음식 영수증
            </button>
            <button
              type="button"
              onClick={() => setMode('general')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                mode === 'general'
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              일반 영수증
            </button>
          </div>

          {/* Image upload */}
          {!imagePreview ? (
            <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:border-warning-500 transition-colors">
              <Camera className="size-10 text-zinc-400" />
              <span className="text-sm text-zinc-500">영수증 사진을 선택하세요</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
            </label>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={imagePreview}
                  alt="영수증"
                  className="w-full max-h-[200px] object-contain"
                />
                <label className="absolute bottom-2 right-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-zinc-900/90 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                    <Camera className="size-3" />
                    변경
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              </div>

              {/* OCR Result editable form */}
              {expense && (
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
                        className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent dark:bg-white/5 text-zinc-950 dark:text-white"
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

                  {/* Items */}
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

                  {/* Day & memo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>일차</Label>
                      <select
                        value={day}
                        onChange={(e) => setDay(Number(e.target.value))}
                        className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent dark:bg-white/5 text-zinc-950 dark:text-white"
                      >
                        {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>Day {d}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="날짜"
                      type="date"
                      value={expense.receiptDate || ''}
                      onChange={(val) => updateExpense('receiptDate', val)}
                    />
                  </div>
                  <Textarea
                    label="메모 (선택)"
                    value={memo}
                    onChange={setMemo}
                    rows={2}
                    resizable={false}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={handleClose}>
          취소
        </Button>
        {imagePreview && !expense && (
          <Button
            color="primary"
            onClick={handleAnalyze}
            isLoading={isAnalyzing}
            leftIcon={!isAnalyzing ? <Sparkles className="size-4" /> : undefined}
          >
            {isAnalyzing ? '분석 중...' : '영수증 분석'}
          </Button>
        )}
        {expense && (
          <Button
            color="primary"
            onClick={handleConfirm}
            leftIcon={<Check className="size-4" />}
          >
            등록
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
