import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Textarea, Label } from '@/components/ui/Input'
import { useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import { compressImage } from '@/services/imageStorage'
import { COUNTRIES } from '@/utils/constants'

export function TripForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const loadTrip = useTripStore((state) => state.loadTrip)
  const currentTrip = useTripStore((state) => state.currentTrip)
  const addTrip = useTripStore((state) => state.addTrip)
  const updateTrip = useTripStore((state) => state.updateTrip)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    country: '대한민국',
    startDate: '',
    endDate: '',
    coverImage: '',
  })

  useEffect(() => {
    if (isEditing && id) {
      loadTrip(parseInt(id))
    }
  }, [id, isEditing, loadTrip])

  useEffect(() => {
    if (isEditing && currentTrip) {
      setFormData({
        title: currentTrip.title,
        country: currentTrip.country,
        startDate: currentTrip.startDate,
        endDate: currentTrip.endDate,
        coverImage: currentTrip.coverImage || '',
      })
    }
  }, [isEditing, currentTrip])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const compressed = await compressImage(file)
        setFormData((prev) => ({ ...prev, coverImage: compressed }))
      } catch {
        toast.error('이미지 업로드 실패')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('여행 이름을 입력해주세요')
      return
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error('날짜를 선택해주세요')
      return
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error('종료 날짜는 시작 날짜 이후여야 합니다')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing && id) {
        await updateTrip(parseInt(id), formData)
        toast.success('여행이 수정되었습니다')
        navigate(`/trips/${id}`)
      } else {
        const newId = await addTrip(formData)
        toast.success('여행이 생성되었습니다')
        navigate(`/trips/${newId}`)
      }
    } catch {
      toast.error(isEditing ? '여행 수정 실패' : '여행 생성 실패')
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
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {isEditing ? '여행 편집' : '새 여행'}
        </h1>
      </div>

      {/* Form */}
      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cover Image */}
          <div>
            <Label>커버 이미지</Label>
            <div className="mt-2">
              {formData.coverImage ? (
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={formData.coverImage}
                    alt="커버"
                    className="w-full h-48 object-cover"
                  />
                  <IconButton
                    type="button"
                    color="danger"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setFormData((prev) => ({ ...prev, coverImage: '' }))}
                    aria-label="이미지 삭제"
                  >
                    <X className="size-4" />
                  </IconButton>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                  <Upload className="size-8 text-zinc-400 mb-2" />
                  <span className="text-sm text-zinc-500">클릭하여 이미지 업로드</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <Input
            label="여행 이름"
            value={formData.title}
            onChange={(value) => setFormData((prev) => ({ ...prev, title: value }))}
            placeholder="예: 도쿄 여행"
            required
          />

          {/* Country */}
          <div>
            <Label htmlFor="country">국가</Label>
            <select
              id="country"
              value={formData.country}
              onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
              className="mt-2 w-full h-10 px-3 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">시작 날짜</Label>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type="date"
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="endDate">종료 날짜</Label>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type="date"
                  id="endDate"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" color="secondary" onClick={() => navigate(-1)}>
              취소
            </Button>
            <Button type="submit" color="primary" isLoading={isSubmitting}>
              {isEditing ? '저장' : '생성'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
