// ============================================
// Web Search Tool (Tavily)
// Returns null if TAVILY_API_KEY not set
// ============================================

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export function createWebSearchTool() {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return null

  return new DynamicStructuredTool({
    name: 'web_search',
    description: '여행지 정보, 맛집, 관광지, 최신 여행 소식 등을 웹에서 검색합니다. 실시간 정보가 필요할 때 사용하세요.',
    schema: z.object({
      query: z.string().describe('검색 쿼리 (영어 또는 한국어)'),
    }),
    func: async ({ query }) => {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 3,
            include_answer: true,
            search_depth: 'basic',
          }),
        })

        if (!res.ok) return `검색 실패: ${res.status}`
        const data = await res.json()

        const parts: string[] = []
        if (data.answer) parts.push(`요약: ${data.answer}`)
        if (data.results?.length) {
          for (const r of data.results.slice(0, 3)) {
            parts.push(`- ${r.title}: ${r.content?.slice(0, 200) || ''}`)
          }
        }
        return parts.join('\n') || '검색 결과가 없습니다.'
      } catch (err) {
        return `검색 오류: ${err instanceof Error ? err.message : 'unknown'}`
      }
    },
  })
}
