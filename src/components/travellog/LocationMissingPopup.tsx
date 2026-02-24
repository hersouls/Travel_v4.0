// ============================================
// Location Missing Popup Component
// Two-step dialog: choice → manual map picker
// Triggered when photos without GPS are uploaded
// ============================================

import { useState, useCallback } from 'react'
import { MapPin, Navigation, ArrowLeft, Loader2 } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { MapLocationPicker } from '@/components/ui/MapLocationPicker'
import { getCurrentPosition, reverseGeocode } from '@/services/geocodingService'

interface LocationMissingPopupProps {
  open: boolean
  onClose: () => void
  noGpsCount: number
  onApplyLocation: (location: {
    latitude: number
    longitude: number
    address: string
    placeName: string
  }) => void
}

export function LocationMissingPopup({
  open,
  onClose,
  noGpsCount,
  onApplyLocation,
}: LocationMissingPopupProps) {
  const [step, setStep] = useState<'choice' | 'manual'>('choice')
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number
    longitude: number
    address: string
    placeName: string
  } | null>(null)

  const handleCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true)
    setError(null)
    try {
      const pos = await getCurrentPosition()
      const addr = await reverseGeocode(pos.lat, pos.lng)
      onApplyLocation({
        latitude: pos.lat,
        longitude: pos.lng,
        address: addr || '',
        placeName: addr || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`,
      })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '현재 위치를 가져올 수 없습니다.')
    } finally {
      setIsGettingLocation(false)
    }
  }, [onApplyLocation])

  const handleManualApply = useCallback(() => {
    if (!selectedLocation) return
    onApplyLocation(selectedLocation)
    handleClose()
  }, [selectedLocation, onApplyLocation])

  const handleClose = useCallback(() => {
    setStep('choice')
    setError(null)
    setSelectedLocation(null)
    setIsGettingLocation(false)
    onClose()
  }, [onClose])

  const handleBack = useCallback(() => {
    setStep('choice')
    setSelectedLocation(null)
  }, [])

  return (
    <Dialog open={open} onClose={handleClose} size={step === 'manual' ? 'lg' : 'md'}>
      {step === 'choice' ? (
        <>
          <DialogTitle onClose={handleClose}>
            <span className="flex items-center gap-2">
              <MapPin className="size-5 text-primary-600 dark:text-primary-400" />
              위치 정보 없음
            </span>
          </DialogTitle>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="font-semibold text-primary-600 dark:text-primary-400">{noGpsCount}장</span>의 사진에 GPS 위치 정보가 없습니다.
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  위치를 등록하면 지도 뷰에서 확인할 수 있습니다.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-600 dark:text-danger-400">
                  {error}
                </div>
              )}

              {/* Option cards */}
              <div className="space-y-2">
                {/* Current location card */}
                <button
                  type="button"
                  onClick={handleCurrentLocation}
                  disabled={isGettingLocation}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex-shrink-0 flex items-center justify-center size-10 rounded-lg bg-primary-50 dark:bg-primary-900/30">
                    {isGettingLocation ? (
                      <Loader2 className="size-5 text-primary-600 dark:text-primary-400 animate-spin" />
                    ) : (
                      <Navigation className="size-5 text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      {isGettingLocation ? '위치 확인 중...' : '현재 위치 등록'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      디바이스의 현재 GPS 위치를 사용합니다
                    </p>
                  </div>
                </button>

                {/* Manual entry card */}
                <button
                  type="button"
                  onClick={() => setStep('manual')}
                  disabled={isGettingLocation}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex-shrink-0 flex items-center justify-center size-10 rounded-lg bg-primary-50 dark:bg-primary-900/30">
                    <MapPin className="size-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">직접 등록</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      지도에서 직접 위치를 선택합니다
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </DialogBody>
          <DialogActions>
            <Button color="secondary" onClick={handleClose}>
              나중에
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="p-1 -ml-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="뒤로"
              >
                <ArrowLeft className="size-5 text-zinc-500" />
              </button>
              위치 직접 등록
            </span>
          </DialogTitle>
          <DialogBody>
            <MapLocationPicker
              onLocationChange={setSelectedLocation}
              height="250px"
              className="sm:[&>div:nth-child(2)]:!h-[350px]"
            />
          </DialogBody>
          <DialogActions>
            <Button color="secondary" onClick={handleBack}>
              뒤로
            </Button>
            <Button
              color="primary"
              onClick={handleManualApply}
              disabled={!selectedLocation}
            >
              등록
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
