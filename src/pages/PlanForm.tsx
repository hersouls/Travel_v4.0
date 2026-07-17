// ============================================
// PlanForm — 위저드 컨테이너 (상태/핸들러/네비 소유)
// 단계별 UI 는 PlanWizard 및 steps/* 가 담당
// ============================================

import { AIGuideGenerator, AIMemoGenerator, AIPhotoAnalyzer } from '@/components/ai'
import { PageContainer } from '@/components/layout'
import { PlanWizard } from '@/components/plan-wizard/PlanWizard'
import type { PlanFormData, PlanWizardContext, WizardStepId } from '@/components/plan-wizard/types'
import { WIZARD_STEP_ORDER } from '@/components/plan-wizard/types'
import { useWizard } from '@/components/plan-wizard/useWizard'
import { Button } from '@/components/ui/Button'
import { useFormDraft } from '@/hooks/useFormDraft'
import { useFormValidation } from '@/hooks/useFormValidation'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { planSchema } from '@/lib/validations'
import * as db from '@/services/database'
import { extractPlaceInfo, isGoogleMapsUrl } from '@/services/googleMaps'
import { processImages } from '@/services/imageStorage'
import type { PlaceDetails, PlacePrediction } from '@/services/placesAutocomplete'
import { usePlaceStore, usePlaces } from '@/stores/placeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import type { GooglePlaceInfo, PlanType } from '@/types'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import { detectPlanType } from '@/utils/place'
import { checkPlanConflict } from '@/utils/timeConflict'
import { getTripDurationSafe } from '@/utils/timezone'
import { ClipboardCopy, Download, FileJson, Loader2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

/** 유효성 오류 필드 → 위저드 단계 매핑 */
const FIELD_STEP: Record<string, WizardStepId> = {
  placeName: 'place',
  type: 'location',
  startTime: 'schedule',
  endTime: 'schedule',
}

/** googleInfo.openingHours(배열)만 정본으로 두되, 표시용 openingHours 문자열이 비었을 때만 시드 */
function seedOpeningHours(current: string, hours?: string[]): string {
  if (current.trim()) return current
  return hours?.length ? hours.join('\n') : current
}

export function PlanForm() {
  const { tripId, planId } = useParams<{ tripId: string; planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEditing = !!planId
  const planIdNum = planId ? Number.parseInt(planId) : undefined
  const defaultDay = Number.parseInt(searchParams.get('day') || '1')

  const currentTrip = useTripStore((state) => state.currentTrip)
  const loadTrip = useTripStore((state) => state.loadTrip)
  const addPlan = useTripStore((state) => state.addPlan)
  const updatePlan = useTripStore((state) => state.updatePlan)

  const placeAddPlace = usePlaceStore((state) => state.addPlace)
  const findPlaceByNameOrGoogleId = usePlaceStore((state) => state.findPlaceByNameOrGoogleId)
  const incrementPlaceUsage = usePlaceStore((state) => state.incrementUsage)
  const localPlaces = usePlaces()

  const claudeEnabled = useSettingsStore((state) => state.claudeEnabled)
  const { errors, validate, clearFieldError } = useFormValidation(planSchema)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [isAIMemoOpen, setIsAIMemoOpen] = useState(false)
  const [isAIGuideOpen, setIsAIGuideOpen] = useState(false)
  const [isAIPhotoOpen, setIsAIPhotoOpen] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [typeManuallyChanged, setTypeManuallyChanged] = useState(false)
  const [geminiInput, setGeminiInput] = useState('')
  const [mapResetKey, setMapResetKey] = useState(0)
  const lastAnnouncedType = useRef<PlanType | null>(null)

  const [formData, setFormData] = useState<PlanFormData>({
    placeName: '',
    day: defaultDay,
    startTime: '09:00',
    endTime: '',
    type: 'attraction',
    address: '',
    website: '',
    openingHours: '',
    memo: '',
    photos: [],
    youtubeLink: '',
    mapUrl: '',
    latitude: undefined,
    longitude: undefined,
    googlePlaceId: undefined,
    googleInfo: undefined,
    audioScript: '',
  })
  const [initialFormData, setInitialFormData] = useState(formData)
  // 편집 모드 플랜 로드 게이트 — 로드 완료 전 빈 리뷰 노출 방지 (신규는 즉시 true)
  const [planLoaded, setPlanLoaded] = useState(!isEditing)

  // 위저드 네비 — 신규는 장소(0), 편집은 리뷰 허브(마지막)
  const nav = useWizard(isEditing ? WIZARD_STEP_ORDER.length - 1 : 0, WIZARD_STEP_ORDER.length)

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData)
  const { allowNextNavigation } = useUnsavedChanges(isDirty)

  // 드래프트 (신규만) — 단계 index 포함
  const draftKey = isEditing ? `plan-edit-${planId}` : `plan-new-${tripId}`
  const { hasDraft, restoreDraft, dismissDraft, clearDraft } = useFormDraft<PlanFormData, number>({
    key: draftKey,
    formData,
    setFormData,
    enabled: !isEditing,
    extra: nav.index,
    onRestoreExtra: (stepIndex) => {
      if (typeof stepIndex === 'number') nav.goTo(stepIndex)
    },
  })

  const update = useCallback((patch: Partial<PlanFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }))
  }, [])

  useEffect(() => {
    if (tripId) loadTrip(Number.parseInt(tripId))
  }, [tripId, loadTrip])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (isEditing && planIdNum !== undefined) {
        try {
          const plan = await db.getPlan(planIdNum)
          if (plan && !cancelled) {
            const data: PlanFormData = {
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
            }
            setFormData(data)
            setInitialFormData(data)
          }
        } finally {
          if (!cancelled) setPlanLoaded(true)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isEditing, planIdNum])

  // ── 장소명 변경 + 유형 자동 감지 (스팸 방지) ──
  // 업데이터는 순수하게 유지하고 부수효과(토스트·ref)는 밖에서 처리 (StrictMode 이중 호출 안전)
  const changePlaceName = useCallback(
    (value: string) => {
      const detected = !typeManuallyChanged && value.length >= 2 ? detectPlanType(value) : null
      setFormData((prev) => ({
        ...prev,
        placeName: value,
        type: detected && detected !== prev.type ? detected : prev.type,
      }))
      clearFieldError('placeName')
      if (detected && detected !== formData.type && lastAnnouncedType.current !== detected) {
        lastAnnouncedType.current = detected
        toast.success(`"${PLAN_TYPE_LABELS[detected]}"(으)로 분류했습니다`)
      }
    },
    [typeManuallyChanged, clearFieldError, formData.type],
  )

  // ── PlacesAutocomplete 선택 반영 ──
  const applyPlaceSelection = useCallback(
    (details: PlaceDetails, prediction: PlacePrediction) => {
      const detected = detectPlanType(details.name) || detectPlanType(details.category || '')
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
        openingHours: seedOpeningHours(prev.openingHours, details.openingHours),
        type: !typeManuallyChanged && detected ? detected : prev.type,
      }))
      setMapResetKey((k) => k + 1)
      if (!typeManuallyChanged && detected && lastAnnouncedType.current !== detected) {
        lastAnnouncedType.current = detected
        toast.success(`"${PLAN_TYPE_LABELS[detected]}"(으)로 분류했습니다`)
      }
      toast.success('장소 정보가 입력되었습니다')
    },
    [typeManuallyChanged],
  )

  // ── Google Maps URL 정보 추출 ──
  const handleExtractInfo = useCallback(async () => {
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
        latitude: extracted.latitude ?? prev.latitude,
        longitude: extracted.longitude ?? prev.longitude,
        googlePlaceId: extracted.googleInfo.placeId,
        googleInfo: extracted.googleInfo,
        // 영업시간 정본화: memo 덤프 폐지 → openingHours 문자열이 비었을 때만 시드
        openingHours: seedOpeningHours(prev.openingHours, extracted.googleInfo.openingHours),
      }))
      if (extracted.latitude !== undefined || extracted.longitude !== undefined) {
        setMapResetKey((k) => k + 1)
      }
      toast.success('장소 정보를 추출했습니다')
    } catch (error) {
      console.error('Extraction error:', error)
      toast.error(error instanceof Error ? error.message : '정보 추출에 실패했습니다')
    } finally {
      setIsExtracting(false)
    }
  }, [formData.mapUrl])

  // ── Gemini 스마트 붙여넣기 ──
  const handleSmartPaste = useCallback(() => {
    if (!geminiInput.trim()) return
    const lines = geminiInput.split('\n')
    const updates: Partial<PlanFormData> = {}
    const openingHoursList: string[] = []
    const descriptionLines: string[] = []
    const structuredFields = [
      '공식명칭:',
      '주소:',
      '웹사이트:',
      '연락처:',
      '운영시간:',
      '평점:',
      '카테고리:',
      '위치:',
    ]
    let currentSection = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        if (currentSection === 'description') descriptionLines.push('')
        continue
      }
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
        if (!updates.googleInfo) updates.googleInfo = { extractedAt: new Date() }
        updates.googleInfo.phone = phone
        currentSection = 'structured'
      } else if (trimmed.startsWith('운영시간:')) {
        openingHoursList.push(trimmed.replace('운영시간:', '').trim())
        currentSection = 'structured'
      } else if (trimmed.startsWith('평점:')) {
        const ratingMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*\/\s*5/)
        if (ratingMatch) {
          const parsedRating = Number.parseFloat(ratingMatch[1])
          if (Number.isFinite(parsedRating) && parsedRating >= 0 && parsedRating <= 5) {
            if (!updates.googleInfo) updates.googleInfo = { extractedAt: new Date() }
            updates.googleInfo.rating = parsedRating
            const reviewMatch = trimmed.match(/(\d{1,3}(,\d{3})*|\d+)개/)
            if (reviewMatch) {
              updates.googleInfo.reviewCount = Number.parseInt(reviewMatch[1].replace(/,/g, ''))
            }
          }
        }
        currentSection = 'structured'
      } else if (trimmed.startsWith('카테고리:')) {
        if (!updates.googleInfo) updates.googleInfo = { extractedAt: new Date() }
        updates.googleInfo.category = trimmed.replace('카테고리:', '').trim()
        currentSection = 'structured'
      } else {
        const isStructuredField = structuredFields.some((f) => trimmed.startsWith(f))
        if (!isStructuredField) {
          currentSection = 'description'
          descriptionLines.push(trimmed)
        }
      }
    }

    if (openingHoursList.length > 0) {
      if (!updates.googleInfo) updates.googleInfo = { extractedAt: new Date() }
      updates.googleInfo.openingHours = openingHoursList
    }

    const description = descriptionLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (description) updates.memo = description

    setFormData((prev) => {
      const mergedGoogleInfo: GooglePlaceInfo = {
        ...prev.googleInfo,
        ...updates.googleInfo,
        extractedAt: new Date(),
      }
      return {
        ...prev,
        ...updates,
        googleInfo: mergedGoogleInfo,
        // 영업시간 정본화: 배열은 googleInfo에, 표시 문자열은 비었을 때만 시드
        openingHours: seedOpeningHours(prev.openingHours, mergedGoogleInfo.openingHours),
      }
    })
    toast.success('Gemini 정보가 적용되었습니다')
    setGeminiInput('')
  }, [geminiInput])

  const handleCopyJSON = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(formData, null, 2))
    toast.success('JSON데이터가 복사되었습니다')
  }, [formData])

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      try {
        const newPhotos = await processImages(files)
        setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...newPhotos].slice(0, 10) }))
      } catch {
        toast.error('이미지 업로드 실패')
      }
    }
  }, [])

  const removePhoto = useCallback((index: number) => {
    setFormData((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))
  }, [])

  const autoRegisterToPlaceLibrary = useCallback(async () => {
    if (!formData.placeName.trim()) return
    const existing = findPlaceByNameOrGoogleId(formData.placeName, formData.googlePlaceId)
    if (existing?.id) {
      await incrementPlaceUsage(existing.id)
      toast.info(`"${formData.placeName}" 사용 횟수가 증가했습니다`)
    } else {
      await placeAddPlace({
        name: formData.placeName,
        type: formData.type,
        address: formData.address,
        memo: formData.memo,
        audioScript: formData.audioScript,
        photos: formData.photos,
        rating: formData.googleInfo?.rating,
        mapUrl: formData.mapUrl,
        website: formData.website,
        googlePlaceId: formData.googlePlaceId,
        latitude: formData.latitude,
        longitude: formData.longitude,
      })
      toast.success(`"${formData.placeName}"이(가) 장소 라이브러리에 등록되었습니다`)
    }
  }, [formData, findPlaceByNameOrGoogleId, incrementPlaceUsage, placeAddPlace])

  // ── 제출 — 실패 시 점프할 단계 id, 성공 시 null ──
  const submit = useCallback(async (): Promise<WizardStepId | null> => {
    const validationErrors = validate(formData)
    if (validationErrors) {
      const firstField = Object.keys(validationErrors)[0]
      const firstError = validationErrors[firstField]
      if (firstError) toast.error(firstError)
      return FIELD_STEP[firstField] ?? 'place'
    }
    if (formData.latitude !== undefined && (formData.latitude < -90 || formData.latitude > 90)) {
      toast.error('위도는 -90 ~ 90 사이여야 합니다')
      return 'location'
    }
    if (
      formData.longitude !== undefined &&
      (formData.longitude < -180 || formData.longitude > 180)
    ) {
      toast.error('경도는 -180 ~ 180 사이여야 합니다')
      return 'location'
    }
    if (!tripId) return 'place'

    // 시간 충돌 경고 (비차단)
    const currentPlans = useTripStore.getState().currentPlans
    const sameDayPlans = currentPlans.filter((p) => p.day === formData.day)
    const conflict = checkPlanConflict({ ...formData, id: planIdNum }, sameDayPlans)
    if (conflict) {
      toast.warning(
        `시간 충돌: "${conflict.planB.placeName}" (${conflict.planB.startTime}~${conflict.planB.endTime})과 겹칩니다`,
      )
    }

    setIsSubmitting(true)
    try {
      const planData = { tripId: Number.parseInt(tripId), ...formData }
      if (isEditing && planIdNum !== undefined) {
        await updatePlan(planIdNum, planData)
        toast.success('일정이 수정되었습니다')
      } else {
        await addPlan(planData)
        toast.success('일정이 추가되었습니다')
      }
      if (saveToLibrary) await autoRegisterToPlaceLibrary()
      clearDraft()
      allowNextNavigation()
      navigate(-1)
      return null
    } catch {
      toast.error(isEditing ? '일정 수정 실패' : '일정 추가 실패')
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [
    formData,
    validate,
    tripId,
    planIdNum,
    isEditing,
    updatePlan,
    addPlan,
    saveToLibrary,
    autoRegisterToPlaceLibrary,
    clearDraft,
    navigate,
    allowNextNavigation,
  ])

  // ── 편집 유틸 ──
  const handleExportPlan = useCallback(async () => {
    if (planIdNum === undefined) return
    setIsExporting(true)
    try {
      const data = await db.exportSinglePlan(planIdNum)
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
  }, [planIdNum, formData.placeName])

  const handleImportPlan = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !tripId) return
      // 위저드 파기 경고 (이탈 가드와 일관)
      if (isDirty && !window.confirm('현재 작성 내용이 사라집니다. 파일에서 일정을 가져올까요?')) {
        e.target.value = ''
        return
      }
      setIsImporting(true)
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const validation = db.validateSinglePlanBackup(data)
        if (!validation.valid) {
          toast.error(validation.error || '유효하지 않은 파일입니다')
          return
        }
        await db.importSinglePlan(data, Number.parseInt(tripId), formData.day)
        clearDraft()
        allowNextNavigation()
        toast.success('일정이 가져오기되었습니다')
        navigate(-1)
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
    },
    [tripId, formData.day, isDirty, clearDraft, navigate, allowNextNavigation],
  )

  const handleDownloadPlanTemplate = useCallback(() => {
    const template = db.getSinglePlanTemplate()
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plan-template.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('템플릿이 다운로드되었습니다')
  }, [])

  // ── 게이팅 ──
  const hasPlaceName = formData.placeName.trim().length > 0
  const coordsBad =
    (formData.latitude !== undefined && (formData.latitude < -90 || formData.latitude > 90)) ||
    (formData.longitude !== undefined && (formData.longitude < -180 || formData.longitude > 180))
  const maxReachableIndex = !hasPlaceName ? 0 : coordsBad ? 1 : WIZARD_STEP_ORDER.length - 1
  const currentStepId = WIZARD_STEP_ORDER[nav.index]
  const advanceBlocked =
    (currentStepId === 'place' && !hasPlaceName) || (currentStepId === 'location' && coordsBad)

  const jumpToStep = useCallback(
    (id: WizardStepId) => {
      const target = WIZARD_STEP_ORDER.indexOf(id)
      if (target < 0 || target > maxReachableIndex) return
      nav.goTo(target)
    },
    [nav, maxReachableIndex],
  )

  const tripDuration = currentTrip
    ? getTripDurationSafe(currentTrip.startDate, currentTrip.endDate)
    : 30

  const onExit = useCallback(() => navigate(-1), [navigate])
  const onSave = useCallback(async () => {
    const errStep = await submit()
    if (errStep) nav.goTo(WIZARD_STEP_ORDER.indexOf(errStep))
  }, [submit, nav])

  const ctx: PlanWizardContext = {
    data: formData,
    setData: setFormData,
    update,
    currentTrip,
    tripDuration,
    claudeEnabled: claudeEnabled ?? false,
    localPlaces,
    isEditing,
    planIdNum,
    errors,
    clearFieldError,
    typeManuallyChanged,
    setTypeManuallyChanged,
    changePlaceName,
    applyPlaceSelection,
    geminiInput,
    setGeminiInput,
    isExtracting,
    handleExtractInfo,
    handleSmartPaste,
    handleCopyJSON,
    mapResetKey,
    handleImageUpload,
    removePhoto,
    openAIMemo: () => setIsAIMemoOpen(true),
    openAIGuide: () => setIsAIGuideOpen(true),
    openAIPhoto: () => setIsAIPhotoOpen(true),
    isExporting,
    isImporting,
    handleExportPlan,
    handleImportPlan,
    handleDownloadPlanTemplate,
    jumpToStep,
    goNext: () => {
      if (!advanceBlocked) nav.goNext()
    },
    isSubmitting,
    saveToLibrary,
    setSaveToLibrary,
    submit,
  }

  return (
    <PageContainer maxWidth="md">
      {/* 드래프트 복원 배너 */}
      {hasDraft && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950/30">
          <p className="text-sm text-primary-700 dark:text-primary-300">
            이전 작성 내용이 있습니다. 불러올까요?
          </p>
          <div className="flex gap-2">
            <Button size="sm" color="primary" onClick={restoreDraft}>
              불러오기
            </Button>
            <Button size="sm" color="secondary" outline onClick={dismissDraft}>
              무시
            </Button>
          </div>
        </div>
      )}

      {/* 상시 유틸 툴바 — 단계와 무관하게 항상 도달 가능 (JSON·가져오기·템플릿·내보내기) */}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          size="xs"
          plain
          color="secondary"
          leftIcon={<ClipboardCopy className="size-3.5" />}
          onClick={handleCopyJSON}
        >
          JSON 복사
        </Button>
        <label>
          <Button
            type="button"
            size="xs"
            plain
            color="secondary"
            as="span"
            leftIcon={<Upload className="size-3.5" />}
            isLoading={isImporting}
          >
            가져오기
          </Button>
          <input type="file" accept=".json" className="hidden" onChange={handleImportPlan} />
        </label>
        <Button
          type="button"
          size="xs"
          plain
          color="secondary"
          leftIcon={<FileJson className="size-3.5" />}
          onClick={handleDownloadPlanTemplate}
        >
          템플릿
        </Button>
        {isEditing && (
          <Button
            type="button"
            size="xs"
            plain
            color="secondary"
            leftIcon={<Download className="size-3.5" />}
            onClick={handleExportPlan}
            isLoading={isExporting}
          >
            내보내기
          </Button>
        )}
      </div>

      {isEditing && !planLoaded ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <PlanWizard
          ctx={ctx}
          nav={nav}
          advanceBlocked={advanceBlocked}
          maxReachableIndex={maxReachableIndex}
          onExit={onExit}
          onSave={onSave}
        />
      )}

      {/* AI 다이얼로그 */}
      {claudeEnabled && (
        <>
          <AIMemoGenerator
            open={isAIMemoOpen}
            onClose={() => setIsAIMemoOpen(false)}
            plan={{
              ...formData,
              id: planIdNum,
              tripId: Number.parseInt(tripId || '0'),
              createdAt: new Date(),
              updatedAt: new Date(),
            }}
            country={currentTrip?.country}
            mode={formData.memo ? 'append' : 'replace'}
            onApply={(memo) => update({ memo })}
          />
          {currentTrip && (
            <AIGuideGenerator
              open={isAIGuideOpen}
              onClose={() => setIsAIGuideOpen(false)}
              plan={{
                ...formData,
                id: planIdNum,
                tripId: Number.parseInt(tripId || '0'),
                createdAt: new Date(),
                updatedAt: new Date(),
              }}
              trip={currentTrip}
              onApply={(script) => update({ audioScript: script })}
            />
          )}
          <AIPhotoAnalyzer
            open={isAIPhotoOpen}
            onClose={() => setIsAIPhotoOpen(false)}
            onApply={(result) => {
              setFormData((prev) => ({
                ...prev,
                placeName: result.placeName || prev.placeName,
                type: ['attraction', 'restaurant', 'hotel', 'transport', 'other'].includes(
                  result.type,
                )
                  ? (result.type as PlanType)
                  : prev.type,
                memo: result.description
                  ? (prev.memo ? `${prev.memo}\n\n` : '') +
                    result.description +
                    (result.tips?.length
                      ? `\n\n💡 팁\n${result.tips.map((t) => `- ${t}`).join('\n')}`
                      : '')
                  : prev.memo,
              }))
              setIsAIPhotoOpen(false)
              toast.success('AI 분석 결과가 적용되었습니다')
            }}
          />
        </>
      )}
    </PageContainer>
  )
}
