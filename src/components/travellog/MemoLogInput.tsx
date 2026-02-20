// ============================================
// Memo Log Input Component
// Day + time + text memo + optional photo
// ============================================

import { useState, useCallback, useMemo } from 'react'
import { FileText, Camera, X, AlertTriangle } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { compressImage } from '@/services/imageStorage'
import { getTripDayDate } from '@/utils/timezone'
import { toast } from '@/stores/uiStore'
import type { TravelLog } from '@/types'

interface MemoLogInputProps {
  tripId: number
  tripStartDate: string
  defaultDay: number
  totalDays: number
  onComplete: (log: Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  open: boolean
}

export function MemoLogInput({
  tripId, tripStartDate, defaultDay, totalDays, onComplete, onClose, open,
}: MemoLogInputProps) {
  const [day, setDay] = useState(defaultDay)
  const [time, setTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [memo, setMemo] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [thumbnailBase64, setThumbnailBase64] = useState<string | null>(null)

  // Time/day sync warning
  const timeWarning = useMemo(() => {
    try {
      const dayDate = getTripDayDate(tripStartDate, day)
      if (!dayDate) return null
      const [hours, minutes] = time.split(':').map(Number)
      const selectedTime = new Date(dayDate)
      selectedTime.setHours(hours, minutes, 0, 0)
      const now = new Date()
      if (selectedTime.getTime() > now.getTime() + 60 * 60 * 1000) {
        return '선택한 시간이 현재보다 미래입니다. 확인해주세요.'
      }
    } catch {
      // ignore
    }
    return null
  }, [tripStartDate, day, time])

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const full = await compressImage(file, { maxWidth: 1920, quality: 0.85 })
      const thumb = await compressImage(file, { maxWidth: 200, quality: 0.6 })
      setPhotoPreview(full)
      setThumbnailBase64(thumb)
    } catch {
      // Silent fail for optional photo
    }
  }, [])

  const removePhoto = useCallback(() => {
    setPhotoPreview(null)
    setThumbnailBase64(null)
  }, [])

  const buildLog = useCallback((): Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'> | null => {
    if (!memo.trim()) return null

    const timestamp = new Date()
    const [hours, minutes] = time.split(':').map(Number)
    timestamp.setHours(hours, minutes, 0, 0)

    return {
      tripId,
      day,
      timestamp: timestamp.toISOString(),
      type: 'memo',
      memo: memo.trim(),
      placeName: placeName.trim() || undefined,
      photo: photoPreview || undefined,
      thumbnailPhoto: thumbnailBase64 || undefined,
    }
  }, [tripId, day, time, memo, placeName, photoPreview, thumbnailBase64])

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
    setMemo('')
    setPlaceName('')
    setPhotoPreview(null)
    setThumbnailBase64(null)
    toast.success('메모가 등록되었습니다')
  }, [buildLog, onComplete])

  const handleClose = useCallback(() => {
    setMemo('')
    setPlaceName('')
    setPhotoPreview(null)
    setThumbnailBase64(null)
    onClose()
  }, [onClose])

  return (
    <Dialog open={open} onClose={handleClose} size="md">
      <DialogTitle onClose={handleClose}>
        <span className="flex items-center gap-2">
          <FileText className="size-5 text-success-600 dark:text-success-400" />
          메모 기록
        </span>
      </DialogTitle>
      <DialogBody>
        <div className="space-y-4">
          {/* Time warning */}
          {timeWarning && (
            <div className="flex items-start gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg text-sm text-warning-700 dark:text-warning-400">
              <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
              {timeWarning}
            </div>
          )}

          {/* Day & Time */}
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
              label="시간"
              type="time"
              value={time}
              onChange={setTime}
            />
          </div>

          {/* Place name (optional) */}
          <Input
            label="장소명 (선택)"
            value={placeName}
            onChange={setPlaceName}
            placeholder="예: 도쿄타워, 하카타 라멘집"
          />

          {/* Memo */}
          <Textarea
            label="메모"
            value={memo}
            onChange={setMemo}
            rows={4}
            placeholder="여행 기록을 남겨보세요..."
            resizable
          />

          {/* Optional photo */}
          {!photoPreview ? (
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] cursor-pointer hover:bg-[var(--muted)] transition-colors">
              <Camera className="size-4" />
              사진 첨부 (선택)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </label>
          ) : (
            <div className="relative inline-block">
              <img
                src={photoPreview}
                alt="첨부 사진"
                className="h-24 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute -top-2 -right-2 size-5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center"
                aria-label="사진 삭제"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={handleClose}>
          취소
        </Button>
        {memo.trim() && (
          <Button color="secondary" onClick={handleConfirmAndContinue}>
            등록 후 계속
          </Button>
        )}
        <Button
          color="primary"
          onClick={handleConfirm}
          disabled={!memo.trim()}
        >
          등록
        </Button>
      </DialogActions>
    </Dialog>
  )
}
