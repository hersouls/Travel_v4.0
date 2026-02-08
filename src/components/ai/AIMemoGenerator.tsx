// ============================================
// AI Memo Generator Component
// Generates structured travel memos compatible with MemoRenderer
// ============================================

import { useState, useRef } from 'react'
import { Sparkles, Loader2, Check } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { MemoRenderer } from '@/components/memo'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateWithStreaming, buildMemoContext } from '@/services/claudeService'
import type { Plan } from '@/types'

interface AIMemoGeneratorProps {
  plan: Plan
  country?: string
  onApply: (memo: string) => void
  onClose: () => void
  open: boolean
  mode?: 'replace' | 'append'
}

export function AIMemoGenerator({ plan, country, onApply, onClose, open, mode = 'replace' }: AIMemoGeneratorProps) {
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'

  const [generatedMemo, setGeneratedMemo] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const textRef = useRef('')

  const handleGenerate = () => {
    if (!claudeApiKey) {
      setError('API 키가 설정되지 않았습니다. 설정에서 Claude API 키를 입력하세요.')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedMemo('')
    textRef.current = ''
    setShowPreview(false)

    const context = buildMemoContext(plan, country)

    generateWithStreaming(
      { type: 'memo', context },
      claudeApiKey,
      claudeModel,
      (chunk) => {
        textRef.current += chunk
        setGeneratedMemo(textRef.current)
      },
      () => {
        setIsGenerating(false)
        setShowPreview(true)
      },
      (err) => {
        setError(err.message)
        setIsGenerating(false)
      },
    )
  }

  const handleApply = () => {
    if (mode === 'append' && plan.memo) {
      onApply(plan.memo + '\n\n' + generatedMemo)
    } else {
      onApply(generatedMemo)
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle onClose={onClose}>
        <span className="flex items-center gap-2">
          <Sparkles className="size-5 text-blue-500" />
          AI 메모 생성
        </span>
      </DialogTitle>
      <DialogBody>
        <p className="text-sm text-zinc-500 mb-4">
          "{plan.placeName}"에 대한 실용적인 여행 메모를 AI가 생성합니다.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {generatedMemo ? (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 max-h-[400px] overflow-y-auto">
            {showPreview ? (
              <MemoRenderer content={generatedMemo} />
            ) : (
              <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {generatedMemo}
                {isGenerating && <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />}
              </div>
            )}
          </div>
        ) : !isGenerating ? (
          <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
            <Sparkles className="size-8 text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">
              "생성" 버튼을 클릭하면 AI가 여행 메모를 작성합니다.
            </p>
            <p className="text-xs text-zinc-400 mt-2">
              기본 정보, 체크리스트, 여행 팁, 비용, 교통 정보 포함
            </p>
          </div>
        ) : (
          <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
            <Loader2 className="size-8 text-blue-500 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-zinc-500">메모를 생성하는 중...</p>
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={onClose}>
          취소
        </Button>
        {!generatedMemo && !isGenerating && (
          <Button
            color="primary"
            onClick={handleGenerate}
            leftIcon={<Sparkles className="size-4" />}
          >
            생성
          </Button>
        )}
        {isGenerating && (
          <Button color="secondary" disabled>
            <Loader2 className="size-4 animate-spin mr-2" />
            생성 중...
          </Button>
        )}
        {generatedMemo && !isGenerating && (
          <>
            {showPreview && (
              <Button
                color="secondary"
                plain
                onClick={() => setShowPreview(false)}
              >
                원본 보기
              </Button>
            )}
            {!showPreview && (
              <Button
                color="secondary"
                plain
                onClick={() => setShowPreview(true)}
              >
                미리보기
              </Button>
            )}
            <Button
              color="secondary"
              outline
              onClick={handleGenerate}
              leftIcon={<Sparkles className="size-4" />}
            >
              다시 생성
            </Button>
            <Button
              color="primary"
              onClick={handleApply}
              leftIcon={<Check className="size-4" />}
            >
              {mode === 'append' ? '추가' : '적용'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
