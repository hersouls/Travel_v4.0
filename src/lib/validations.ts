// ============================================
// Zod Validation Schemas
// ============================================

import { z } from 'zod'

// BUG-01: Reusable date string schema with actual validity check
// Regex alone allows invalid dates like 2025-13-45; refine catches them
const dateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)')
  .refine(val => {
    const [y, m, d] = val.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  }, '유효하지 않은 날짜입니다')

export const tripSchema = z.object({
  title: z.string().min(1, '여행 이름을 입력해주세요'),
  country: z.string().min(1, '국가를 선택해주세요'),
  startDate: dateString,
  endDate: dateString,
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
    // BUG-02: Allow midnight-crossing schedules (e.g., 23:00 → 01:00)
    // Only reject when start and end times are identical
    if (!data.endTime) return true
    return data.endTime !== data.startTime
  },
  { message: '종료 시간은 시작 시간과 달라야 합니다', path: ['endTime'] }
)

export type PlanFormData = z.infer<typeof planSchema>

export const placeSchema = z.object({
  name: z.string().min(1, '장소 이름을 입력해주세요'),
  type: z.enum(PLAN_TYPES, { error: '유형을 선택해주세요' }),
})

export type PlaceFormData = z.infer<typeof placeSchema>

// BUG-06/ENH-01: Expense data validation schema
const EXPENSE_CATEGORIES = ['food', 'transport', 'accommodation', 'shopping', 'attraction', 'other'] as const

const expenseItemSchema = z.object({
  name: z.string().min(1, '항목명을 입력해주세요'),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  amount: z.number().positive('금액은 0보다 커야 합니다'),
})

const PAYMENT_METHODS = ['cash', 'card', 'other'] as const

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, { error: '카테고리를 선택해주세요' }),
  storeName: z.string().min(1, '상점명을 입력해주세요'),
  totalAmount: z.number().positive('합계는 0보다 커야 합니다'),
  currency: z.string().length(3, '통화 코드는 3자리여야 합니다'),
  items: z.array(expenseItemSchema).min(1, '항목이 최소 1개 필요합니다'),
  receiptDate: dateString.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
