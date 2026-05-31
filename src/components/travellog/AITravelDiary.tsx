// ============================================
// AI Travel Diary Generator
// Uses Claude to generate a travel diary/essay
// from travel log entries
// ============================================

import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { generateWithStreaming } from '@/services/claudeService'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/uiStore'
import type { TravelLog } from '@/types'
import { BookOpen, Copy, Loader2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

interface AITravelDiaryProps {
  logs: TravelLog[]
  tripTitle: string
  totalDays: number
}

export function AITravelDiary({ logs, tripTitle, totalDays }: AITravelDiaryProps) {
  const [open, setOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const aiProvider = useSettingsStore((s) => s.aiProvider) || 'claude'
  const aiKeyMode = useSettingsStore((s) => s.aiKeyMode) || 'server'
  const claudeApiKey = useSettingsStore((s) => s.claudeApiKey)
  const claudeModel = useSettingsStore((s) => s.claudeModel) || 'sonnet'
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const geminiModel = useSettingsStore((s) => s.geminiModel) || 'flash'

  const isServerKey = aiKeyMode !== 'custom'
  const apiKey = isServerKey ? undefined : (aiProvider === 'gemini' ? geminiApiKey : claudeApiKey)
  const model = aiProvider === 'gemini' ? geminiModel : claudeModel

  const handleGenerate = useCallback(async () => {
    if (!isServerKey && !apiKey) {
      toast.error('설정에서 API 키를 입력해주세요')
      return
    }

    const targetLogs = selectedDay ? logs.filter((l) => l.day === selectedDay) : logs

    if (targetLogs.length === 0) {
      toast.error('기록이 없습니다')
      return
    }

    setIsGenerating(true)
    setText('')
    const ac = new AbortController()
    abortRef.current = ac

    const logSummaries = targetLogs
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((l) => {
        const time = new Date(l.timestamp).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        const parts = [`Day ${l.day} ${time}`]
        if (l.placeName) parts.push(`장소: ${l.placeName}`)
        if (l.address) parts.push(`주소: ${l.address}`)
        if (l.type === 'memo' && l.memo) parts.push(`메모: ${l.memo}`)
        if (l.type === 'receipt' && l.expense) {
          parts.push(
            `소비: ${l.expense.storeName} ${l.expense.totalAmount.toLocaleString()}${l.expense.currency}`,
          )
        }
        if (l.type === 'photo') parts.push('(사진 촬영)')
        return parts.join(' | ')
      })
      .join('\n')

    const context = {
      type: 'travel-diary' as const,
      context: {
        tripTitle,
        dayNumber: selectedDay,
        totalDays,
        logSummaries,
      },
    }

    try {
      await generateWithStreaming(
        context,
        apiKey,
        model,
        (chunk) => {
          if (!ac.signal.aborted) {
            setText((prev) => prev + chunk)
          }
        },
        () => {
          if (!ac.signal.aborted) setIsGenerating(false)
        },
        (err) => {
          if (ac.signal.aborted) return // 닫기로 인한 중단이면 토스트 생략
          toast.error(`생성 실패: ${err.message}`)
          setIsGenerating(false)
        },
        aiProvider,
        ac.signal,
      )
    } catch {
      if (!ac.signal.aborted) setIsGenerating(false)
    }
  }, [apiKey, model, aiProvider, isServerKey, logs, selectedDay, tripTitle, totalDays])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('클립보드에 복사했습니다')
    })
  }, [text])

  const handleClose = useCallback(() => {
    abortRef.current?.abort() // 진행 중인 스트림 요청을 실제로 취소
    setOpen(false)
    setIsGenerating(false)
  }, [])

  return (
    <>
      <IconButton
        plain
        color="secondary"
        onClick={() => setOpen(true)}
        aria-label="AI 여행 일기"
        title="AI 여행 일기"
      >
        <BookOpen className="size-5" />
      </IconButton>

      <Dialog open={open} onClose={handleClose} size="lg">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--foreground)]">AI 여행 일기</h2>
            <IconButton plain color="secondary" onClick={handleClose} aria-label="닫기">
              <X className="size-5" />
            </IconButton>
          </div>

          {/* Day selector */}
          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">
              대상 선택
            </span>
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedDay === null
                    ? 'bg-primary-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                전체 여행
              </button>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedDay === day
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Day {day}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            color="primary"
            onClick={handleGenerate}
            disabled={isGenerating || (!isServerKey && !apiKey)}
            leftIcon={
              isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BookOpen className="size-4" />
              )
            }
            className="w-full"
          >
            {isGenerating ? '생성 중...' : '일기 생성'}
          </Button>

          {!isServerKey && !apiKey && (
            <p className="text-xs text-warning-600 text-center">
              설정 → API 키를 먼저 입력해주세요
            </p>
          )}

          {/* Generated text */}
          {text && (
            <div className="relative">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
                  {text}
                </pre>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-zinc-700/80 hover:bg-white dark:hover:bg-zinc-600 transition-colors"
                title="복사"
              >
                <Copy className="size-4 text-zinc-500" />
              </button>
            </div>
          )}
        </div>
      </Dialog>
    </>
  )
}
