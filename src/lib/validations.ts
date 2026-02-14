// ============================================
// Zod Validation Schemas
// ============================================

import { z } from 'zod'

export const tripSchema = z.object({
  title: z.string().min(1, '여행 이름을 입력해주세요'),
  country: z.string().min(1, '국가를 선택해주세요'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)'),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: '종료 날짜는 시작 날짜 이후여야 합니다', path: ['endDate'] }
)

export type TripFormData = z.infer<typeof tripSchema>

const PLAN_TYPES = ['attraction', 'restaurant', 'hotel', 'transport', 'car', 'plane', 'airport', 'other'] as const

export const planSchema = z.object({
  placeName: z.string().min(1, '장소 이름을 입력해주세요'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '올바른 시간 형식이 아닙니다 (HH:mm)'),
  endTime: z.string().optional(),
  type: z.enum(PLAN_TYPES, { error: '유형을 선택해주세요' }),
}).refine(
  (data) => {
    if (!data.endTime) return true
    return data.endTime > data.startTime
  },
  { message: '종료 시간은 시작 시간 이후여야 합니다', path: ['endTime'] }
)

export type PlanFormData = z.infer<typeof planSchema>

export const placeSchema = z.object({
  name: z.string().min(1, '장소 이름을 입력해주세요'),
  type: z.enum(PLAN_TYPES, { error: '유형을 선택해주세요' }),
})

export type PlaceFormData = z.infer<typeof placeSchema>
