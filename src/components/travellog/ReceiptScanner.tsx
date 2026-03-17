// ============================================
// Receipt Scanner Component
// Photo capture → Claude Vision OCR → editable form
// ============================================

import { useState, useCallback, useRef } from 'react'
import { Receipt, Camera, Sparkles, Check, RotateCcw, X } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Lightbox } from '@/components/ui/Lightbox'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateStructured, buildReceiptFoodContext, buildReceiptGeneralContext, isValidExpenseData } from '@/services/claudeService'
import { fileToBase64, compressImage, getImageFormat } from '@/services/imageStorage'
import { extractExif } from '@/services/exifService'
import { toast } from '@/stores/uiStore'
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
  const aiProvider = useSettingsStore((state) => state.aiProvider) || 'claude'
  const aiKeyMode = useSettingsStore((state) => state.aiKeyMode) || 'server'
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'
  const geminiApiKey = useSettingsStore((state) => state.geminiApiKey)
  const geminiModel = useSettingsStore((state) => state.geminiModel) || 'flash'

  const isServerKey = aiKeyMode !== 'custom'
  const apiKey = isServerKey ? undefined : (aiProvider === 'gemini' ? geminiApiKey : claudeApiKey)
  const model = aiProvider === 'gemini' ? geminiModel : claudeModel

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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const imageSelectIdRef = useRef(0)

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const selectId = ++imageSelectIdRef.current

    try {
      // 1. Extract EXIF BEFORE compression (canvas destroys EXIF)
      const exif = await extractExif(file)
      if (imageSelectIdRef.current !== selectId) return

      setExtractedExif(exif)

      // 2. Read original image + generate thumbnail
      const full = await fileToBase64(file)
      const thumb = await compressImage(file, { maxWidth: 200, quality: 0.6 })

      if (imageSelectIdRef.current !== selectId) return

      setImagePreview(full)
      setImageBase64(full.includes(',') ? full.split(',')[1] : full)
      setThumbnailBase64(thumb)
      setExpense(null)
      setError(null)
    } catch (err) {
      if (imageSelectIdRef.current === selectId) {
        setError(err instanceof Error ? err.message : '이미지 처리에 실패했습니다.')
      }
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!isServerKey && !apiKey) {
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
      const format = imagePreview ? `image/${getImageFormat(imagePreview)}` : undefined
      const request = mode === 'food'
        ? buildReceiptFoodContext(imageBase64, format)
        : buildReceiptGeneralContext(imageBase64, format)

      const result = await generateStructured<ExpenseData>(request, apiKey, model, undefined, aiProvider)

      if (isValidExpenseData(result)) {
        setExpense({
          ...result,
          items: Array.isArray(result.items) ? result.items.filter(
            (item) => item && typeof item.name === 'string' && typeof item.amount === 'number'
          ) : [],
        })
      } else {
        setError(AI_MESSAGES.PARSE_ERROR)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '영수증 분석에 실패했습니다.'
      if (msg.includes('api_key') || msg.includes('authentication')) {
        setError('API 키를 확인해주세요. 설정에서 Claude API 키를 재입력할 수 있습니다.')
      } else if (msg.includes('429') || msg.includes('rate')) {
        setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setError(`${msg} 모드를 변경하거나 재시도해주세요.`)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }, [apiKey, model, aiProvider, imageBase64, imagePreview, mode])

  const buildLog = useCallback((): Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'> | null => {
    if (!expense || !imagePreview) return null
    return {
      tripId,
      day,
      timestamp: expense.receiptDate
        ? (() => {
            const [y, m, d] = expense.receiptDate.split('-').map(Number)
            return new Date(y, m - 1, d, 12, 0, 0).toISOString()
          })()
        : new Date().toISOString(),
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
  }, [expense, imagePreview, thumbnailBase64, tripId, day, memo, extractedExif])

  const handleConfirm = useCallback(() => {
    const log = buildLog()
    if (!log) return
    onComplete(log)
    handleClose()
  }, [buildLog, onComplete])

  const handleConfirmAndContinue = useCallback(() => {
    const log = buildLog()
    if (!log) return
    onComplete(log)

    // Reset form but keep dialog open
    setImagePreview(null)
    setImageBase64(null)
    setThumbnailBase64(null)
    setExpense(null)
    setError(null)
    setMemo('')
    setExtractedExif(null)
    toast.success('영수증이 등록되었습니다')
  }, [buildLog, onComplete])

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
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-600 dark:text-danger-400 whitespace-pre-line">
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
                  className="w-full max-h-[400px] object-contain cursor-pointer"
                  onClick={() => setIsLightboxOpen(true)}
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
                    onChange={(val) => {
                      const num = Number(val)
                      if (!isNaN(num) && isFinite(num)) {
                        updateExpense('totalAmount', num)
                      }
                    }}
                  />

                  {/* Items */}
                  {expense.items.length > 0 && (
                    <div>
                      <Label>항목</Label>
                      <div className="mt-2 space-y-1.5">
                        {expense.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const newItems = [...expense.items]
                                newItems[i] = { ...newItems[i], name: e.target.value }
                                updateExpense('items', newItems)
                              }}
                              className="flex-1 text-sm px-2 py-1 rounded-md border border-zinc-950/10 dark:border-white/10 bg-transparent text-zinc-700 dark:text-zinc-300"
                            />
                            {item.quantity && item.quantity > 1 && (
                              <span className="text-xs text-zinc-400 flex-shrink-0">x{item.quantity}</span>
                            )}
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => {
                                const newItems = [...expense.items]
                                newItems[i] = { ...newItems[i], amount: Number(e.target.value) || 0 }
                                updateExpense('items', newItems)
                              }}
                              className="w-24 text-sm text-right px-2 py-1 rounded-md border border-zinc-950/10 dark:border-white/10 bg-transparent font-medium text-zinc-900 dark:text-zinc-100"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = expense.items.filter((_, idx) => idx !== i)
                                updateExpense('items', newItems)
                              }}
                              className="text-zinc-400 hover:text-danger-500 flex-shrink-0"
                              aria-label="항목 삭제"
                            >
                              <X className="size-3.5" />
                            </button>
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
        {error && imagePreview && !isAnalyzing && (
          <Button
            color="warning"
            onClick={handleAnalyze}
            leftIcon={<RotateCcw className="size-4" />}
          >
            재시도
          </Button>
        )}
        {imagePreview && !expense && !error && (
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
          <>
            <Button
              color="secondary"
              onClick={handleConfirmAndContinue}
            >
              등록 후 계속
            </Button>
            <Button
              color="primary"
              onClick={handleConfirm}
              leftIcon={<Check className="size-4" />}
            >
              등록
            </Button>
          </>
        )}
      </DialogActions>

      {imagePreview && (
        <Lightbox
          images={[imagePreview]}
          initialIndex={0}
          open={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </Dialog>
  )
}
