// ============================================
// AudioPlayer Component - TTS 오디오 플레이어
// ============================================

import { Play, Pause, Square, Volume2, VolumeX, Mic, ExternalLink, Sparkles } from 'lucide-react'
import { useTTS } from './useTTS'
import { useSettingsStore } from '@/stores/settingsStore'
import { cn } from '@/utils/cn'

interface AudioPlayerProps {
  text: string
  compact?: boolean
  className?: string
}

const SPEED_OPTIONS = [
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1.0x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2.0, label: '2.0x' },
]

const MOONYOU_GUIDE_GEM_URL = 'https://gemini.google.com/gem/1pSqw6tcLNq--HKClJEGOBlK-qRiBsGqr?usp=sharing'

export function AudioPlayer({ text, compact = false, className }: AudioPlayerProps) {
  const claudeEnabled = useSettingsStore((state) => state.claudeEnabled)
  const {
    isSupported,
    isPlaying,
    isPaused,
    rate,
    availableVoices,
    selectedVoice,
    error,
    isFallbackMode,
    progress,
    togglePlayPause,
    stop,
    setRate,
    setVoice,
    seek,
  } = useTTS()

  if (!isSupported) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm text-zinc-400',
          compact ? 'py-1' : 'py-2',
          className
        )}
      >
        <VolumeX className="size-4" />
        <span>이 브라우저는 음성 안내를 지원하지 않습니다</span>
      </div>
    )
  }

  const handlePlayPause = () => {
    togglePlayPause(text)
  }

  const handleStop = () => {
    stop()
  }

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRate(Number.parseFloat(e.target.value))
  }

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceName = e.target.value
    if (voiceName === '') {
      setVoice(null, text)
    } else {
      const voice = availableVoices.find((v) => v.name === voiceName)
      setVoice(voice ?? null, text)
    }
  }

  // 음성 이름을 간결하게 표시
  const getVoiceDisplayName = (voice: SpeechSynthesisVoice) => {
    // 이름에서 불필요한 부분 제거
    let name = voice.name
      .replace('Microsoft ', '')
      .replace('Google ', '')
      .replace(' Online (Natural)', '')
      .replace(' - Korean (Korea)', '')
      .replace(' - English (United States)', '')
      .replace(' - Japanese (Japan)', '')
      .replace(' - Chinese (Simplified, China)', '')
    return name
  }

  // 한국어 음성 필터링
  const koreanVoices = availableVoices.filter(
    (v) => v.lang.startsWith('ko') || v.lang.includes('Korean')
  )

  // 기타 음성 (영어, 일본어 등)
  const otherVoices = availableVoices.filter(
    (v) => !v.lang.startsWith('ko') && !v.lang.includes('Korean')
  )

  // 컴팩트 모드 (DayDetail용)
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button
          type="button"
          onClick={handlePlayPause}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            isPlaying && !isPaused
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          )}
          aria-label={isPlaying && !isPaused ? '일시정지' : isPaused ? '재개' : '재생'}
        >
          {isPlaying && !isPaused ? (
            <>
              <Pause className="size-4" />
              <span>일시정지</span>
            </>
          ) : isPaused ? (
            <>
              <Play className="size-4" />
              <span>재개</span>
            </>
          ) : (
            <>
              <Volume2 className="size-4" />
              <span>음성 가이드</span>
            </>
          )}
        </button>

        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={handleStop}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="정지"
          >
            <Square className="size-4" />
          </button>
        )}
      </div>
    )
  }

  // 풀 모드 (PlanDetail용)
  return (
    <div className={cn('space-y-3', className)}>
      {/* 진행바 */}
      <div className="flex items-center gap-2 group">
        <span className="text-xs text-zinc-400 font-mono w-8 text-right">
          {Math.floor(progress * 100)}%
        </span>
        <div className="relative flex-1 h-4 flex items-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={progress}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            aria-label="재생 위치"
          />
          <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div
            className="absolute h-3 w-3 bg-white border border-zinc-200 dark:border-zinc-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center gap-3">
        {/* 재생/일시정지 버튼 */}
        <button
          type="button"
          onClick={handlePlayPause}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
            isPlaying && !isPaused
              ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50'
          )}
          aria-label={isPlaying && !isPaused ? '일시정지' : isPaused ? '재개' : '재생'}
        >
          {isPlaying && !isPaused ? (
            <>
              <Pause className="size-5" />
              <span>일시정지</span>
            </>
          ) : isPaused ? (
            <>
              <Play className="size-5" />
              <span>재개</span>
            </>
          ) : (
            <>
              <Play className="size-5" />
              <span>재생</span>
            </>
          )}
        </button>

        {/* 정지 버튼 */}
        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={handleStop}
            className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            aria-label="정지"
          >
            <Square className="size-5" />
          </button>
        )}

        {/* 속도 조절 */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-zinc-500">속도</span>
          <select
            value={rate}
            onChange={handleRateChange}
            className="h-8 px-2 pr-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {SPEED_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 성우 선택 */}
      {availableVoices.length > 0 && (
        <div className="flex items-center gap-2">
          <Mic className="size-4 text-zinc-400" />
          <span className="text-sm text-zinc-500">성우</span>
          <select
            value={selectedVoice?.name || ''}
            onChange={handleVoiceChange}
            className="flex-1 h-8 px-2 pr-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">자동 (한국어 우선)</option>
            {koreanVoices.length > 0 && (
              <optgroup label="🇰🇷 한국어">
                {koreanVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {getVoiceDisplayName(voice)}
                  </option>
                ))}
              </optgroup>
            )}
            {otherVoices.length > 0 && (
              <optgroup label="🌐 기타 언어">
                {otherVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {getVoiceDisplayName(voice)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* 음성 로드 상태 */}
      {availableVoices.length === 0 && !isFallbackMode && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <span>⏳ 음성을 로드하는 중...</span>
        </div>
      )}

      {/* 한국어 음성 정보 */}
      {koreanVoices.length > 0 && !isPlaying && (
        <div className="text-xs text-zinc-400">
          한국어 음성 {koreanVoices.length}개 사용 가능
        </div>
      )}

      {/* 재생 상태 표시 */}
      {isPlaying && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <div className="flex gap-0.5">
            <span className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <span
              className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
          <span>{isPaused ? '일시정지됨' : isFallbackMode ? '재생 중... (Google TTS)' : '재생 중...'}</span>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* 스크립트 미리보기 (접힌 상태) */}
      <details className="group">
        <summary className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          <span>스크립트 보기</span>
          <span className="text-xs text-zinc-400">({text.length}자)</span>
        </summary>
        <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
          {text.slice(0, 500)}
          {text.length > 500 && '...'}
        </div>
      </details>

      {/* Script Generation Links */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
        {!claudeEnabled && (
          <a
            href={MOONYOU_GUIDE_GEM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            <Sparkles className="size-4" />
            <span>Moonyou Guide Gem으로 스크립트 생성</span>
            <ExternalLink className="size-3" />
          </a>
        )}
        {claudeEnabled && (
          <span className="text-xs text-zinc-400">
            AI 가이드는 상세 화면에서 생성할 수 있습니다
          </span>
        )}
      </div>
    </div>
  )
}
