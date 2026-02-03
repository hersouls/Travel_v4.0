import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X, Download, FileJson } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { PageContainer } from '@/components/layout'
import { useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import { compressImage } from '@/services/imageStorage'
import { COUNTRIES } from '@/utils/constants'
import { getCountryInfo } from '@/utils/countryInfo'
import { getTimezoneFromCountry } from '@/utils/timezone'
import { Clock, Banknote, FileCheck, Plug } from 'lucide-react'
import {
  exportSingleTrip,
  importSingleTrip,
  validateSingleTripBackup,
  getSingleTripTemplate,
} from '@/services/database'

export function TripForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const loadTrip = useTripStore((state) => state.loadTrip)
  const currentTrip = useTripStore((state) => state.currentTrip)
  const addTrip = useTripStore((state) => state.addTrip)
  const updateTrip = useTripStore((state) => state.updateTrip)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    country: '대한민국',
    timezone: 'Asia/Seoul',
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
        timezone: currentTrip.timezone || getTimezoneFromCountry(currentTrip.country),
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

  // 여행 내보내기 (편집 모드에서만)
  const handleExportTrip = async () => {
    if (!id) return
    setIsExporting(true)
    try {
      const data = await exportSingleTrip(parseInt(id))
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (currentTrip?.title || 'trip').replace(/[^a-zA-Z0-9가-힣]/g, '_')
      a.download = `trip-${safeName}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('여행이 내보내기되었습니다')
    } catch {
      toast.error('내보내기 실패')
    } finally {
      setIsExporting(false)
    }
  }

  // 파일에서 여행 가져오기
  const handleImportTrip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const validation = validateSingleTripBackup(data)
      if (!validation.valid) {
        toast.error(validation.error || '유효하지 않은 파일입니다')
        return
      }

      const newTripId = await importSingleTrip(data)
      toast.success(`여행이 가져오기되었습니다 (${data.plans?.length || 0}개 일정 포함)`)
      navigate(`/trips/${newTripId}`)
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('파일 형식이 올바르지 않습니다 (JSON 파싱 오류)')
      } else {
        toast.error('가져오기 실패')
      }
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  // 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const template = getSingleTripTemplate()
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trip-template.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('템플릿이 다운로드되었습니다')
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <ArrowLeft className="size-5" />
          </IconButton>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {isEditing ? '여행 편집' : '새 여행'}
          </h1>
        </div>

        {/* Backup/Restore Buttons */}
        <div className="flex items-center gap-2">
          {isEditing && (
            <Button
              type="button"
              color="secondary"
              outline
              size="sm"
              leftIcon={<Download className="size-4" />}
              onClick={handleExportTrip}
              isLoading={isExporting}
            >
              내보내기
            </Button>
          )}
          <label>
            <Button
              type="button"
              color="secondary"
              outline
              size="sm"
              leftIcon={<Upload className="size-4" />}
              as="span"
              isLoading={isImporting}
            >
              가져오기
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportTrip}
            />
          </label>
          <Button
            type="button"
            color="secondary"
            plain
            size="sm"
            leftIcon={<FileJson className="size-4" />}
            onClick={handleDownloadTemplate}
          >
            템플릿
          </Button>
        </div>
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
                    className="w-full aspect-video object-cover"
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
                <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
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
          <div className="space-y-3">
            <div>
              <Label htmlFor="country">국가</Label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) => {
                  const country = e.target.value
                  const timezone = getTimezoneFromCountry(country)
                  setFormData((prev) => ({ ...prev, country, timezone }))
                }}
                className="mt-2 w-full h-10 px-3 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
            {/* Country Info Card */}
            {getCountryInfo(formData.country) && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {getCountryInfo(formData.country)!.timezone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Banknote className="size-4 text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {getCountryInfo(formData.country)!.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileCheck className="size-4 text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {getCountryInfo(formData.country)!.visa}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plug className="size-4 text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {getCountryInfo(formData.country)!.plug}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div>
            <Label>여행 기간</Label>
            <div className="mt-2">
              <DateRangePicker
                startDate={formData.startDate}
                endDate={formData.endDate}
                onStartDateChange={(date) => setFormData((prev) => ({ ...prev, startDate: date }))}
                onEndDateChange={(date) => setFormData((prev) => ({ ...prev, endDate: date }))}
              />
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
    </PageContainer>
  )
}
