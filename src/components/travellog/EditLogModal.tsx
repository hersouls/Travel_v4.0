// ============================================
// Edit Log Modal Component
// Handles editing of all 3 log types: photo, receipt, memo
// With PlacesAutocomplete for location + AI location detection
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react'
import { Camera, Receipt, FileText, X, MapPin, Sparkles, Loader2, Navigation } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Label } from '@/components/ui/Input'
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete'
import { fileToBase64, compressImage } from '@/services/imageStorage'
import { detectPhotoLocation } from '@/services/photoLocationService'
import { getCurrentPosition, reverseGeocode } from '@/services/geocodingService'
import { useSettingsStore } from '@/stores/settingsStore'
import { EXPENSE_CATEGORY_LABELS, CURRENCY_SYMBOLS } from '@/utils/constants'
import { getCurrencyFromCountry } from '@/utils/countryInfo'
import type { TravelLog, ExpenseData, ExpenseCategory } from '@/types'
import type { PlaceDetails } from '@/services/placesAutocomplete'

interface EditLogModalProps {
  log: TravelLog | null
  totalDays: number
  tripCountry?: string
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

export function EditLogModal({ log, totalDays, tripCountry, onSave, onClose }: EditLogModalProps) {
  // Common fields
  const [day, setDay] = useState(1)
  const [time, setTime] = useState('')
  const [memo, setMemo] = useState('')
  const [placeName, setPlaceName] = useState('')

  // Location fields
  const [latitude, setLatitude] = useState<number | undefined>()
  const [longitude, setLongitude] = useState<number | undefined>()
  const [address, setAddress] = useState<string | undefined>()

  // Photo change (optional — keep existing if null)
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null)
  const [newThumbnailBase64, setNewThumbnailBase64] = useState<string | null>(null)

  // Receipt-specific
  const [expense, setExpense] = useState<ExpenseData | null>(null)

  // Simple expense (photo/memo types)
  const [simpleExpenseAmount, setSimpleExpenseAmount] = useState('')
  const [simpleExpenseCategory, setSimpleExpenseCategory] = useState<ExpenseCategory | ''>('')

  // AI detection & device location
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aiProvider = useSettingsStore((s) => s.aiProvider) || 'claude'
  const aiKeyMode = useSettingsStore((s) => s.aiKeyMode) || 'server'
  const claudeApiKey = useSettingsStore((s) => s.claudeApiKey)
  const claudeModel = useSettingsStore((s) => s.claudeModel) || 'sonnet'
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const geminiModel = useSettingsStore((s) => s.geminiModel) || 'flash'

  const isServerKey = aiKeyMode !== 'custom'
  const apiKey = isServerKey ? undefined : (aiProvider === 'gemini' ? geminiApiKey : claudeApiKey)
  const model = aiProvider === 'gemini' ? geminiModel : claudeModel

  const defaultCurrency = getCurrencyFromCountry(tripCountry || '')
  const currencySymbol = CURRENCY_SYMBOLS[defaultCurrency] || defaultCurrency

  // Track original values for change detection
  const originalRef = useRef<{
    day: number; time: string; memo: string; placeName: string;
    latitude?: number; longitude?: number; address?: string;
    expense: string | null; hasNewPhoto: boolean
  } | null>(null)

  // Initialize state from log prop
  useEffect(() => {
    if (!log) return
    const d = new Date(log.timestamp)
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    setDay(log.day)
    setTime(timeStr)
    setMemo(log.memo || '')
    setPlaceName(log.placeName || '')
    setLatitude(log.latitude)
    setLongitude(log.longitude)
    setAddress(log.address)
    setNewPhotoPreview(null)
    setNewThumbnailBase64(null)
    setExpense(log.expense ? { ...log.expense } : null)
    if (log.expense && log.type !== 'receipt') {
      setSimpleExpenseAmount(String(log.expense.totalAmount))
      setSimpleExpenseCategory(log.expense.category)
    } else {
      setSimpleExpenseAmount('')
      setSimpleExpenseCategory('')
    }
    setError(null)

    originalRef.current = {
      day: log.day,
      time: timeStr,
      memo: log.memo || '',
      placeName: log.placeName || '',
      latitude: log.latitude,
      longitude: log.longitude,
      address: log.address,
      expense: log.expense ? JSON.stringify(log.expense) : null,
      hasNewPhoto: false,
    }
  }, [log])

  // Detect unsaved changes
  const hasChanges = useCallback((): boolean => {
    if (!originalRef.current) return false
    const orig = originalRef.current
    if (day !== orig.day) return true
    if (time !== orig.time) return true
    if (memo !== orig.memo) return true
    if (placeName !== orig.placeName) return true
    if (latitude !== orig.latitude) return true
    if (longitude !== orig.longitude) return true
    if (address !== orig.address) return true
    if (newPhotoPreview) return true
    if (expense && orig.expense && JSON.stringify(expense) !== orig.expense) return true
    if (simpleExpenseAmount || simpleExpenseCategory) return true
    return false
  }, [day, time, memo, placeName, latitude, longitude, address, newPhotoPreview, expense, simpleExpenseAmount, simpleExpenseCategory])

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const full = await fileToBase64(file)
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

  // PlacesAutocomplete handler
  const handlePlaceSelect = useCallback((details: PlaceDetails) => {
    setPlaceName(details.name)
    setLatitude(details.latitude)
    setLongitude(details.longitude)
    setAddress(details.address)
  }, [])

