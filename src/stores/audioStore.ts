// ============================================
// Audio Store - 오디오 배타적 재생 제어
// TTS와 배경음악이 동시에 재생되지 않도록 관리
// ============================================

import { create } from 'zustand'

interface AudioState {
  currentAudioId: string | null  // 'bgm' | 'tts' | null
  playAudio: (id: string) => void
  stopAudio: (id?: string) => void
}

export const useAudioStore = create<AudioState>((set, get) => ({
  currentAudioId: null,

  playAudio: (id) => set({ currentAudioId: id }),

  stopAudio: (id) => {
    const { currentAudioId } = get()
    // ID가 제공되지 않거나 현재 재생 중인 ID와 일치하면 정지
    if (!id || id === currentAudioId) {
      set({ currentAudioId: null })
    }
  },
}))
