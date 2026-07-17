// ============================================
// Plan Wizard — 공유 타입 & 컨텍스트
// PlanForm 이 상태/핸들러를 소유하고 ctx 하나로 각 스텝에 전달
// ============================================

import type { PlaceDetails, PlacePrediction } from '@/services/placesAutocomplete'
import type { GooglePlaceInfo, Place, PlanType, Trip } from '@/types'
import type { Dispatch, SetStateAction } from 'react'

/** 현행 PlanForm formData 구조를 그대로 보존 */
export interface PlanFormData {
  placeName: string
  day: number
  startTime: string
  endTime: string
  type: PlanType
  address: string
  website: string
  openingHours: string
  memo: string
  photos: string[]
  youtubeLink: string
  mapUrl: string
  latitude: number | undefined
  longitude: number | undefined
  googlePlaceId: string | undefined
  googleInfo: GooglePlaceInfo | undefined
  audioScript: string
}

export type WizardStepId = 'place' | 'location' | 'schedule' | 'content' | 'review'

export const WIZARD_STEP_ORDER: WizardStepId[] = [
  'place',
  'location',
  'schedule',
  'content',
  'review',
]

/** 각 스텝이 소비하는 공유 컨텍스트 — 프롭 드릴링 대신 단일 객체 */
export interface PlanWizardContext {
  // 데이터
  data: PlanFormData
  setData: Dispatch<SetStateAction<PlanFormData>>
  /** 부분 업데이트 편의 (setData((p) => ({ ...p, ...patch }))) */
  update: (patch: Partial<PlanFormData>) => void

  // 여행/설정 컨텍스트
  currentTrip: Trip | null
  tripDuration: number
  claudeEnabled: boolean
  localPlaces: Place[]
  isEditing: boolean
  planIdNum: number | undefined

  // 검증
  errors: Record<string, string | undefined>
  clearFieldError: (field: string) => void

  // 유형 자동 감지
  typeManuallyChanged: boolean
  setTypeManuallyChanged: (v: boolean) => void
  /** 장소명 변경 + 유형 자동 감지 + 필드 에러 초기화 */
  changePlaceName: (value: string) => void
  /** PlacesAutocomplete 선택 결과를 폼에 반영 */
  applyPlaceSelection: (details: PlaceDetails, prediction: PlacePrediction) => void

  // 스마트 임포트
  geminiInput: string
  setGeminiInput: (v: string) => void
  isExtracting: boolean
  handleExtractInfo: () => Promise<void>
  handleSmartPaste: () => void
  handleCopyJSON: () => void
  /** 외부(추출/붙여넣기/검색)로 좌표가 바뀔 때 증가 — MapLocationPicker 통제 리셋용 key */
  mapResetKey: number

  // 사진
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  removePhoto: (index: number) => void

  // AI 다이얼로그
  openAIMemo: () => void
  openAIGuide: () => void
  openAIPhoto: () => void

  // 편집 모드 유틸
  isExporting: boolean
  isImporting: boolean
  handleExportPlan: () => Promise<void>
  handleImportPlan: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleDownloadPlanTemplate: () => void

  // 위저드 네비게이션
  jumpToStep: (id: WizardStepId) => void
  goNext: () => void

  // 제출 — 검증 실패 시 점프할 단계 id, 성공 시 null(이탈)
  isSubmitting: boolean
  saveToLibrary: boolean
  setSaveToLibrary: (v: boolean) => void
  submit: () => Promise<WizardStepId | null>
}

export interface StepProps {
  ctx: PlanWizardContext
}
