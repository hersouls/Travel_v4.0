// ============================================
// useTTS Hook - TTS 상태 관리
// OpenAI TTS (API key 있을 때) / Browser TTS (fallback)
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { ttsService, type TTSOptions } from '@/services/ttsService'
import { openaiTtsService } from '@/services/openaiTtsService'
import { useAudioStore } from '@/stores/audioStore'
import { useSettingsStore } from '@/stores/settingsStore'

export type TTSMode = 'openai' | 'browser'

interface UseTTSReturn {
  // 상태
  isSupported: boolean
  isPlaying: boolean
  isPaused: boolean
  isGenerating: boolean
  ttsMode: TTSMode
  rate: number
  availableVoices: SpeechSynthesisVoice[]
  selectedVoice: SpeechSynthesisVoice | null
  currentText: string
  error: string | null
  isFallbackMode: boolean
  progress: number

  // 액션
  play: (text: string, voice?: SpeechSynthesisVoice | null, offset?: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
  togglePlayPause: (text: string) => void
  setRate: (rate: number) => void
  setVoice: (voice: SpeechSynthesisVoice | null, restartWithText?: string) => void
  seek: (percentage: number) => void
}

const RATE_STORAGE_KEY = 'tts-rate-preference'
const VOICE_STORAGE_KEY = 'tts-voice-preference'

export function useTTS(): UseTTSReturn {
  const [isSupported, setIsSupported] = useState(true) // Always true due to fallback
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [rate, setRateState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(RATE_STORAGE_KEY)
      return saved ? parseFloat(saved) : 1.0
    }
    return 1.0
  })
  // 항상 최신 rate를 가리키는 ref — play()가 동기적으로 호출될 때 stale closure를 피한다
  const rateRef = useRef(rate)
  rateRef.current = rate
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [currentText, setCurrentText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isFallbackMode, setIsFallbackMode] = useState(false)

  // Progress control
  const [progress, setProgress] = useState(0)
  const [startOffset, setStartOffset] = useState(0)
  const [fullText, setFullText] = useState('')
  // 동기 호출되는 onBoundary가 최신 전체 텍스트 길이를 읽도록 ref 병행 (stale 분모 방지)
  const fullTextRef = useRef('')

  // Track which mode is active for current playback
  const activeModeRef = useRef<TTSMode>('browser')

  // OpenAI settings from store
  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey)
  const openaiTtsModel = useSettingsStore((s) => s.openaiTtsModel) || 'tts-1'
  const openaiTtsVoice = useSettingsStore((s) => s.openaiTtsVoice) || 'alloy'

  const ttsMode: TTSMode = openaiApiKey ? 'openai' : 'browser'

  // 초기화
  useEffect(() => {
    setIsSupported(ttsService.isSupported())

    // 음성 로드 (비동기 처리)
    const loadVoices = () => {
      const voices = ttsService.getAvailableVoices()
      setAvailableVoices(voices)

      // 저장된 음성 복원
      const savedVoiceName = localStorage.getItem(VOICE_STORAGE_KEY)
      if (savedVoiceName) {
        const savedVoice = voices.find((v) => v.name === savedVoiceName)
        if (savedVoice) {
          setSelectedVoice(savedVoice)
        }
      }
    }

    loadVoices()

    // 음성이 비동기로 로드되는 경우
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      // 공유 싱글톤은 이 훅이 활성 재생 소유자일 때만 정리한다.
      // (다른 마운트된 player가 재생 중인 OpenAI 오디오를 idle 훅이 dispose하는 것을 방지)
      if (activeModeRef.current === 'openai') {
        openaiTtsService.dispose()
      } else {
        ttsService.stop()
      }
    }
  }, [])

  // rate 변경 시 저장
  useEffect(() => {
    localStorage.setItem(RATE_STORAGE_KEY, rate.toString())
  }, [rate])

  // OpenAI TTS event listeners
  useEffect(() => {
    const unsubTime = openaiTtsService.onTimeUpdate(() => {
      if (activeModeRef.current === 'openai') {
        setProgress(openaiTtsService.progress)
        if (openaiTtsService.isPlaying) {
          setIsPlaying(true)
          setIsPaused(false)
        }
      }
    })

    const unsubEnd = openaiTtsService.onEnded(() => {
      if (activeModeRef.current === 'openai') {
        setIsPlaying(false)
        setIsPaused(false)
        setProgress(1)
        setCurrentText('')
        useAudioStore.getState().stopAudio('tts')
      }
    })

    return () => {
      unsubTime()
      unsubEnd()
    }
  }, [])

  // 상태 동기화를 위한 폴링 (browser mode only)
  useEffect(() => {
    if (!isSupported) return

    const interval = setInterval(() => {
      if (activeModeRef.current === 'browser') {
        const speaking = ttsService.isSpeaking()
        const paused = ttsService.isPaused()

        if (isPlaying !== (speaking && !paused)) setIsPlaying(speaking && !paused)
        if (isPaused !== paused) setIsPaused(paused)

        const newFallbackMode = ttsService.isFallbackMode()
        if (isFallbackMode !== newFallbackMode) setIsFallbackMode(newFallbackMode)
      } else if (activeModeRef.current === 'openai') {
        // Sync pause state for OpenAI mode
        const playing = openaiTtsService.isPlaying
        const paused = openaiTtsService.isPaused
        if (isPlaying !== playing) setIsPlaying(playing)
        if (isPaused !== paused) setIsPaused(paused)
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isSupported, isPlaying, isPaused, isFallbackMode])

  const play = useCallback(
    (text: string, voice?: SpeechSynthesisVoice | null, offset: number = 0) => {
      if (!text) return

      setError(null)
      setCurrentText(text)

      if (ttsMode === 'openai' && offset === 0) {
        // OpenAI TTS mode
        activeModeRef.current = 'openai'

        // Stop any browser TTS
        ttsService.stop()

        fullTextRef.current = text
        setFullText(text)
        setStartOffset(0)
        setProgress(0)
        setIsGenerating(true)

        // 배타적 재생
        useAudioStore.getState().playAudio('tts')

        openaiTtsService.setRate(rateRef.current)
        openaiTtsService.generate({
          text,
          model: openaiTtsModel as 'tts-1' | 'tts-1-hd',
          voice: openaiTtsVoice,
          apiKey: openaiApiKey!,
        }).then(() => {
          setIsGenerating(false)
          setIsPlaying(true)
          setIsPaused(false)
        }).catch((err) => {
          setIsGenerating(false)
          setIsPlaying(false)
          setError(err instanceof Error ? err.message : 'TTS 생성 실패')
          useAudioStore.getState().stopAudio('tts')
        })

        return
      }

      // Browser TTS mode (or seeking in openai mode not supported, fall through)
      activeModeRef.current = 'browser'

      // 처음 재생하는 경우 fullText 설정
      if (offset === 0) {
        fullTextRef.current = text
        setFullText(text)
        setStartOffset(0)
        setProgress(0)
      } else {
        setStartOffset(offset)
      }

      // 배타적 재생: TTS 시작 시 다른 오디오(음악) 정지
      useAudioStore.getState().playAudio('tts')

      const options: TTSOptions = {
        rate: rateRef.current,
        voice: (voice !== undefined ? voice : selectedVoice) ?? undefined
      }

      ttsService.speak(text, options, {
        onStart: () => {
          setIsPlaying(true)
          setIsPaused(false)
        },
        onEnd: () => {
          setIsPlaying(false)
          setIsPaused(false)
          setProgress(1)
          setCurrentText('')
          useAudioStore.getState().stopAudio('tts')
        },
        onError: (err) => {
          console.error('[useTTS] onError:', err)
          setError(err)
          setIsPlaying(false)
          setIsPaused(false)
          setCurrentText('')
          useAudioStore.getState().stopAudio('tts')
        },
        onPause: () => {
          setIsPaused(true)
        },
        onResume: () => {
          setIsPaused(false)
        },
        onBoundary: (charIndex) => {
          const globalIndex = offset + charIndex
          const newProgress = Math.min(1, globalIndex / Math.max(1, fullTextRef.current.length || text.length + offset))
          setProgress(newProgress)
        }
      })
    },
    [selectedVoice, ttsMode, openaiApiKey, openaiTtsModel, openaiTtsVoice]
  )

  const seek = useCallback((percentage: number) => {
    if (activeModeRef.current === 'openai' && openaiTtsService.hasAudio()) {
      openaiTtsService.seekByPercentage(percentage)
      setProgress(percentage)
      return
    }

    if (!fullText) return

    // Browser TTS seek (character-based)
    const targetIndex = Math.floor(fullText.length * Math.min(0.99, Math.max(0, percentage)))
    setProgress(percentage)
    setStartOffset(targetIndex)
    ttsService.stop()

    const textToPlay = fullText.slice(targetIndex)
    setTimeout(() => {
      play(textToPlay, selectedVoice, targetIndex)
    }, 10)
  }, [fullText, play, selectedVoice])


  const setVoice = useCallback(
    (voice: SpeechSynthesisVoice | null, restartWithText?: string) => {
      setSelectedVoice(voice)
      if (voice) {
        localStorage.setItem(VOICE_STORAGE_KEY, voice.name)
      } else {
        localStorage.removeItem(VOICE_STORAGE_KEY)
      }

      // Only restart for browser mode
      if (activeModeRef.current !== 'browser') return

      const textToUse = restartWithText || fullText || currentText
      if ((ttsService.isSpeaking() || ttsService.isPaused()) && textToUse) {
        ttsService.stop()
        const currentSlice = textToUse.slice(startOffset)
        setTimeout(() => {
          play(currentSlice, voice, startOffset)
        }, 50)
      }
    },
    [fullText, currentText, play, startOffset]
  )


  const pause = useCallback(() => {
    if (activeModeRef.current === 'openai') {
      openaiTtsService.pause()
    } else {
      ttsService.pause()
    }
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    if (activeModeRef.current === 'openai') {
      openaiTtsService.resume()
    } else {
      ttsService.resume()
    }
    setIsPaused(false)
  }, [])

  const stop = useCallback(() => {
    if (activeModeRef.current === 'openai') {
      openaiTtsService.stop()
    }
    ttsService.stop()
    setIsPlaying(false)
    setIsPaused(false)
    setIsGenerating(false)
    setCurrentText('')
    setError(null)
    setProgress(0)
    setStartOffset(0)
    useAudioStore.getState().stopAudio('tts')
  }, [])

  const togglePlayPause = useCallback(
    (text: string) => {
      if (isGenerating) return // Don't toggle while generating

      if (isPlaying && !isPaused) {
        pause()
      } else if (isPaused) {
        resume()
      } else {
        // New play
        fullTextRef.current = text
        setFullText(text)
        play(text, null, 0)
      }
    },
    [isPlaying, isPaused, isGenerating, pause, resume, play]
  )

  const setRate = useCallback((newRate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, newRate))
    rateRef.current = clampedRate // 동기 재시작이 새 rate를 쓰도록 즉시 갱신
    setRateState(clampedRate)
    if (activeModeRef.current === 'openai') {
      openaiTtsService.setRate(clampedRate)
      return
    }
    ttsService.setRate(clampedRate)
    // Web Speech(SpeechSynthesisUtterance.rate)는 재생 중 변경 불가 → 현재 offset에서 재시작해 적용.
    // Google fallback(audioElement)은 playbackRate가 즉시 반영되므로 재시작 불필요.
    if (
      activeModeRef.current === 'browser' &&
      !ttsService.isFallbackMode() &&
      (ttsService.isSpeaking() || ttsService.isPaused())
    ) {
      const textToUse = fullText || currentText
      if (textToUse) {
        ttsService.stop()
        const currentSlice = textToUse.slice(startOffset)
        setTimeout(() => {
          play(currentSlice, selectedVoice, startOffset)
        }, 50)
      }
    }
  }, [fullText, currentText, play, startOffset, selectedVoice])

  return {
    isSupported,
    isPlaying,
    isPaused,
    isGenerating,
    ttsMode,
    rate,
    availableVoices,
    selectedVoice,
    currentText,
    error,
    isFallbackMode,
    progress,
    play,
    pause,
    resume,
    stop,
    togglePlayPause,
    setRate,
    setVoice,
    seek,
  }
}
