// ============================================
// Currency Conversion Tool
// Uses free open.er-api.com (no API key needed)
// ============================================

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export function createCurrencyTool() {
  return new DynamicStructuredTool({
    name: 'convert_currency',
    description: '환율을 조회하고 통화를 변환합니다. 여행 예산, 가격 비교 질문에 사용하세요.',
    schema: z.object({
      amount: z.number().describe('변환할 금액'),
      from: z.string().length(3).regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()).describe('원래 통화 코드 (예: USD, JPY, EUR)'),
      to: z.string().length(3).regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()).describe('목표 통화 코드 (예: KRW, USD)'),
    }),
    func: async ({ amount, from, to }) => {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${from}`)
        if (!res.ok) return `${from} 환율 정보를 가져올 수 없습니다.`
        const data = await res.json()
        const rate = data.rates?.[to]
        if (!rate) return `${to} 통화를 찾을 수 없습니다.`
        const converted = Math.round(amount * rate * 100) / 100
        return `💱 ${amount.toLocaleString()} ${from} = ${converted.toLocaleString()} ${to} (환율: 1 ${from} = ${rate} ${to})`
      } catch (err) {
        return `환율 조회 오류: ${err instanceof Error ? err.message : 'unknown'}`
      }
    },
  })
}
