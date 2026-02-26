// ============================================
// Photo Log Uploader Component
// EXIF extraction → image compression → preview → confirm
// AI location detection for GPS-less photos
// ============================================

import { useState, useCallback, useMemo, useRef } from 'react'
import { Camera, MapPin, Clock, Trash2, Loader2, ImagePlus, AlertTriangle, Sparkles, X, Navigation } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { extractExifBatch, calculateDayFromExif, formatExifTime } from '@/services/exifService'
import { fileToBase64, compressImage } from '@/services/imageStorage'
import { detectPhotoLocationBatch, type DetectedLocation } from '@/services/photoLocationService'
import { getCurrentPosition, reverseGeocode } from '@/services/geocodingService'
import { LocationMissingPopup } from './LocationMissingPopup'
import { useSettingsStore } from '@/stores/settingsStore'
import { getCurrencyFromCountry } from '@/utils/countryInfo'
import { CURRENCY_SYMBOLS, EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import type { TravelLog, ExifMetadata, ExpenseCategory } from '@/types'

const MAX_FILES = 20
const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

interface PhotoEntry {
  file: File
  preview: string
  base64Full: string
  thumbnailBase64: string
  exif: ExifMetadata | null
  day: number
  memo: string
  detectedLocation?: DetectedLocation
  expenseAmount: string
  expenseCategory: ExpenseCategory | ''
}

interface PhotoLogUploaderProps {
  tripId: number
  tripStartDate: string
  tripEndDate: string
  defaultDay: number
  totalDays: number
  tripCountry?: string
  onComplete: (logs: Array<Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'>>) => void | Promise<void>
  onClose: () => void
  open: boolean
}

export function PhotoLogUploader({
  tripId, tripStartDate, tripEndDate, defaultDay, totalDays, tripCountry,
  onComplete, onClose, open,
}: PhotoLogUploaderProps) {
  const [entries, setEntries] = useState<PhotoEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [processProgress, setProcessProgress] = useState<{ current: number; total: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showLocationPopup, setShowLocationPopup] = useState(false)

  // AI location detection state
  const [isDetecting, setIsDetecting] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [detectProgress, setDetectProgress] = useState<{ current: number; total: number; lastPlace?: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const claudeApiKey = useSettingsStore((s) => s.claudeApiKey)
  const claudeModel = useSettingsStore((s) => s.claudeModel) || 'sonnet'

  const defaultCurrency = useMemo(
    () => getCurrencyFromCountry(tripCountry || ''),
    [tripCountry],
  )
  const currencySymbol = CURRENCY_SYMBOLS[defaultCurrency] || defaultCurrency

  // Count photos without GPS
  const noGpsCount = useMemo(
    () => entries.filter((e) => !e.exif?.latitude && !e.exif?.longitude && !e.detectedLocation).length,
    [entries],
  )

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    setIsProcessing(true)
    setError(null)
    const newWarnings: string[] = []

    // File count limit
    const remainingSlots = MAX_FILES - entries.length
    if (files.length > remainingSlots) {
      newWarnings.push(`최대 ${MAX_FILES}장까지 가능합니다. ${files.length - remainingSlots}장이 제외됩니다.`)
      files = files.slice(0, remainingSlots)
    }

    // File size filter
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE_BYTES)
    if (oversized.length > 0) {
      newWarnings.push(`${MAX_FILE_SIZE_MB}MB 초과 파일 ${oversized.length}장 제외: ${oversized.map(f => f.name).join(', ')}`)
      files = files.filter(f => f.size <= MAX_FILE_SIZE_BYTES)
    }

    if (files.length === 0) {
      setWarnings(newWarnings)
      setIsProcessing(false)
      return
    }

    try {
      // 1. Extract EXIF from all files (BEFORE compression!)
      const exifResults = await extractExifBatch(files)

      // 2. Compress images and create thumbnails (per-file error handling)
      const newEntries: PhotoEntry[] = []
      setProcessProgress({ current: 0, total: exifResults.length })

      for (let i = 0; i < exifResults.length; i++) {
        const { file, exif } = exifResults[i]
        try {
          setProcessProgress({ current: i + 1, total: exifResults.length })
          const base64Full = await fileToBase64(file)
          const thumbnailBase64 = await compressImage(file, { maxWidth: 200, quality: 0.6 })

          // Calculate day from EXIF
          let day = defaultDay
          if (exif?.dateTime) {
            const exifDay = calculateDayFromExif(exif.dateTime, tripStartDate, tripEndDate)
            if (exifDay !== null) day = exifDay
          }

          newEntries.push({ file, preview: base64Full, base64Full, thumbnailBase64, exif, day, memo: '', expenseAmount: '', expenseCategory: '' })
        } catch (err) {
          newWarnings.push(`"${file.name}" 처리 실패: ${err instanceof Error ? err.message : '알 수 없는 에러'}`)
        }
      }

      setEntries((prev) => [...prev, ...newEntries])

      // Auto-show location popup if new photos lack GPS
      const newNoGps = newEntries.filter(e => !e.exif?.latitude || !e.exif?.longitude).length
      if (newNoGps > 0) {
        setTimeout(() => setShowLocationPopup(true), 300)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 처리에 실패했습니다.')
    } finally {
      setWarnings(newWarnings)
      setProcessProgress(null)
      setIsProcessing(false)
    }
  }, [defaultDay, tripStartDate, tripEndDate, entries.length])

  // AI location detection for GPS-less photos
  const handleDetectLocations = useCallback(async () => {
    if (!claudeApiKey) {
      setError('AI 위치 분석을 사용하려면 설정에서 Claude API Key를 입력하세요.')
      return
    }

    const photosToDetect = entries
      .map((e, i) => ({ index: i, entry: e }))
      .filter(({ entry }) => !entry.exif?.latitude && !entry.exif?.longitude && !entry.detectedLocation)

    if (photosToDetect.length === 0) return

    setIsDetecting(true)
    setDetectProgress({ current: 0, total: photosToDetect.length })
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const results = await detectPhotoLocationBatch(
        photosToDetect.map(({ index, entry }) => ({ index, base64Image: entry.base64Full })),
        tripCountry || '',
        claudeApiKey,
        claudeModel,
        (current, total, result) => {
          setDetectProgress({ current, total, lastPlace: result?.placeName })
        },
        controller.signal,
      )

      // Apply results to entries
      if (results.size > 0) {
        setEntries((prev) =>
          prev.map((entry, i) => {
            const location = results.get(i)
            return location ? { ...entry, detectedLocation: location } : entry
          }),
        )
      }
    } catch {
      // Aborted or error — silently handled
    } finally {
      setIsDetecting(false)
      setDetectProgress(null)
      abortRef.current = null
    }
  }, [entries, claudeApiKey, claudeModel, tripCountry])

  const handleCancelDetection = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // Apply current device location to all GPS-less photos
  const handleApplyCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true)
    setError(null)
    try {
      const pos = await getCurrentPosition()
      const addr = await reverseGeocode(pos.lat, pos.lng)

      const location: DetectedLocation = {
        placeName: addr || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`,
        address: addr || '',
        latitude: pos.lat,
        longitude: pos.lng,
        confidence: 'high',
        clues: '디바이스 GPS 위치',
      }

      setEntries((prev) =>
        prev.map((entry) => {
          if (!entry.exif?.latitude && !entry.exif?.longitude && !entry.detectedLocation) {
            return { ...entry, detectedLocation: location }
          }
          return entry
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '현재 위치를 가져올 수 없습니다.')
    } finally {
      setIsGettingLocation(false)
    }
  }, [])

  // Apply location from popup to all GPS-less photos
  const handleLocationPopupApply = useCallback((location: {
    latitude: number; longitude: number; address: string; placeName: string
  }) => {
    const detected: DetectedLocation = {
      placeName: location.placeName,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      confidence: 'high',
      clues: '직접 등록',
    }
    setEntries(prev => prev.map(entry => {
      if (!entry.exif?.latitude && !entry.exif?.longitude && !entry.detectedLocation) {
        return { ...entry, detectedLocation: detected }
      }
      return entry
    }))
    setShowLocationPopup(false)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    await processFiles(files)
    e.target.value = ''
  }, [processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) processFiles(files)
  }, [processFiles])

  const removeEntry = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateEntryMemo = useCallback((index: number, memo: string) => {
    setEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, memo } : entry))
  }, [])

  const updateEntryDay = useCallback((index: number, day: number) => {
    setEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, day } : entry))
  }, [])

  const clearDetectedLocation = useCallback((index: number) => {
    setEntries((prev) => prev.map((entry, i) =>
      i === index ? { ...entry, detectedLocation: undefined } : entry
    ))
  }, [])

  const updateEntryExpenseAmount = useCallback((index: number, expenseAmount: string) => {
    setEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, expenseAmount } : entry))
  }, [])

  const updateEntryExpenseCategory = useCallback((index: number, expenseCategory: string) => {
    setEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, expenseCategory: expenseCategory as ExpenseCategory | '' } : entry))
  }, [])

  const handleClose = useCallback(() => {
    abortRef.current?.abort()
    setEntries([])
    setError(null)
    setWarnings([])
    setProcessProgress(null)
    setDetectProgress(null)
    setIsDetecting(false)
    setShowLocationPopup(false)
    onClose()
  }, [onClose])

  const handleConfirm = useCallback(async () => {
    const logs: Array<Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'>> = entries.map((entry) => {
      // Use EXIF GPS if valid, otherwise fall back to AI-detected or device GPS location
      // NaN check is critical: exifr can return NaN for corrupted GPS tags,
      // and NaN ?? fallback does NOT fall through (NaN is not null/undefined)
      const exifLat = entry.exif?.latitude
      const exifLng = entry.exif?.longitude
      const hasValidExifGps = typeof exifLat === 'number' && typeof exifLng === 'number' &&
        isFinite(exifLat) && isFinite(exifLng)

      const lat = hasValidExifGps ? exifLat : entry.detectedLocation?.latitude
      const lng = hasValidExifGps ? exifLng : entry.detectedLocation?.longitude
      const placeName = entry.detectedLocation?.placeName
      const address = entry.detectedLocation?.address

      return {
        tripId,
        day: entry.day,
        timestamp: entry.exif?.dateTime || new Date().toISOString(),
        type: 'photo' as const,
        photo: entry.base64Full,
        thumbnailPhoto: entry.thumbnailBase64,
        exif: entry.exif || undefined,
        latitude: typeof lat === 'number' && isFinite(lat) ? lat : undefined,
        longitude: typeof lng === 'number' && isFinite(lng) ? lng : undefined,
        placeName,
        address,
        memo: entry.memo || undefined,
        expense: entry.expenseAmount && entry.expenseCategory
          ? {
              storeName: placeName || '',
              category: entry.expenseCategory as ExpenseCategory,
              items: [],
              totalAmount: Number(entry.expenseAmount) || 0,
              currency: defaultCurrency,
            }
          : undefined,
      }
    })
    await onComplete(logs)
    handleClose()
  }, [entries, tripId, defaultCurrency, onComplete, handleClose])

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogTitle onClose={handleClose}>
        <span className="flex items-center gap-2">
          <Camera className="size-5 text-primary-600 dark:text-primary-400" />
          사진 등록
        </span>
      </DialogTitle>
      <DialogBody>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-600 dark:text-danger-400">
              {error}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg text-sm text-warning-700 dark:text-warning-400 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="size-3.5 flex-shrink-0 mt-0.5" />
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* AI Location Detection Banner */}
          {entries.length > 0 && noGpsCount > 0 && !isDetecting && (
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
                  <MapPin className="size-4 flex-shrink-0" />
                  <span>{noGpsCount}장의 사진에 위치 정보가 없습니다</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={handleApplyCurrentLocation}
                    leftIcon={isGettingLocation ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5" />}
                    disabled={isGettingLocation}
                  >
                    <span className="hidden sm:inline">{isGettingLocation ? '위치 확인 중...' : '현재 위치 적용'}</span>
                  </Button>
                  <Button
                    color="primary"
                    size="sm"
                    onClick={handleDetectLocations}
                    leftIcon={<Sparkles className="size-3.5" />}
                    disabled={!claudeApiKey}
                  >
                    <span className="hidden sm:inline">AI 위치 분석</span>
                  </Button>
                </div>
              </div>
              {!claudeApiKey && (
                <p className="mt-1.5 text-xs text-zinc-500">설정에서 Claude API Key를 입력하면 사용할 수 있습니다</p>
              )}
            </div>
          )}

          {/* AI Detection Progress */}
          {isDetecting && detectProgress && (
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
                  <Loader2 className="size-4 animate-spin flex-shrink-0" />
                  <span>
                    {detectProgress.current}/{detectProgress.total} 위치 분석 중...
                    {detectProgress.lastPlace && (
                      <span className="ml-1 text-primary-500">({detectProgress.lastPlace})</span>
                    )}
                  </span>
                </div>
                <Button color="secondary" size="sm" onClick={handleCancelDetection}>
                  취소
                </Button>
              </div>
              <div className="mt-2 h-1.5 bg-primary-100 dark:bg-primary-900/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${(detectProgress.current / detectProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload area with drag & drop */}
          <label
            className={`flex flex-col items-center gap-2 p-4 sm:p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-[var(--border)] hover:border-primary-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isProcessing && processProgress ? (
              <>
                <Loader2 className="size-8 text-primary-500 animate-spin" />
                <span className="text-sm text-zinc-500">
                  {processProgress.current}/{processProgress.total} 처리 중...
                </span>
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="size-8 text-primary-500 animate-spin" />
                <span className="text-sm text-zinc-500">사진 처리 중...</span>
              </>
            ) : (
              <>
                <ImagePlus className="size-8 text-zinc-400" />
                <span className="text-sm text-zinc-500">사진을 선택하거나 드래그하세요 (여러 장 가능)</span>
                <span className="text-xs text-zinc-400">EXIF 정보로 시간/위치 자동 추출 · 최대 {MAX_FILES}장</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              multiple
              onChange={handleFileSelect}
              disabled={isProcessing}
            />
          </label>

          {/* Photo entries */}
          {entries.length > 0 && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {entries.map((entry, index) => {
                const hasExifGps = Boolean(entry.exif?.latitude && entry.exif?.longitude)
                const hasDetected = Boolean(entry.detectedLocation)

                return (
                  <div
                    key={index}
                    className="flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]"
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <img
                        src={entry.preview}
                        alt={`사진 ${index + 1}`}
                        className="size-20 sm:size-24 object-cover rounded-lg"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* EXIF info */}
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                        {entry.exif?.dateTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatExifTime(entry.exif.dateTime)}
                          </span>
                        )}
                        {hasExifGps && (
                          <a
                            href={`https://www.google.com/maps?q=${entry.exif!.latitude},${entry.exif!.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin className="size-3" />
                            {entry.exif!.latitude!.toFixed(4)}, {entry.exif!.longitude!.toFixed(4)}
                          </a>
                        )}
                      </div>

                      {/* AI Detected Location */}
                      {!hasExifGps && hasDetected && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Sparkles className="size-3 text-primary-500 flex-shrink-0" />
                          <a
                            href={`https://www.google.com/maps?q=${entry.detectedLocation!.latitude},${entry.detectedLocation!.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 dark:text-primary-400 hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {entry.detectedLocation!.placeName || entry.detectedLocation!.address}
                          </a>
                          <button
                            type="button"
                            onClick={() => clearDetectedLocation(index)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0"
                            aria-label="위치 삭제"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      )}

                      {/* Day selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Day</span>
                        <select
                          value={entry.day}
                          onChange={(e) => updateEntryDay(index, Number(e.target.value))}
                          className="text-xs px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        >
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>Day {d}</option>
                          ))}
                        </select>
                      </div>

                      {/* Memo */}
                      <Textarea
                        placeholder="메모 (선택)"
                        value={entry.memo}
                        onChange={(val) => updateEntryMemo(index, val)}
                        rows={1}
                        className="!mt-1"
                        resizable={false}
                      />

                      {/* 간편 경비 입력 */}
                      <div className="flex items-center gap-2 mt-1">
                        <select
                          value={entry.expenseCategory}
                          onChange={(e) => updateEntryExpenseCategory(index, e.target.value)}
                          className="text-xs px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        >
                          <option value="">카테고리</option>
                          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-zinc-400">{currencySymbol}</span>
                          <input
                            type="number"
                            placeholder="금액"
                            value={entry.expenseAmount}
                            onChange={(e) => updateEntryExpenseAmount(index, e.target.value)}
                            className="w-20 text-xs px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeEntry(index)}
                      className="flex-shrink-0 self-start p-1 text-zinc-400 hover:text-danger-500 transition-colors"
                      aria-label="삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={handleClose}>
          취소
        </Button>
        <Button
          color="primary"
          onClick={handleConfirm}
          disabled={entries.length === 0 || isProcessing || isDetecting || isGettingLocation}
        >
          {entries.length}장 등록
        </Button>
      </DialogActions>

      {/* Location missing popup - auto-triggered when GPS-less photos detected */}
      <LocationMissingPopup
        open={showLocationPopup}
        onClose={() => setShowLocationPopup(false)}
        noGpsCount={noGpsCount}
        onApplyLocation={handleLocationPopupApply}
      />
    </Dialog>
  )
}
