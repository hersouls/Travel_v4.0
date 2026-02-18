// ============================================
// Photo Log Uploader Component
// EXIF extraction → image compression → preview → confirm
// ============================================

import { useState, useCallback } from 'react'
import { Camera, MapPin, Clock, Trash2, Loader2, ImagePlus } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { extractExifBatch, calculateDayFromExif, formatExifTime } from '@/services/exifService'
import { compressImage } from '@/services/imageStorage'
import type { TravelLog, ExifMetadata } from '@/types'

interface PhotoEntry {
  file: File
  preview: string
  base64Full: string
  thumbnailBase64: string
  exif: ExifMetadata | null
  day: number
  memo: string
}

interface PhotoLogUploaderProps {
  tripId: number
  tripStartDate: string
  tripEndDate: string
  defaultDay: number
  totalDays: number
  onComplete: (logs: Array<Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'>>) => void
  onClose: () => void
  open: boolean
}

export function PhotoLogUploader({
  tripId, tripStartDate, tripEndDate, defaultDay, totalDays,
  onComplete, onClose, open,
}: PhotoLogUploaderProps) {
  const [entries, setEntries] = useState<PhotoEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      // 1. Extract EXIF from all files (BEFORE compression!)
      const exifResults = await extractExifBatch(files)

      // 2. Compress images and create thumbnails
      const newEntries: PhotoEntry[] = []
      for (const { file, exif } of exifResults) {
        const base64Full = await compressImage(file, { maxWidth: 1920, quality: 0.85 })
        const thumbnailBase64 = await compressImage(file, { maxWidth: 200, quality: 0.6 })

        // Calculate day from EXIF
        let day = defaultDay
        if (exif?.dateTime) {
          const exifDay = calculateDayFromExif(exif.dateTime, tripStartDate, tripEndDate)
          if (exifDay !== null) day = exifDay
        }

        newEntries.push({
          file,
          preview: base64Full,
          base64Full,
          thumbnailBase64,
          exif,
          day,
          memo: '',
        })
      }

      setEntries((prev) => [...prev, ...newEntries])
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 처리에 실패했습니다.')
    } finally {
      setIsProcessing(false)
      // Reset input
      e.target.value = ''
    }
  }, [defaultDay, tripStartDate, tripEndDate])

  const removeEntry = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateEntryMemo = useCallback((index: number, memo: string) => {
    setEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, memo } : entry))
  }, [])

  const updateEntryDay = useCallback((index: number, day: number) => {
    setEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, day } : entry))
  }, [])

  const handleConfirm = useCallback(() => {
    const logs: Array<Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'>> = entries.map((entry) => ({
      tripId,
      day: entry.day,
      timestamp: entry.exif?.dateTime || new Date().toISOString(),
      type: 'photo' as const,
      photo: entry.base64Full,
      thumbnailPhoto: entry.thumbnailBase64,
      exif: entry.exif || undefined,
      latitude: entry.exif?.latitude,
      longitude: entry.exif?.longitude,
      memo: entry.memo || undefined,
    }))
    onComplete(logs)
    handleClose()
  }, [entries, tripId, onComplete])

  const handleClose = useCallback(() => {
    setEntries([])
    setError(null)
    onClose()
  }, [onClose])

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

          {/* Upload area */}
          <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:border-primary-500 transition-colors">
            {isProcessing ? (
              <>
                <Loader2 className="size-8 text-primary-500 animate-spin" />
                <span className="text-sm text-zinc-500">사진 처리 중...</span>
              </>
            ) : (
              <>
                <ImagePlus className="size-8 text-zinc-400" />
                <span className="text-sm text-zinc-500">사진을 선택하세요 (여러 장 가능)</span>
                <span className="text-xs text-zinc-400">EXIF 정보로 시간/위치 자동 추출</span>
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
              {entries.map((entry, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <img
                      src={entry.preview}
                      alt={`사진 ${index + 1}`}
                      className="size-24 object-cover rounded-lg"
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
                      {entry.exif?.latitude && entry.exif?.longitude && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {entry.exif.latitude.toFixed(4)}, {entry.exif.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>

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
              ))}
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
          disabled={entries.length === 0 || isProcessing}
        >
          {entries.length}장 등록
        </Button>
      </DialogActions>
    </Dialog>
  )
}
