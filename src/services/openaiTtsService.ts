// ============================================
// OpenAI TTS Service
// High-quality TTS via OpenAI API + HTML5 Audio
// ============================================

type ProgressCallback = (progress: number) => void
type VoidCallback = () => void

export interface OpenAITTSOptions {
  text: string
  model: 'tts-1' | 'tts-1-hd'
  voice: string
  apiKey: string
  onProgress?: ProgressCallback
}

class OpenAITTSService {
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private _isGenerating = false
  private _rate = 1.0
  private timeUpdateCallbacks: VoidCallback[] = []
  private endedCallbacks: VoidCallback[] = []

  get isGenerating(): boolean {
    return this._isGenerating
  }

  get isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused && !this.audio.ended
  }

  get isPaused(): boolean {
    return this.audio !== null && this.audio.paused && !this.audio.ended
  }

  get currentTime(): number {
    return this.audio?.currentTime ?? 0
  }

  get duration(): number {
    return this.audio?.duration ?? 0
  }

  get progress(): number {
    if (!this.audio || !this.audio.duration || isNaN(this.audio.duration)) return 0
    return this.audio.currentTime / this.audio.duration
  }

  async generate(options: OpenAITTSOptions): Promise<void> {
    // Clean up previous audio
    this.dispose()
    this._isGenerating = true

    try {
      const response = await fetch('/api/openai-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': options.apiKey,
        },
        body: JSON.stringify({
          text: options.text,
          model: options.model,
          voice: options.voice,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `TTS 생성 실패 (${response.status})`)
      }

      const blob = await response.blob()
      this.objectUrl = URL.createObjectURL(blob)
      this.audio = new Audio(this.objectUrl)
      this.audio.playbackRate = this._rate

      // Wire up event listeners
      this.audio.ontimeupdate = () => {
        this.timeUpdateCallbacks.forEach(cb => cb())
      }
      this.audio.onended = () => {
        this.endedCallbacks.forEach(cb => cb())
      }

      this._isGenerating = false

      // Auto-play
      await this.audio.play()
    } catch (error) {
      this._isGenerating = false
      throw error
    }
  }

  play(): void {
    this.audio?.play()
  }

  pause(): void {
    this.audio?.pause()
  }

  resume(): void {
    this.audio?.play()
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
    }
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time
    }
  }

  seekByPercentage(percentage: number): void {
    if (this.audio && this.audio.duration && !isNaN(this.audio.duration)) {
      this.audio.currentTime = this.audio.duration * Math.max(0, Math.min(1, percentage))
    }
  }

  setRate(rate: number): void {
    this._rate = rate
    if (this.audio) {
      this.audio.playbackRate = rate
    }
  }

  onTimeUpdate(callback: VoidCallback): VoidCallback {
    this.timeUpdateCallbacks.push(callback)
    return () => {
      this.timeUpdateCallbacks = this.timeUpdateCallbacks.filter(cb => cb !== callback)
    }
  }

  onEnded(callback: VoidCallback): VoidCallback {
    this.endedCallbacks.push(callback)
    return () => {
      this.endedCallbacks = this.endedCallbacks.filter(cb => cb !== callback)
    }
  }

  hasAudio(): boolean {
    return this.audio !== null && this.objectUrl !== null
  }

  dispose(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.ontimeupdate = null
      this.audio.onended = null
      this.audio = null
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
    this._isGenerating = false
  }
}

export const openaiTtsService = new OpenAITTSService()

export async function testOpenAIConnection(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    return response.ok
  } catch (error) {
    console.error('OpenAI Connection Test Failed:', error)
    return false
  }
}
