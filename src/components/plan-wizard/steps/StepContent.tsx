// ============================================
// StepContent — 4단계: 콘텐츠 & 미디어 (선택)
// 메모 · Moonyou Guide 음성 스크립트 · 사진 · YouTube
// ============================================

import { MemoRenderer } from '@/components/memo'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { Camera, ExternalLink, Eye, EyeOff, Sparkles, Volume2, X, Youtube } from 'lucide-react'
import { useState } from 'react'
import type { StepProps } from '../types'

export function StepContent({ ctx }: StepProps) {
  const { data, update, claudeEnabled } = ctx
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="space-y-5">
      {/* 메모 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <Label>메모</Label>
            {claudeEnabled && data.placeName && (
              <Button
                type="button"
                size="xs"
                outline
                color="primary"
                leftIcon={<Sparkles className="size-3" />}
                onClick={ctx.openAIMemo}
              >
                AI 메모
              </Button>
            )}
          </div>
          {data.memo && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {showPreview ? (
                <>
                  <EyeOff className="size-4" />
                  편집
                </>
              ) : (
                <>
                  <Eye className="size-4" />
                  미리보기
                </>
              )}
            </button>
          )}
        </div>
        {showPreview && data.memo ? (
          <div className="min-h-[120px] rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <MemoRenderer content={data.memo} />
          </div>
        ) : (
          <Textarea
            value={data.memo}
            onChange={(value) => update({ memo: value })}
            placeholder="추가 메모... (마크다운 지원)"
            rows={5}
          />
        )}
      </div>

      {/* Moonyou Guide 음성 스크립트 */}
      <div className="space-y-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 dark:border-emerald-800 dark:from-emerald-950/30 dark:to-teal-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Volume2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            <Label className="text-emerald-700 dark:text-emerald-300">
              Moonyou Guide 음성 스크립트
            </Label>
          </div>
          <div className="flex items-center gap-2">
            {claudeEnabled && data.placeName && (
              <Button
                type="button"
                size="xs"
                outline
                color="primary"
                leftIcon={<Sparkles className="size-3" />}
                onClick={ctx.openAIGuide}
              >
                AI 생성
              </Button>
            )}
            <a
              href="https://gemini.google.com/gem/1pSqw6tcLNq--HKClJEGOBlK-qRiBsGqr?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              <Sparkles className="size-4" />
              Gem
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
        <Textarea
          value={data.audioScript}
          onChange={(value) => update({ audioScript: value })}
          placeholder="Moonyou Guide 대본을 입력하세요... (Gem에서 생성한 스크립트 붙여넣기)"
          rows={5}
        />
        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
          입력하면 상세화면에서 음성으로 들을 수 있습니다
        </p>
      </div>

      {/* 사진 */}
      <div>
        <div className="flex items-center gap-2">
          <Label>사진</Label>
          {claudeEnabled && (
            <Button
              type="button"
              size="xs"
              outline
              color="primary"
              leftIcon={<Camera className="size-3" />}
              onClick={ctx.openAIPhoto}
            >
              AI 분석
            </Button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 max-[360px]:grid-cols-2 sm:grid-cols-4">
          {data.photos.map((photo, index) => (
            <div key={photo} className="relative aspect-square overflow-hidden rounded-lg">
              <img src={photo} alt="" className="h-full w-full object-cover" />
              <IconButton
                type="button"
                color="danger"
                size="xs"
                className="absolute right-1 top-1"
                onClick={() => ctx.removePhoto(index)}
                aria-label="사진 삭제"
              >
                <X className="size-3" />
              </IconButton>
            </div>
          ))}
          {data.photos.length < 10 && (
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 transition-colors hover:border-primary-500 dark:border-zinc-600">
              <Camera className="size-6 text-zinc-400" />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={ctx.handleImageUpload}
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">최대 10장</p>
      </div>

      {/* YouTube */}
      <Input
        label="YouTube 링크"
        value={data.youtubeLink}
        onChange={(value) => update({ youtubeLink: value })}
        placeholder="https://youtube.com/watch?v=..."
        leftIcon={<Youtube className="size-4" />}
      />
    </div>
  )
}
