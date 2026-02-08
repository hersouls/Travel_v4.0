import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, Clock, MapPin, Globe, Youtube, Camera, Loader2, Sparkles, ExternalLink, Volume2, Eye, EyeOff, ChevronDown, ChevronUp, BookmarkPlus, Download, Upload, FileJson } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { MemoRenderer } from '@/components/memo'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Textarea, Label } from '@/components/ui/Input'
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete'
import { TimePicker } from '@/components/ui/TimePicker'
import { PageContainer } from '@/components/layout'
import { AIMemoGenerator, AIGuideGenerator, AIPhotoAnalyzer } from '@/components/ai'
import { useTripStore } from '@/stores/tripStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePlaceStore, usePlaces } from '@/stores/placeStore'
import { toast } from '@/stores/uiStore'
import { processImages } from '@/services/imageStorage'
import { extractPlaceInfo, isGoogleMapsUrl } from '@/services/googleMaps'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import { detectPlanType } from '@/utils/place'
import type { PlanType, GooglePlaceInfo } from '@/types'
import type { PlaceDetails, PlacePrediction } from '@/services/placesAutocomplete'
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

  // Place Library auto-register
  const placeAddPlace = usePlaceStore((state) => state.addPlace)
  const findPlaceByNameOrGoogleId = usePlaceStore((state) => state.findPlaceByNameOrGoogleId)
  const incrementPlaceUsage = usePlaceStore((state) => state.incrementUsage)
  const localPlaces = usePlaces() // Get all saved places

  const claudeEnabled = useSettingsStore((state) => state.claudeEnabled)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [isAIMemoOpen, setIsAIMemoOpen] = useState(false)
  const [isAIGuideOpen, setIsAIGuideOpen] = useState(false)
  const [isAIPhotoOpen, setIsAIPhotoOpen] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showManualCoords, setShowManualCoords] = useState(false)
  const [typeManuallyChanged, setTypeManuallyChanged] = useState(false)
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
    googlePlaceId: undefined as string | undefined,
    googleInfo: undefined as GooglePlaceInfo | undefined,
    audioScript: '',
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
            googlePlaceId: plan.googlePlaceId,
            googleInfo: plan.googleInfo,
            audioScript: plan.audioScript || '',
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

  const handleExtractInfo = async () => {
    if (!formData.mapUrl) {
      toast.error('지도 URL을 입력해주세요')
      return
    }

    if (!isGoogleMapsUrl(formData.mapUrl)) {
      toast.error('Google Maps URL만 지원합니다')
      return
    }

    setIsExtracting(true)
    try {
      const extracted = await extractPlaceInfo(formData.mapUrl)

      setFormData((prev) => ({
        ...prev,
        placeName: extracted.placeName || prev.placeName,
        address: extracted.address || prev.address,
        website: extracted.website || prev.website,
        latitude: extracted.latitude || prev.latitude,
        longitude: extracted.longitude || prev.longitude,
        googlePlaceId: extracted.googleInfo.placeId,
        googleInfo: extracted.googleInfo,
        // Auto-fill opening hours to memo if available
        memo: extracted.googleInfo.openingHours
          ? (prev.memo ? prev.memo + '\n\n' : '') + '[영업 시간]\n' + extracted.googleInfo.openingHours.join('\n')
          : prev.memo
      }))
      toast.success('장소 정보를 추출했습니다')
    } catch (error) {
      console.error('Extraction error:', error)
      toast.error(error instanceof Error ? error.message : '정보 추출에 실패했습니다')
    } finally {
      setIsExtracting(false)
    }
  }

  const [geminiInput, setGeminiInput] = useState('')
  const [showMemoPreview, setShowMemoPreview] = useState(false)

  const handleCopyJSON = () => {
    const json = JSON.stringify(formData, null, 2)
    navigator.clipboard.writeText(json)
    toast.success('JSON데이터가 복사되었습니다')
  }

  const handleSmartPaste = () => {
    if (!geminiInput.trim()) return

    const lines = geminiInput.split('\n')
    const updates: Partial<typeof formData> = {}
    const openingHoursList: string[] = []
    const descriptionLines: string[] = []
    const structuredFields = ['공식명칭:', '주소:', '웹사이트:', '연락처:', '운영시간:', '평점:', '카테고리:', '위치:']

    let currentSection = ''

    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) {
        // 빈 줄은 섹션 구분으로 사용
        if (currentSection === 'description') {
          descriptionLines.push('')
        }
        return
      }

      // 구조화된 필드 파싱
      if (trimmed.startsWith('공식명칭:')) {
        updates.placeName = trimmed.replace('공식명칭:', '').trim()
        currentSection = 'structured'
      } else if (trimmed.startsWith('주소:') || trimmed.startsWith('위치:')) {
        updates.address = trimmed.replace(/^(주소|위치):/, '').trim()
        currentSection = 'structured'
      } else if (trimmed.startsWith('웹사이트:')) {
        const website = trimmed.replace('웹사이트:', '').trim()
        updates.website = website.startsWith('http') ? website : `https://${website}`
        currentSection = 'structured'
      } else if (trimmed.startsWith('연락처:')) {
        const phone = trimmed.replace('연락처:', '').trim().split(' ')[0]
        if (!updates.googleInfo) {
          updates.googleInfo = { extractedAt: new Date() }
        }
        updates.googleInfo.phone = phone
        currentSection = 'structured'
      } else if (trimmed.startsWith('운영시간:')) {
        openingHoursList.push(trimmed.replace('운영시간:', '').trim())
        currentSection = 'structured'
      } else if (trimmed.startsWith('평점:')) {
        const ratingMatch = trimmed.match(/(\d+\.?\d*)\//)
        if (ratingMatch) {
          if (!updates.googleInfo) {
            updates.googleInfo = { extractedAt: new Date() }
          }
          updates.googleInfo.rating = Number.parseFloat(ratingMatch[1])
          const reviewMatch = trimmed.match(/(\d{1,3}(,\d{3})*|\d+)개/)
          if (reviewMatch) {
            updates.googleInfo.reviewCount = Number.parseInt(reviewMatch[1].replace(/,/g, ''))
          }
        }
        currentSection = 'structured'
      } else if (trimmed.startsWith('카테고리:')) {
        if (!updates.googleInfo) {
          updates.googleInfo = { extractedAt: new Date() }
        }
        updates.googleInfo.category = trimmed.replace('카테고리:', '').trim()
        currentSection = 'structured'
      } else {
        // 구조화되지 않은 텍스트는 설명으로 분류
        const isStructuredField = structuredFields.some(field => trimmed.startsWith(field))
        if (!isStructuredField) {
          currentSection = 'description'
          descriptionLines.push(trimmed)
        }
      }
    })

    // Set opening hours if found
    if (openingHoursList.length > 0) {
      if (!updates.googleInfo) {
        updates.googleInfo = { extractedAt: new Date() }
      }
      updates.googleInfo.openingHours = openingHoursList
    }

    // 설명 부분만 memo에 저장 (구조화된 정보는 제외)
    const description = descriptionLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // 3개 이상 연속 줄바꿈을 2개로
      .trim()

    if (description) {
      updates.memo = description
    }

    setFormData(prev => ({
      ...prev,
      ...updates,
      googleInfo: {
        ...prev.googleInfo,
        ...updates.googleInfo,
        extractedAt: new Date()
      }
    }))

    toast.success('Gemini 정보가 적용되었습니다')
    setGeminiInput('')
  }

  const autoRegisterToPlaceLibrary = async () => {
    if (!formData.placeName.trim()) return

    const existing = findPlaceByNameOrGoogleId(formData.placeName, formData.googlePlaceId)

    if (existing && existing.id) {
      await incrementPlaceUsage(existing.id)
      toast.info(`"${formData.placeName}" 사용 횟수가 증가했습니다`)
    } else {
      await placeAddPlace({
        name: formData.placeName,
        type: formData.type,
        address: formData.address,
        memo: formData.memo, // Save actual memo
        audioScript: formData.audioScript, // Save audio script
        photos: formData.photos, // Save photos
        rating: formData.googleInfo?.rating,
        mapUrl: formData.mapUrl,
        website: formData.website,
        googlePlaceId: formData.googlePlaceId,
        latitude: formData.latitude,
        longitude: formData.longitude,
      })
      toast.success(`"${formData.placeName}"이(가) 장소 라이브러리에 등록되었습니다`)
    }
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

      // Auto-register to place library
      if (saveToLibrary) {
        await autoRegisterToPlaceLibrary()
      }

      navigate(`/trips/${tripId}`)
    } catch {
      toast.error(isEditing ? '일정 수정 실패' : '일정 추가 실패')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 일정 내보내기 (편집 모드에서만)
  const handleExportPlan = async () => {
    if (!planId) return
    setIsExporting(true)
    try {
      const data = await db.exportSinglePlan(parseInt(planId))
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (formData.placeName || 'plan').replace(/[^a-zA-Z0-9가-힣]/g, '_')
      a.download = `plan-${safeName}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('일정이 내보내기되었습니다')
    } catch {
      toast.error('내보내기 실패')
    } finally {
      setIsExporting(false)
    }
  }

  // 파일에서 일정 가져오기
  const handleImportPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tripId) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const validation = db.validateSinglePlanBackup(data)
      if (!validation.valid) {
        toast.error(validation.error || '유효하지 않은 파일입니다')
        return
      }

      const newPlanId = await db.importSinglePlan(data, parseInt(tripId), formData.day)
      toast.success('일정이 가져오기되었습니다')
      navigate(`/trips/${tripId}/plans/${newPlanId}`)
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
  const handleDownloadPlanTemplate = () => {
    const template = db.getSinglePlanTemplate()
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plan-template.json'
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
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                {isEditing ? '일정 편집' : '새 일정'}
              </h1>
              {currentTrip && (
                <p className="text-sm text-zinc-500">{currentTrip.title}</p>
              )}
            </div>
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
                onClick={handleExportPlan}
                isLoading={isExporting}
              >
                <span className="hidden sm:inline">내보내기</span>
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
                <span className="hidden sm:inline">가져오기</span>
              </Button>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportPlan}
              />
            </label>
            <Button
              type="button"
              color="secondary"
              plain
              size="sm"
              leftIcon={<FileJson className="size-4" />}
              onClick={handleDownloadPlanTemplate}
            >
              <span className="hidden sm:inline">템플릿</span>
            </Button>
          </div>
        </div>

        {/* Form */}
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Map URL */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    label="지도 URL"
                    value={formData.mapUrl}
                    onChange={(value) => setFormData((prev) => ({ ...prev, mapUrl: value }))}
                    placeholder="Google Maps URL (maps.app.goo.gl/...)"
                    leftIcon={<MapPin className="size-4" />}
                  />
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <Button
                    type="button"
                    color="primary"
                    size="sm"
                    onClick={handleExtractInfo}
                    disabled={!formData.mapUrl || isExtracting}
                    leftIcon={
                      isExtracting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )
                    }
                  >
                    {isExtracting ? '추출 중...' : '정보 추출'}
                  </Button>
                  <Button
                    type="button"
                    color="secondary"
                    outline
                    size="sm"
                    onClick={handleCopyJSON}
                    disabled={!formData.mapUrl}
                    className="ml-2"
                    leftIcon={<Sparkles className="size-4" />}
                  >
                    JSON 복사
                  </Button>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Google Maps URL을 입력하고 "정보 추출"을 클릭하면 장소 정보를 자동으로 가져옵니다
              </p>
              {formData.googleInfo?.rating && (
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="text-amber-500">★</span>
                  <span>{formData.googleInfo.rating.toFixed(1)}</span>
                  {formData.googleInfo.reviewCount && (
                    <span className="text-zinc-400">
                      ({formData.googleInfo.reviewCount.toLocaleString()}개 리뷰)
                    </span>
                  )}
                  {formData.googleInfo.category && (
                    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                      {formData.googleInfo.category}
                    </span>
                  )}
                </div>
              )}
              {/* 추출된 좌표 표시 */}
              {(formData.latitude && formData.longitude) && (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      📍 추출된 좌표
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      위도: {formData.latitude.toFixed(6)}
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      경도: {formData.longitude.toFixed(6)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    outline
                    color="primary"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${formData.latitude}, ${formData.longitude}`
                      )
                      toast.success('좌표가 복사되었습니다')
                    }}
                  >
                    복사
                  </Button>
                </div>
              )}
              {/* 수동 좌표 입력 토글 */}
              <button
                type="button"
                onClick={() => setShowManualCoords(!showManualCoords)}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                {showManualCoords ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                좌표 직접 입력
              </button>
              {showManualCoords && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="위도 (Latitude)"
                      type="number"
                      step="any"
                      value={formData.latitude?.toString() || ''}
                      onChange={(value) => setFormData((prev) => ({
                        ...prev,
                        latitude: value ? parseFloat(value) : undefined
                      }))}
                      placeholder="예: 37.5665"
                    />
                    <Input
                      label="경도 (Longitude)"
                      type="number"
                      step="any"
                      value={formData.longitude?.toString() || ''}
                      onChange={(value) => setFormData((prev) => ({
                        ...prev,
                        longitude: value ? parseFloat(value) : undefined
                      }))}
                      placeholder="예: 126.9780"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    💡 Google Maps에서 장소 우클릭 → 좌표 복사 후 붙여넣기
                  </p>
                </div>
              )}
            </div>

            {/* Gemini Gem Integration */}
            <div className="space-y-2 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <Label className="text-purple-700 dark:text-purple-300">Gemini 장소 가이드</Label>
                <a
                  href="https://gemini.google.com/gem/1sJ4ixxslCiVSVAeeH2mvkGwpxWG0b06g?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  <Sparkles className="size-4" />
                  Gemini Gem 열기
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <Textarea
                value={geminiInput}
                onChange={setGeminiInput}
                placeholder="Gemini에서 생성된 장소 가이드를 여기에 붙여넣으세요..."
                rows={4}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                  공식명칭, 주소, 웹사이트가 자동으로 추출됩니다
                </p>
                <Button
                  type="button"
                  color="secondary"
                  size="sm"
                  onClick={handleSmartPaste}
                  disabled={!geminiInput.trim()}
                  leftIcon={<Sparkles className="size-4" />}
                >
                  정보 적용
                </Button>
              </div>
            </div>

            {/* Place Name */}
            <Input
              label="장소 이름"
              value={formData.placeName}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, placeName: value }))
                // 자동 타입 추천 (수동 변경 안 했을 때만)
                if (!typeManuallyChanged && value.length >= 2) {
                  const detectedType = detectPlanType(value)
                  if (detectedType && detectedType !== formData.type) {
                    setFormData((prev) => ({ ...prev, type: detectedType }))
                    toast.success(`"${PLAN_TYPE_LABELS[detectedType]}"(으)로 분류했습니다`)
                  }
                }
              }}
              placeholder="예: 도쿄 스카이트리"
              leftIcon={<MapPin className="size-4" />}
              required
            />

            {/* Day & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <TimePicker
                label="시작 시간"
                value={formData.startTime}
                onChange={(value) => setFormData((prev) => ({ ...prev, startTime: value }))}
                required
              />
              <TimePicker
                label="종료 시간"
                value={formData.endTime}
                onChange={(value) => setFormData((prev) => ({ ...prev, endTime: value }))}
                minTime={formData.startTime}
                align="end"
              />
            </div>

            {/* Type */}
            <div>
              <Label>유형</Label>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {planTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, type }))
                      setTypeManuallyChanged(true)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${formData.type === type
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      } min-w-[4.5rem] flex justify-center whitespace-nowrap`}
                  >
                    {PLAN_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Address with Places Autocomplete */}
            <PlacesAutocomplete
              label="장소 검색"
              placeholder="장소 이름 또는 주소 검색..."
              value={formData.address}
              onChange={(value) => setFormData((prev) => ({ ...prev, address: value }))}
              localPlaces={localPlaces}
              onPlaceSelect={(details: PlaceDetails, prediction: PlacePrediction) => {
                // Auto-fill form fields from place details
                const detectedType = detectPlanType(details.name) || detectPlanType(details.category || '')

                setFormData((prev) => ({
                  ...prev,
                  placeName: prev.placeName || details.name,
                  address: details.address,
                  latitude: details.latitude,
                  longitude: details.longitude,
                  website: details.website || prev.website,
                  googlePlaceId: prediction.placeId,
                  googleInfo: {
                    ...prev.googleInfo,
                    placeId: prediction.placeId,
                    rating: details.rating,
                    reviewCount: details.reviewCount,
                    category: details.category,
                    phone: details.phone,
                    openingHours: details.openingHours,
                    extractedAt: new Date(),
                  },
                  type: (!typeManuallyChanged && detectedType) ? detectedType : prev.type,
                }))

                if (!typeManuallyChanged && detectedType) {
                  toast.success(`"${PLAN_TYPE_LABELS[detectedType]}"(으)로 분류했습니다`)
                }
                toast.success('장소 정보가 입력되었습니다')
              }}
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



            {/* Memo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>메모</Label>
                  {claudeEnabled && formData.placeName && (
                    <Button
                      type="button"
                      size="xs"
                      outline
                      color="primary"
                      leftIcon={<Sparkles className="size-3" />}
                      onClick={() => setIsAIMemoOpen(true)}
                    >
                      AI 메모
                    </Button>
                  )}
                </div>
                {formData.memo && (
                  <button
                    type="button"
                    onClick={() => setShowMemoPreview(!showMemoPreview)}
                    className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showMemoPreview ? (
                      <>
                        <EyeOff className="size-4" />
                        편집
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" />
                        미리보기
                      </>
                    )}
                  </button>
                )}
              </div>
              {showMemoPreview && formData.memo ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 min-h-[120px]">
                  <MemoRenderer content={formData.memo} />
                </div>
              ) : (
                <Textarea
                  value={formData.memo}
                  onChange={(value) => setFormData((prev) => ({ ...prev, memo: value }))}
                  placeholder="추가 메모..."
                  rows={5}
                />
              )}
            </div>

            {/* Moonyou Guide Audio Script */}
            <div className="space-y-2 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-emerald-700 dark:text-emerald-300">Moonyou Guide 음성 스크립트</Label>
                </div>
                <div className="flex items-center gap-2">
                  {claudeEnabled && formData.placeName && (
                    <Button
                      type="button"
                      size="xs"
                      outline
                      color="primary"
                      leftIcon={<Sparkles className="size-3" />}
                      onClick={() => setIsAIGuideOpen(true)}
                    >
                      AI 생성
                    </Button>
                  )}
                  <a
                    href="https://gemini.google.com/gem/1pSqw6tcLNq--HKClJEGOBlK-qRiBsGqr?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    <Sparkles className="size-4" />
                    Gem
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
              <Textarea
                value={formData.audioScript}
                onChange={(value) => setFormData((prev) => ({ ...prev, audioScript: value }))}
                placeholder="Moonyou Guide 대본을 입력하세요... (Gem에서 생성한 스크립트를 붙여넣기)"
                rows={6}
              />
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                Moonyou Guide Gem에서 생성한 스크립트를 붙여넣으면 상세화면에서 음성으로 들을 수 있습니다
              </p>
            </div>

            {/* Photos */}
            <div>
              <div className="flex items-center gap-2">
                <Label>사진</Label>
                {claudeEnabled && (
                  <Button
                    type="button"
                    size="xs"
                    outline
                    color="primary"
                    leftIcon={<Camera className="size-3" />}
                    onClick={() => setIsAIPhotoOpen(true)}
                  >
                    AI 분석
                  </Button>
                )}
              </div>
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

            {/* Place Library Auto-Register */}
            <div className="flex items-center justify-between py-3 px-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                />
                <div className="flex items-center gap-2">
                  <BookmarkPlus className="size-4 text-zinc-500" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    장소 라이브러리에 자동 등록
                  </span>
                </div>
              </label>
              <span className="text-xs text-zinc-400">
                {saveToLibrary ? '저장 시 라이브러리에 추가됩니다' : '라이브러리에 추가하지 않습니다'}
              </span>
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
      {/* AI Dialogs */}
      {claudeEnabled && (
        <>
          <AIMemoGenerator
            open={isAIMemoOpen}
            onClose={() => setIsAIMemoOpen(false)}
            plan={{
              ...formData,
              id: planId ? parseInt(planId) : undefined,
              tripId: parseInt(tripId || '0'),
              createdAt: new Date(),
              updatedAt: new Date(),
            }}
            country={currentTrip?.country}
            mode={formData.memo ? 'append' : 'replace'}
            onApply={(memo) => setFormData((prev) => ({ ...prev, memo }))}
          />
          {currentTrip && (
            <AIGuideGenerator
              open={isAIGuideOpen}
              onClose={() => setIsAIGuideOpen(false)}
              plan={{
                ...formData,
                id: planId ? parseInt(planId) : undefined,
                tripId: parseInt(tripId || '0'),
                createdAt: new Date(),
                updatedAt: new Date(),
              }}
              trip={currentTrip}
              onApply={(script) => setFormData((prev) => ({ ...prev, audioScript: script }))}
            />
          )}
          <AIPhotoAnalyzer
            open={isAIPhotoOpen}
            onClose={() => setIsAIPhotoOpen(false)}
            onApply={(result) => {
              setFormData((prev) => ({
                ...prev,
                placeName: result.placeName || prev.placeName,
                type: (['attraction', 'restaurant', 'hotel', 'transport', 'other'].includes(result.type)
                  ? result.type as import('@/types').PlanType
                  : prev.type),
                memo: result.description
                  ? (prev.memo ? prev.memo + '\n\n' : '') + result.description +
                    (result.tips?.length ? '\n\n💡 팁\n' + result.tips.map(t => `- ${t}`).join('\n') : '')
                  : prev.memo,
              }))
              setIsAIPhotoOpen(false)
              toast.success('AI 분석 결과가 적용되었습니다')
            }}
          />
        </>
      )}
      </div>
    </PageContainer>
  )
}
