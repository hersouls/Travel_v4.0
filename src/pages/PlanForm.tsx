import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Upload, X, Clock, MapPin, Globe, Youtube, Camera } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Textarea, Label } from '@/components/ui/Input'
import { useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import { compressImage, processImages } from '@/services/imageStorage'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import type { PlanType } from '@/types'
import * as db from '@/services/database'

const planTypes: PlanType[] = ['attraction', 'restaurant', 'hotel', 'transport', 'car', 'plane', 'airport', 'other']

export function PlanForm() {
  const { tripId, planId } = useParams<{ tripId: string; planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEditing = !!planId
  const defaultDay = parseInt(searchParams.get('day') || '1')

  const currentTrip = useTripStore((state) => state.currentTrip)
  const loadTrip = useTripStore((state) => state.loadTrip)
  const addPlan = useTripStore((state) => state.addPlan)
  const updatePlan = useTripStore((state) => state.updatePlan)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    placeName: '',
    day: defaultDay,
    startTime: '09:00',
    endTime: '',
    type: 'attraction' as PlanType,
    address: '',
    website: '',
    openingHours: '',
    memo: '',
    photos: [] as string[],
    youtubeLink: '',
    mapUrl: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  })

  useEffect(() => {
    if (tripId) {
      loadTrip(parseInt(tripId))
    }
  }, [tripId, loadTrip])

  useEffect(() => {
    const loadPlan = async () => {
      if (isEditing && planId) {
        const plan = await db.getPlan(parseInt(planId))
        if (plan) {
          setFormData({
            placeName: plan.placeName,
            day: plan.day,
            startTime: plan.startTime,
            endTime: plan.endTime || '',
            type: plan.type,
            address: plan.address || '',
            website: plan.website || '',
            openingHours: plan.openingHours || '',
            memo: plan.memo || '',
            photos: plan.photos || [],
            youtubeLink: plan.youtubeLink || '',
            mapUrl: plan.mapUrl || '',
            latitude: plan.latitude,
            longitude: plan.longitude,
          })
        }
      }
    }
    loadPlan()
  }, [isEditing, planId])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      try {
        const newPhotos = await processImages(files)
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, ...newPhotos].slice(0, 10), // Max 10 photos
        }))
      } catch {
        toast.error('이미지 업로드 실패')
      }
    }
  }

  const removePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.placeName.trim()) {
      toast.error('장소 이름을 입력해주세요')
      return
    }

    if (!tripId) return

    setIsSubmitting(true)
    try {
      const planData = {
        tripId: parseInt(tripId),
        ...formData,
      }

      if (isEditing && planId) {
        await updatePlan(parseInt(planId), planData)
        toast.success('일정이 수정되었습니다')
      } else {
        await addPlan(planData)
        toast.success('일정이 추가되었습니다')
      }
      navigate(`/trips/${tripId}`)
    } catch {
      toast.error(isEditing ? '일정 수정 실패' : '일정 추가 실패')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <ArrowLeft className="size-5" />
        </IconButton>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {isEditing ? '일정 편집' : '새 일정'}
          </h1>
          {currentTrip && (
            <p className="text-sm text-zinc-500">{currentTrip.title}</p>
          )}
        </div>
      </div>

      {/* Form */}
      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Place Name */}
          <Input
            label="장소 이름"
            value={formData.placeName}
            onChange={(value) => setFormData((prev) => ({ ...prev, placeName: value }))}
            placeholder="예: 도쿄 스카이트리"
            leftIcon={<MapPin className="size-4" />}
            required
          />

          {/* Day & Time */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="day">일차</Label>
              <select
                id="day"
                value={formData.day}
                onChange={(e) => setFormData((prev) => ({ ...prev, day: parseInt(e.target.value) }))}
                className="mt-2 w-full h-10 px-3 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Array.from({ length: 30 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="startTime">시작 시간</Label>
              <div className="relative mt-2">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type="time"
                  id="startTime"
                  value={formData.startTime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="endTime">종료 시간</Label>
              <div className="relative mt-2">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type="time"
                  id="endTime"
                  value={formData.endTime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Type */}
          <div>
            <Label>유형</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {planTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, type }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.type === type
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {PLAN_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <Input
            label="주소"
            value={formData.address}
            onChange={(value) => setFormData((prev) => ({ ...prev, address: value }))}
            placeholder="주소 입력"
            leftIcon={<MapPin className="size-4" />}
          />

          {/* Website */}
          <Input
            label="웹사이트"
            value={formData.website}
            onChange={(value) => setFormData((prev) => ({ ...prev, website: value }))}
            placeholder="https://"
            leftIcon={<Globe className="size-4" />}
          />

          {/* YouTube Link */}
          <Input
            label="YouTube 링크"
            value={formData.youtubeLink}
            onChange={(value) => setFormData((prev) => ({ ...prev, youtubeLink: value }))}
            placeholder="https://youtube.com/watch?v=..."
            leftIcon={<Youtube className="size-4" />}
          />

          {/* Map URL */}
          <Input
            label="지도 URL"
            value={formData.mapUrl}
            onChange={(value) => setFormData((prev) => ({ ...prev, mapUrl: value }))}
            placeholder="Google Maps, Naver Maps 등"
            leftIcon={<MapPin className="size-4" />}
            hint="지도 URL에서 위치 좌표를 자동 추출합니다"
          />

          {/* Memo */}
          <Textarea
            label="메모"
            value={formData.memo}
            onChange={(value) => setFormData((prev) => ({ ...prev, memo: value }))}
            placeholder="추가 메모..."
            rows={3}
          />

          {/* Photos */}
          <div>
            <Label>사진</Label>
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {formData.photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  <IconButton
                    type="button"
                    color="danger"
                    size="xs"
                    className="absolute top-1 right-1"
                    onClick={() => removePhoto(index)}
                    aria-label="사진 삭제"
                  >
                    <X className="size-3" />
                  </IconButton>
                </div>
              ))}
              {formData.photos.length < 10 && (
                <label className="aspect-square flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                  <Camera className="size-6 text-zinc-400" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-400">최대 10장</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" color="secondary" onClick={() => navigate(-1)}>
              취소
            </Button>
            <Button type="submit" color="primary" isLoading={isSubmitting}>
              {isEditing ? '저장' : '추가'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
