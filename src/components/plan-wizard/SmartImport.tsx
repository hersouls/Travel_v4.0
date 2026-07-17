// ============================================
// SmartImport — 스마트 임포트 3-way (검색 / URL / Gemini)
// + '사진으로 찾기' 인테이크
// ============================================

import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete'
import { motion } from 'framer-motion'
import { Camera, ExternalLink, Link2, Loader2, MapPin, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { StepProps } from './types'

type ImportTab = 'search' | 'url' | 'gemini'

const TABS: { id: ImportTab; label: string; icon: typeof Search }[] = [
  { id: 'search', label: '검색', icon: Search },
  { id: 'url', label: 'URL', icon: Link2 },
  { id: 'gemini', label: 'Gemini', icon: Sparkles },
]

export function SmartImport({ ctx }: StepProps) {
  const [tab, setTab] = useState<ImportTab>('search')
  const { data, update, localPlaces, applyPlaceSelection } = ctx

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary-50/60 to-blue-50/50 p-3 ring-1 ring-primary-500/15 dark:from-primary-950/25 dark:to-blue-950/20 dark:ring-primary-500/20 sm:p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
        <Sparkles className="size-3.5" />
        빠른 자동 채우기
      </div>

      {/* 세그먼트 탭 */}
      <div
        className="relative grid grid-cols-3 gap-1 rounded-xl bg-white/60 p-1 dark:bg-zinc-900/40"
        role="tablist"
        aria-label="자동 채우기 방식"
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`smart-import-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`smart-import-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                e.preventDefault()
                const idx = TABS.findIndex((x) => x.id === tab)
                const dir = e.key === 'ArrowRight' ? 1 : -1
                const next = TABS[(idx + dir + TABS.length) % TABS.length]
                setTab(next.id)
                e.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>(`#smart-import-tab-${next.id}`)
                  ?.focus()
              }}
              className="relative flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="smart-import-tab"
                  className="absolute inset-0 rounded-lg bg-primary-500 shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 inline-flex items-center gap-1.5 ${
                  active ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div
        className="mt-3"
        role="tabpanel"
        id={`smart-import-panel-${tab}`}
        aria-labelledby={`smart-import-tab-${tab}`}
      >
        {tab === 'search' && (
          <PlacesAutocomplete
            placeholder="장소 이름 또는 주소 검색..."
            value={data.address}
            onChange={(value) => update({ address: value })}
            localPlaces={localPlaces}
            onPlaceSelect={applyPlaceSelection}
          />
        )}

        {tab === 'url' && (
          <div className="space-y-2">
            <Input
              value={data.mapUrl}
              onChange={(value) => update({ mapUrl: value })}
              placeholder="Google Maps URL (maps.app.goo.gl/...)"
              leftIcon={<MapPin className="size-4" />}
            />
            <Button
              type="button"
              color="primary"
              size="sm"
              onClick={ctx.handleExtractInfo}
              disabled={!data.mapUrl || ctx.isExtracting}
              leftIcon={
                ctx.isExtracting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )
              }
            >
              {ctx.isExtracting ? '추출 중...' : '정보 추출'}
            </Button>
            <p className="text-xs text-zinc-500">
              Google Maps 링크를 붙여넣으면 장소명·주소·좌표·평점을 자동으로 가져옵니다
            </p>
          </div>
        )}

        {tab === 'gemini' && (
          <div className="space-y-2">
            <Textarea
              value={ctx.geminiInput}
              onChange={ctx.setGeminiInput}
              placeholder="Gemini에서 생성된 장소 가이드를 여기에 붙여넣으세요..."
              rows={4}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href="https://gemini.google.com/gem/1sJ4ixxslCiVSVAeeH2mvkGwpxWG0b06g?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                <Sparkles className="size-3.5" />
                Gemini Gem 열기
                <ExternalLink className="size-3" />
              </a>
              <Button
                type="button"
                color="secondary"
                size="sm"
                onClick={ctx.handleSmartPaste}
                disabled={!ctx.geminiInput.trim()}
                leftIcon={<Sparkles className="size-4" />}
              >
                정보 적용
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 사진으로 찾기 (AI) */}
      {ctx.claudeEnabled && (
        <button
          type="button"
          onClick={ctx.openAIPhoto}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-300 py-2 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 dark:border-primary-800 dark:text-primary-400 dark:hover:bg-primary-950/30"
        >
          <Camera className="size-3.5" />
          사진으로 장소 찾기
        </button>
      )}
    </div>
  )
}
