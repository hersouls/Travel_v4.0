// ============================================
// TTS Service (Text-to-Speech)
// Web Speech API + Google Translate TTS Fallback
// ============================================

export interface TTSOptions {
  rate?: number // 0.5 - 2.0, default 1.0
  pitch?: number // 0.0 - 2.0, default 1.0
  volume?: number // 0.0 - 1.0, default 1.0
  voice?: SpeechSynthesisVoice
}

export interface TTSCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
  onPause?: () => void
  onResume?: () => void
  onBoundary?: (charIndex: number) => void
}

class TTSService {
  private synth: SpeechSynthesis | null = null
  private voices: SpeechSynthesisVoice[] = []
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private voicesLoaded = false

  // Fallback 관련
  private useFallback = false
  private audioElement: HTMLAudioElement | null = null
  private audioChunks: string[] = []
  private currentChunkIndex = 0
  private isPlayingFallback = false
  private isPausedFallback = false
  private fallbackRate = 1.0
  private callbacks: TTSCallbacks = {}
  private chunkTimeout: ReturnType<typeof setTimeout> | null = null
  private playedTextLength = 0 // Fallback 재생 시 누적 텍스트 길이

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis
      this.loadVoices()

      // 음성 목록이 비동기로 로드되는 경우 처리
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices()
      }
    }
  }

  private loadVoices(): void {
    if (this.synth) {
      this.voices = this.synth.getVoices()
      this.voicesLoaded = this.voices.length > 0
      console.log('[TTS] Voices loaded:', this.voices.length)
    }
  }

  /**
   * TTS 지원 여부 확인 (Web Speech API 또는 Fallback)
   */
  isSupported(): boolean {
    // Web Speech API가 없어도 Google TTS fallback 사용 가능
    return true
  }

  /**
   * 사용 가능한 모든 음성 목록 반환
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.voicesLoaded && this.synth) {
      this.loadVoices()
    }
    return this.voices
  }

  /**
   * 한국어 음성 목록 반환
   */
  getKoreanVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(
      (voice) => voice.lang.startsWith('ko') || voice.lang.includes('Korean')
    )
  }

  /**
   * 선호하는 남자 목소리 선택
   */
  getPreferredMaleVoice(): SpeechSynthesisVoice | null {
    const koreanVoices = this.getKoreanVoices()

    const koreanMale = koreanVoices.find(
      (voice) =>
        voice.name.toLowerCase().includes('male') ||
        voice.name.includes('남성') ||
        voice.name.toLowerCase().includes('man') ||
        (voice.name.includes('Google') && voice.name.includes('한국어')) ||
        voice.name.includes('InJoon')
    )
    if (koreanMale) return koreanMale

    if (koreanVoices.length > 0) {
      return koreanVoices[0]
    }

    const defaultVoice = this.voices.find((voice) => voice.default)
    return defaultVoice || this.voices[0] || null
  }

  /**
   * 텍스트를 청크로 분할 (Google TTS용)
   */
  private splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = []
    // 문장 단위로 분할
    const sentences = text.split(/(?<=[.!?。！？\n])\s*/)

    let current = ''
    for (const sentence of sentences) {
      if ((current + sentence).length > maxLength) {
        if (current) chunks.push(current.trim())
        // 문장 자체가 maxLength보다 길면 강제 분할
        if (sentence.length > maxLength) {
          const words = sentence.split(/\s+/)
          let wordChunk = ''
          for (const word of words) {
            if ((wordChunk + ' ' + word).length > maxLength) {
              if (wordChunk) chunks.push(wordChunk.trim())
              wordChunk = word
            } else {
              wordChunk += (wordChunk ? ' ' : '') + word
            }
          }
          current = wordChunk
        } else {
          current = sentence
        }
      } else {
        current += (current ? ' ' : '') + sentence
      }
    }
    if (current) chunks.push(current.trim())

    return chunks.filter(c => c.length > 0)
  }

  /**
   * Google Translate TTS로 재생
   */
  private playWithGoogleTTS(text: string, callbacks: TTSCallbacks = {}): void {
    console.log('[TTS] Using Google Translate TTS fallback')
    this.callbacks = callbacks
    this.audioChunks = this.splitText(text, 200)
    this.currentChunkIndex = 0
    this.isPlayingFallback = true
    this.isPausedFallback = false
    this.playedTextLength = 0

    console.log('[TTS] Text split into', this.audioChunks.length, 'chunks')

    callbacks.onStart?.()
    this.playNextChunk()
  }

  private playNextChunk(): void {
    // 이전 타임아웃 클리어
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout)
      this.chunkTimeout = null
    }

    if (this.currentChunkIndex >= this.audioChunks.length) {
      console.log('[TTS] All chunks played')
      this.isPlayingFallback = false
      this.callbacks.onEnd?.()
      return
    }

    if (this.isPausedFallback) {
      return
    }

    const chunk = this.audioChunks[this.currentChunkIndex]
    // 프록시 URL 사용 (CORS 해결)
    const url = `/api/tts?text=${encodeURIComponent(chunk)}&lang=ko`

    console.log('[TTS] Playing chunk', this.currentChunkIndex + 1, '/', this.audioChunks.length)

    this.audioElement = new Audio(url)

    // 10초 타임아웃 - 청크 재생 실패 감지
    this.chunkTimeout = setTimeout(() => {
      console.error('[TTS] Chunk timeout - audio failed to load')
      this.isPlayingFallback = false
      this.callbacks.onError?.('음성 로드 시간 초과')
    }, 10000)

    // canplay 이벤트에서 playbackRate 설정 (로드 전 설정은 무시됨)
    this.audioElement.oncanplay = () => {
      if (this.audioElement) {
        this.audioElement.playbackRate = this.fallbackRate
        console.log('[TTS] playbackRate set to', this.fallbackRate)
      }
    }

    // 시간 업데이트 - Fallback 진행률 근사치 계산
    this.audioElement.ontimeupdate = () => {
      if (this.audioElement && this.callbacks.onBoundary) {
        const duration = this.audioElement.duration
        const currentTime = this.audioElement.currentTime
        if (duration > 0) {
          const chunkProgress = currentTime / duration
          const charIndex = this.playedTextLength + Math.floor(chunk.length * chunkProgress)
          this.callbacks.onBoundary(charIndex)
        }
      }
    }

    this.audioElement.onended = () => {
      if (this.chunkTimeout) {
        clearTimeout(this.chunkTimeout)
        this.chunkTimeout = null
      }
      this.playedTextLength += chunk.length + 1 // +1 for space/separator
      this.currentChunkIndex++
      this.playNextChunk()
    }

    this.audioElement.onerror = (e) => {
      if (this.chunkTimeout) {
        clearTimeout(this.chunkTimeout)
        this.chunkTimeout = null
      }
      console.error('[TTS] Google TTS audio error:', e)
      this.isPlayingFallback = false
      this.callbacks.onError?.('음성 재생 실패')
    }

    this.audioElement.play().catch((err) => {
      if (this.chunkTimeout) {
        clearTimeout(this.chunkTimeout)
        this.chunkTimeout = null
      }
      console.error('[TTS] Google TTS play error:', err)
      this.isPlayingFallback = false
      this.callbacks.onError?.('음성 재생 실패')
    })
  }

  /**
   * Web Speech API로 재생 시도, 실패 시 Google TTS fallback
   */
  speak(text: string, options: TTSOptions = {}, callbacks: TTSCallbacks = {}): void {
    console.log('[TTS] speak() called, text length:', text.length)

    if (!text) {
      console.error('[TTS] No text provided')
      callbacks.onError?.('텍스트가 없습니다')
      return
    }

    // 기존 재생 중지
    this.stop()

    this.fallbackRate = options.rate ?? 1.0

    // Web Speech API가 없거나 음성이 없으면 바로 fallback
    if (!this.synth || this.voices.length === 0 || this.useFallback) {
      console.log('[TTS] Using fallback directly (synth:', !!this.synth, ', voices:', this.voices.length, ', useFallback:', this.useFallback, ')')
      this.playWithGoogleTTS(text, callbacks)
      return
    }

    // Web Speech API 시도
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options.rate ?? 1.0
    utterance.pitch = options.pitch ?? 1.0
    utterance.volume = options.volume ?? 1.0

    const voice = options.voice ?? this.getPreferredMaleVoice()
    console.log('[TTS] Selected voice:', voice?.name ?? 'none')

    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'ko-KR'
    }

    // 3초 타임아웃 - onstart가 안 오면 fallback으로 전환
    const timeout = setTimeout(() => {
      console.log('[TTS] Timeout - switching to fallback')
      this.useFallback = true
      this.synth?.cancel()
      this.playWithGoogleTTS(text, callbacks)
    }, 3000)

    utterance.onstart = () => {
      console.log('[TTS] Web Speech API started')
      clearTimeout(timeout)
      callbacks.onStart?.()
    }

    utterance.onend = () => {
      console.log('[TTS] Web Speech API ended')
      clearTimeout(timeout)
      callbacks.onEnd?.()
    }

    utterance.onerror = (event) => {
      console.error('[TTS] Web Speech API error:', event.error)
      clearTimeout(timeout)
      // 에러 시 fallback으로 전환
      this.useFallback = true
      this.playWithGoogleTTS(text, callbacks)
    }

    utterance.onpause = () => {
      callbacks.onPause?.()
    }

    utterance.onresume = () => {
      callbacks.onResume?.()
    }

    utterance.onboundary = (event) => {
      if (event.charIndex !== undefined) {
        callbacks.onBoundary?.(event.charIndex)
      }
    }

    this.currentUtterance = utterance
    this.synth.speak(utterance)
    console.log('[TTS] synth.speak() called')
  }

  /**
   * 일시정지
   */
  pause(): void {
    if (this.isPlayingFallback) {
      this.isPausedFallback = true
      this.audioElement?.pause()
      this.callbacks.onPause?.()
    } else if (this.synth && this.synth.speaking) {
      this.synth.pause()
    }
  }

  /**
   * 재개
   */
  resume(): void {
    if (this.isPlayingFallback && this.isPausedFallback) {
      this.isPausedFallback = false
      if (this.audioElement?.paused) {
        this.audioElement.play()
      } else {
        this.playNextChunk()
      }
      this.callbacks.onResume?.()
    } else if (this.synth && this.synth.paused) {
      this.synth.resume()
    }
  }

  /**
   * 정지
   */
  stop(): void {
    // 타임아웃 클리어
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout)
      this.chunkTimeout = null
    }

    // Web Speech API 정지
    if (this.synth) {
      this.synth.cancel()
      this.currentUtterance = null
    }

    // Fallback 정지
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
      this.audioElement = null
    }
    this.isPlayingFallback = false
    this.isPausedFallback = false
    this.audioChunks = []
    this.currentChunkIndex = 0
  }

  /**
   * Fallback 모드 리셋 (Web Speech API 재시도 가능하게)
   */
  resetFallback(): void {
    this.useFallback = false
    console.log('[TTS] Fallback mode reset')
  }

  /**
   * 재생 속도 변경 (재생 중에도 적용)
   */
  setRate(rate: number): void {
    this.fallbackRate = rate
    // 현재 재생 중인 오디오에도 즉시 적용
    if (this.audioElement) {
      this.audioElement.playbackRate = rate
      console.log('[TTS] playbackRate updated to', rate)
    }
  }

  /**
   * 현재 재생 중인지 확인
   */
  isSpeaking(): boolean {
    return this.isPlayingFallback || (this.synth?.speaking ?? false)
  }

  /**
   * 일시정지 상태인지 확인
   */
  isPaused(): boolean {
    return this.isPausedFallback || (this.synth?.paused ?? false)
  }

  /**
   * Fallback 모드인지 확인
   */
  isFallbackMode(): boolean {
    return this.useFallback || this.isPlayingFallback
  }

  /**
   * 현재 utterance 반환
   */
  getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance
  }
}

// 싱글톤 인스턴스 export
export const ttsService = new TTSService()
