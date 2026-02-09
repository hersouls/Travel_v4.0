// ============================================
// useTTS Hook - TTS 상태 관리
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { ttsService, type TTSOptions } from '@/services/ttsService'
import { useAudioStore } from '@/stores/audioStore'

interface UseTTSReturn {
  // 상태
  isSupported: boolean
  isPlaying: boolean
  isPaused: boolean
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
  const [rate, setRateState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(RATE_STORAGE_KEY)
      return saved ? parseFloat(saved) : 1.0
    }
    return 1.0
  })
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [currentText, setCurrentText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isFallbackMode, setIsFallbackMode] = useState(false)

  // Progress control
  const [progress, setProgress] = useState(0)
  const [startOffset, setStartOffset] = useState(0)
  const [fullText, setFullText] = useState('')

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
      ttsService.stop()
    }
  }, [])

  // rate 변경 시 저장
  useEffect(() => {
    localStorage.setItem(RATE_STORAGE_KEY, rate.toString())
  }, [rate])

  // 상태 동기화를 위한 폴링
  useEffect(() => {
    if (!isSupported) return

    const interval = setInterval(() => {
      const speaking = ttsService.isSpeaking()
      const paused = ttsService.isPaused()

      // 상태가 변경되었을 때만 업데이트 (불필요한 렌더링 방지)
      if (isPlaying !== (speaking && !paused)) setIsPlaying(speaking && !paused)
      if (isPaused !== paused) setIsPaused(paused)

      const newFallbackMode = ttsService.isFallbackMode()
      if (isFallbackMode !== newFallbackMode) setIsFallbackMode(newFallbackMode)
    }, 250)

    return () => clearInterval(interval)
  }, [isSupported, isPlaying, isPaused, isFallbackMode])

  const play = useCallback(
    (text: string, voice?: SpeechSynthesisVoice | null, offset: number = 0) => {
      if (!text) return

      setError(null)
      setCurrentText(text)

      // 처음 재생하는 경우 fullText 설정
      if (offset === 0) {
        setFullText(text)
        setStartOffset(0)
        setProgress(0)
      } else {
        setStartOffset(offset)
      }

      // 배타적 재생: TTS 시작 시 다른 오디오(음악) 정지
      useAudioStore.getState().playAudio('tts')

      const options: TTSOptions = {
        rate,
        voice: (voice !== undefined ? voice : selectedVoice) ?? undefined
      }

      ttsService.speak(text, options, {
        onStart: () => {
          console.log('[useTTS] onStart')
          setIsPlaying(true)
          setIsPaused(false)
        },
        onEnd: () => {
          console.log('[useTTS] onEnd')
          setIsPlaying(false)
          setIsPaused(false)
          // onEnd doesn't necessarily mean finished if seeking, but seek calls play again.
          // If we finished naturally:
          if (offset === 0 && text.length === fullText.length) {
            setProgress(1)
            setCurrentText('')
            useAudioStore.getState().stopAudio('tts')
          } else {
            // Sliced text finished
            setProgress(1)
            setCurrentText('')
            useAudioStore.getState().stopAudio('tts')
          }
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
          const newProgress = Math.min(1, globalIndex / Math.max(1, fullText.length || text.length + offset))
          setProgress(newProgress)
        }
      })
    },
    [rate, selectedVoice, fullText] // fullText dependency added
  )

  const seek = useCallback((percentage: number) => {
    if (!fullText) return

    // Calculate new index
    const targetIndex = Math.floor(fullText.length * Math.min(0.99, Math.max(0, percentage)))

    // Update progress immediately for UI responsiveness
    setProgress(percentage)
    setStartOffset(targetIndex)

    // Stop current
    ttsService.stop()

    // Play from new position
    const textToPlay = fullText.slice(targetIndex)

    // Use setTimeout to ensure stop completes and UI updates
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

      // 재생 중이면 새 voice로 restart (현재 위치부터)
      // restartWithText가 제공되면 그것을 사용 (보통 fullText일 것임)
      const textToUse = restartWithText || fullText || currentText

      if ((ttsService.isSpeaking() || ttsService.isPaused()) && textToUse) {
        ttsService.stop()

        // 현재 위치 유지 (startOffset)
        // 하지만 fullText 기준 이어야 함.
        const currentSlice = textToUse.slice(startOffset)

        setTimeout(() => {
          play(currentSlice, voice, startOffset)
        }, 50)
      }
    },
    [fullText, currentText, play, startOffset]
  )


  const pause = useCallback(() => {
    ttsService.pause()
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    ttsService.resume()
    setIsPaused(false)
  }, [])

  const stop = useCallback(() => {
    ttsService.stop()
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentText('')
    setError(null)
    setProgress(0)
    setStartOffset(0)
    useAudioStore.getState().stopAudio('tts')
  }, [])

  const togglePlayPause = useCallback(
    (text: string) => {
      if (isPlaying && !isPaused) {
        pause()
      } else if (isPaused) {
        resume()
      } else {
        // New play
        setFullText(text) // Ensure full text is set
        play(text, null, 0)
      }
    },
    [isPlaying, isPaused, pause, resume, play]
  )

  const setRate = useCallback((newRate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, newRate))
    setRateState(clampedRate)
    // 재생 중인 오디오에도 즉시 적용
    ttsService.setRate(clampedRate)
  }, [])

  return {
    isSupported,
    isPlaying,
    isPaused,
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
