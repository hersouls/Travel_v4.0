// ============================================
// AI Guide Generator Component
// Replaces Gemini Gem external link for audio script generation
// ============================================

import { useState, useRef } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateWithStreaming, buildGuideContext } from '@/services/claudeService'
import type { Plan, Trip } from '@/types'

interface AIGuideGeneratorProps {
  plan: Plan
  trip: Trip
  onApply: (script: string) => void
  onClose: () => void
  open: boolean
}

export function AIGuideGenerator({ plan, trip, onApply, onClose, open }: AIGuideGeneratorProps) {
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'

  const [generatedText, setGeneratedText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef('')

  const handleGenerate = () => {
    if (!claudeApiKey) {
      setError('API 키가 설정되지 않았습니다. 설정에서 Claude API 키를 입력하세요.')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedText('')
    textRef.current = ''

    const context = buildGuideContext(plan, trip)

    generateWithStreaming(
      { type: 'guide', context },
      claudeApiKey,
      claudeModel,
      (chunk) => {
        textRef.current += chunk
        setGeneratedText(textRef.current)
      },
      () => {
        setIsGenerating(false)
      },
      (err) => {
        setError(err.message)
        setIsGenerating(false)
      },
    )
  }

  const handleApply = () => {
    onApply(generatedText)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle onClose={onClose}>
        <span className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary-500" />
          AI 가이드 생성
        </span>
      </DialogTitle>
      <DialogBody>
        <p className="text-sm text-zinc-500 mb-4">
          "{plan.placeName}"에 대한 음성 가이드 스크립트를 AI가 생성합니다.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {generatedText ? (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 max-h-[400px] overflow-y-auto">
            <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {generatedText}
              {isGenerating && <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-0.5" />}
            </div>
          </div>
        ) : !isGenerating ? (
          <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
            <Sparkles className="size-8 text-primary-400 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">
              "생성" 버튼을 클릭하면 AI가 여행 가이드 스크립트를 작성합니다.
            </p>
            <p className="text-xs text-zinc-400 mt-2">
              TTS 낭독에 최적화된 한국어 가이드 (3~5분 분량)
            </p>
          </div>
        ) : (
          <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
            <Loader2 className="size-8 text-primary-500 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-zinc-500">가이드를 생성하는 중...</p>
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={onClose}>
          취소
        </Button>
        {!generatedText && !isGenerating && (
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
        {generatedText && !isGenerating && (
          <>
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
              적용
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
