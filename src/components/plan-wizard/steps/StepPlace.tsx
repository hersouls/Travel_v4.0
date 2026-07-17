// ============================================
// StepPlace — 1단계: 스마트 임포트 + 장소명 앵커(유일 게이트)
// ============================================

import { Input } from '@/components/ui/Input'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import { MapPin } from 'lucide-react'
import { SmartImport } from '../SmartImport'
import type { StepProps } from '../types'

export function StepPlace({ ctx }: StepProps) {
  const { data, changePlaceName, errors } = ctx

  return (
    <div className="space-y-5">
      <SmartImport ctx={ctx} />

      <div>
        <Input
          label="장소 이름"
          value={data.placeName}
          onChange={changePlaceName}
          onKeyDown={(e) => {
            // 한글 IME 조합 확정 Enter는 진행으로 처리하지 않음
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && data.placeName.trim()) {
              e.preventDefault()
              ctx.goNext()
            }
          }}
          placeholder="예: 도쿄 스카이트리"
          leftIcon={<MapPin className="size-4" />}
          error={errors.placeName}
          required
          autoFocus
        />
        <p className="mt-1.5 text-xs text-zinc-400">
          장소 이름만 입력해도 됩니다. 위에서 검색·URL·붙여넣기로 나머지를 자동 완성할 수 있어요.
        </p>
      </div>

      {/* 자동 감지된 유형 안내 (다음 단계 미리보기) */}
      {data.placeName.trim().length >= 2 && (
        <div
          className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
          aria-live="polite"
        >
          <span className="font-medium text-primary-600 dark:text-primary-400">
            {PLAN_TYPE_LABELS[data.type]}
          </span>
          <span>유형으로 분류됨 · 다음 단계에서 변경할 수 있어요</span>
        </div>
      )}
    </div>
  )
}
