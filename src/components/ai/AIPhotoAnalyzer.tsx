// ============================================
// AI Photo Analyzer Component
// Uses Claude Vision to analyze travel photos
// ============================================

import { useState } from 'react'
import { Camera, Sparkles, Loader2, Check } from 'lucide-react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateStructured, buildImageAnalysisContext } from '@/services/claudeService'

interface AnalysisResult {
  placeName: string
  type: string
  description: string
  tips: string[]
  estimatedLocation: string
}

interface AIPhotoAnalyzerProps {
  onApply: (result: AnalysisResult) => void
  onClose: () => void
  open: boolean
}

export function AIPhotoAnalyzer({ onApply, onClose, open }: AIPhotoAnalyzerProps) {
  const claudeApiKey = useSettingsStore((state) => state.claudeApiKey)
  const claudeModel = useSettingsStore((state) => state.claudeModel) || 'sonnet'

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Create preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setImagePreview(dataUrl)
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64 = dataUrl.split(',')[1]
      setImageBase64(base64)
      setResult(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyze = async () => {
    if (!claudeApiKey) {
      setError('API 키가 설정되지 않았습니다. 설정에서 Claude API 키를 입력하세요.')
      return
    }

    if (!imageBase64) {
      setError('사진을 선택하세요.')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const request = buildImageAnalysisContext(imageBase64)
      const response = await generateStructured<AnalysisResult>(
        request,
        claudeApiKey,
        claudeModel,
      )

      if (typeof response === 'string') {
        try {
          setResult(JSON.parse(response))
        } catch {
          setError('AI 응답을 파싱할 수 없습니다.')
        }
      } else {
        setResult(response)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 분석에 실패했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle onClose={onClose}>
        <span className="flex items-center gap-2">
          <Camera className="size-5 text-indigo-500" />
          AI 사진 분석
        </span>
      </DialogTitle>
      <DialogBody>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Image Upload */}
          {!imagePreview ? (
            <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl cursor-pointer hover:border-indigo-500 transition-colors">
              <Camera className="size-10 text-zinc-400" />
              <span className="text-sm text-zinc-500">사진을 선택하세요</span>
              <span className="text-xs text-zinc-400">JPG, PNG 지원</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={imagePreview}
                  alt="Selected"
                  className="w-full max-h-[300px] object-contain"
                />
                <label className="absolute bottom-2 right-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-zinc-900/90 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                    <Camera className="size-3" />
                    변경
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              </div>

              {/* Analysis Result */}
              {result && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-3">
                  {result.placeName && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500">장소</span>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{result.placeName}</p>
                    </div>
                  )}
                  {result.estimatedLocation && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500">추정 위치</span>
                      <p className="text-sm text-[var(--foreground)]">{result.estimatedLocation}</p>
                    </div>
                  )}
                  {result.type && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500">유형</span>
                      <p className="text-sm text-[var(--foreground)]">{result.type}</p>
                    </div>
                  )}
                  {result.description && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500">설명</span>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.description}</p>
                    </div>
                  )}
                  {result.tips && result.tips.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500">팁</span>
                      <ul className="mt-1 space-y-1">
                        {result.tips.map((tip, i) => (
                          <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400">
                            - {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={onClose}>
          취소
        </Button>
        {imagePreview && !result && (
          <Button
            color="primary"
            onClick={handleAnalyze}
            isLoading={isAnalyzing}
            leftIcon={!isAnalyzing ? <Sparkles className="size-4" /> : undefined}
          >
            {isAnalyzing ? '분석 중...' : '분석'}
          </Button>
        )}
        {result && (
          <Button
            color="primary"
            onClick={() => onApply(result)}
            leftIcon={<Check className="size-4" />}
          >
            정보 적용
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
