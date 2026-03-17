// ============================================
// Zod Schemas for LangChain Structured Output
// Used by generate.ts for validated JSON responses
// ============================================

import { z } from 'zod'

// Itinerary plan item (shared by itinerary + day-recommend)
const PlanItemSchema = z.object({
  placeName: z.string().describe('장소명'),
  startTime: z.string().describe('시작 시간 (HH:mm)'),
  endTime: z.string().describe('종료 시간 (HH:mm)'),
  type: z.enum(['attraction', 'restaurant', 'hotel', 'transport', 'car', 'plane', 'airport', 'other']).describe('장소 유형'),
  address: z.string().optional().describe('주소'),
  memo: z.string().optional().describe('간단한 메모'),
  latitude: z.number().optional().describe('위도'),
  longitude: z.number().optional().describe('경도'),
})

// Full itinerary (multi-day)
export const ItinerarySchema = z.object({
  days: z.array(z.object({
    day: z.number().describe('일차 번호'),
    plans: z.array(PlanItemSchema).describe('해당 일차의 일정 목록'),
  })).describe('일차별 일정'),
})

// Day suggestion (analysis + revised plans)
export const DaySuggestionSchema = z.object({
  analysis: z.string().describe('현재 일정에 대한 전체 분석'),
  suggestions: z.array(z.string()).describe('개선 제안 목록'),
  revisedPlans: z.array(PlanItemSchema).describe('개선된 전체 하루 일정'),
})

// Image analysis result
export const ImageAnalysisSchema = z.object({
  placeName: z.string().describe('식별된 장소 이름'),
  type: z.enum(['attraction', 'restaurant', 'hotel', 'transport', 'other']).describe('장소 유형'),
  description: z.string().describe('장소에 대한 2-3줄 설명'),
  tips: z.array(z.string()).describe('유용한 팁'),
  estimatedLocation: z.string().describe('추정 위치 (도시/국가)'),
})

// Photo location inference
export const PhotoLocationSchema = z.object({
  placeName: z.string().describe('구체적인 장소 이름'),
  estimatedLocation: z.string().describe('도시, 국가'),
  locationType: z.enum(['attraction', 'restaurant', 'hotel', 'transport', 'shopping', 'other']).describe('장소 유형'),
  confidence: z.enum(['high', 'medium', 'low']).describe('확신도'),
  clues: z.string().describe('위치 판단 근거'),
})

// Receipt item (shared by food + general)
const ReceiptItemSchema = z.object({
  name: z.string().describe('항목명'),
  quantity: z.number().describe('수량'),
  unitPrice: z.number().describe('단가'),
  amount: z.number().describe('금액'),
})

// Food receipt OCR
export const ReceiptFoodSchema = z.object({
  storeName: z.string().describe('가게 이름'),
  category: z.literal('food').describe('카테고리'),
  items: z.array(ReceiptItemSchema).describe('메뉴 항목'),
  totalAmount: z.number().describe('합계 금액'),
  currency: z.string().describe('ISO 4217 통화 코드'),
  receiptDate: z.string().optional().describe('영수증 날짜 YYYY-MM-DD'),
})

// General receipt OCR
export const ReceiptGeneralSchema = z.object({
  storeName: z.string().describe('가게/서비스 이름'),
  category: z.enum(['food', 'transport', 'accommodation', 'shopping', 'attraction', 'other']).describe('카테고리'),
  items: z.array(ReceiptItemSchema).describe('항목 목록'),
  totalAmount: z.number().describe('합계 금액'),
  currency: z.string().describe('ISO 4217 통화 코드'),
  receiptDate: z.string().optional().describe('영수증 날짜 YYYY-MM-DD'),
})

// Map of type → schema for structured output types
export const STRUCTURED_SCHEMAS: Record<string, z.ZodType> = {
  'itinerary': ItinerarySchema,
  'day-recommend': ItinerarySchema,
  'day-suggest': DaySuggestionSchema,
  'analyze-image': ImageAnalysisSchema,
  'analyze-photo-location': PhotoLocationSchema,
  'receipt-food': ReceiptFoodSchema,
  'receipt-general': ReceiptGeneralSchema,
}

// Streaming text types (no schema needed)
export const STREAMING_TEXT_TYPES = ['guide', 'memo', 'travel-diary', 'test']