  // AI location detection
  const handleAIDetect = useCallback(async () => {
    if ((!isServerKey && !apiKey) || !log) return

    const photoBase64 = newPhotoPreview || log.photo
    if (!photoBase64) return

    setIsDetectingLocation(true)
    setError(null)

    try {
      const result = await detectPhotoLocation(
        photoBase64,
        tripCountry || '',
        apiKey,
        model,
        undefined,
        aiProvider,
      )

      if (result) {
        setPlaceName(result.placeName)
        setLatitude(result.latitude)
        setLongitude(result.longitude)
        setAddress(result.address)
      } else {
        setError('사진에서 위치를 감지하지 못했습니다.')
      }
    } catch {
      setError('AI 위치 분석에 실패했습니다.')
    } finally {
      setIsDetectingLocation(false)
    }
  }, [isServerKey, apiKey, model, log, newPhotoPreview, tripCountry])

  // Device geolocation
  const handleCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true)
    setError(null)
    try {
      const pos = await getCurrentPosition()
      const addr = await reverseGeocode(pos.lat, pos.lng)
      setLatitude(pos.lat)
      setLongitude(pos.lng)
      setAddress(addr || undefined)
      if (!placeName.trim()) {
        setPlaceName(addr || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '현재 위치를 가져올 수 없습니다.')
    } finally {
      setIsGettingLocation(false)
    }
  }, [placeName])

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
        latitude,
        longitude,
        address: address || undefined,
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

      // Simple expense for photo/memo types
      if (log.type !== 'receipt') {
        if (simpleExpenseAmount && simpleExpenseCategory) {
          updates.expense = {
            storeName: placeName.trim() || '',
            category: simpleExpenseCategory as ExpenseCategory,
            items: [],
            totalAmount: Number(simpleExpenseAmount) || 0,
            currency: defaultCurrency,
          }
        } else {
          updates.expense = undefined
        }
      }

      await onSave(log.id, updates)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }, [log, day, time, memo, placeName, latitude, longitude, address, newPhotoPreview, newThumbnailBase64, expense, simpleExpenseAmount, simpleExpenseCategory, defaultCurrency, onSave, onClose])

  const handleClose = useCallback(() => {
    if (hasChanges()) {
      if (!window.confirm('수정한 내용이 있습니다. 저장하지 않고 닫으시겠습니까?')) {
        return
      }
    }
    setError(null)
    onClose()
  }, [onClose, hasChanges])

  if (!log) return null

  const TitleIcon = titleConfig[log.type].icon
  const currentPhoto = newPhotoPreview || log.thumbnailPhoto
  const hasPhoto = Boolean(newPhotoPreview || log.photo)
  const hasLocation = Boolean(latitude && longitude)

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
                    className="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-600"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
                onChange={(val) => {
                  const num = Number(val)
                  if (!isNaN(num) && isFinite(num)) {
                    updateExpense('totalAmount', num)
                  }
                }}
              />
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
              <Input
                label="날짜"
                type="date"
                value={expense.receiptDate || ''}
                onChange={(val) => updateExpense('receiptDate', val)}
              />
            </div>
          )}

          {/* Location: PlacesAutocomplete + AI detect */}
          {log.type !== 'receipt' && (
            <div className="space-y-2">
              <PlacesAutocomplete
                label="장소 검색"
                placeholder="장소 이름 또는 주소를 검색하세요"
                value={placeName}
                onChange={setPlaceName}
                onPlaceSelect={handlePlaceSelect}
              />

              {/* Current location display */}
              {hasLocation && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <MapPin className="size-4 text-primary-500 flex-shrink-0" />
                  <a
                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
                  >
                    {address || `${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`}
                  </a>
                  <button
                    type="button"
                    onClick={() => { setLatitude(undefined); setLongitude(undefined); setAddress(undefined) }}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0"
                    aria-label="위치 제거"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Location action buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Button
                  color="secondary"
                  size="sm"
                  onClick={handleCurrentLocation}
                  leftIcon={isGettingLocation ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5" />}
                  disabled={isGettingLocation || isDetectingLocation}
                >
                  {isGettingLocation ? '위치 확인 중...' : '현재 위치'}
                </Button>
                {hasPhoto && !hasLocation && (isServerKey || apiKey) && (
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={handleAIDetect}
                    leftIcon={isDetectingLocation ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    disabled={isDetectingLocation || isGettingLocation}
                  >
                    {isDetectingLocation ? 'AI 분석 중...' : 'AI로 위치 감지'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Simple expense input (photo/memo types) */}
          {log.type !== 'receipt' && (
            <div className="space-y-2">
              <Label>간편 경비</Label>
              <div className="flex items-center gap-2">
                <select
                  value={simpleExpenseCategory}
                  onChange={(e) => setSimpleExpenseCategory(e.target.value as ExpenseCategory | '')}
                  className="text-sm px-3 py-2 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent dark:bg-white/5 text-zinc-950 dark:text-white"
                >
                  <option value="">카테고리</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{EXPENSE_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-sm text-zinc-400">{currencySymbol}</span>
                  <input
                    type="number"
                    placeholder="금액"
                    value={simpleExpenseAmount}
                    onChange={(e) => setSimpleExpenseAmount(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent dark:bg-white/5 text-zinc-950 dark:text-white"
                  />
                </div>
              </div>
            </div>
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
