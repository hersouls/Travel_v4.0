// ============================================
// MusicPlayer Component - 배경 음악 플레이어
// Moonwave 오리지널 음악 재생
// ============================================

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useAudioStore } from '@/stores/audioStore'

const TRACKS = [
  'Decode me slow  (Japanese Ver. Part2).wav',
  'Decode me slow (Chinese Ver.).wav',
  'Decode me slow (Japanese Ver. Part1).wav',
  'Decode me slow (Korean Ver.) (1).wav',
  'Decode me slow (Korean Ver.).wav',
  'Glow Not Noise (1).wav',
  'Glow Not Noise (2).wav',
  'Layback Wave (1).wav',
  'Layback Wave.wav',
  'Light In Me (English Ver. Part1).wav',
  'Light In Me (Korea Ver.).wav',
  'light In Me.wav',
  'Light In Me(Chinese Ver.).wav',
  'Light In Me(Japanese Ver.).wav',
  'Neon Fever (Remastered) (1).wav',
  'Neon Fever (Remastered).wav',
  'Rise so Bright (1).wav',
  'Under the Moonlight (3).wav',
  'Under the Moonlight (2).wav',
  'Under the Moonlight (4).wav',
  'Wabie Sync Part2 (1).wav',
  'Wavecoded Part2 (1).wav',
  'Wavie Sync Part1 (2).wav',
  'Wavie Sync Part1 (1).wav',
].map((name) => `/music/${name}`)

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [volume, setVolume] = useState(0.2)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const currentAudioId = useAudioStore((state) => state.currentAudioId)
  const playAudio = useAudioStore((state) => state.playAudio)
  const stopAudio = useAudioStore((state) => state.stopAudio)

  // 랜덤 트랙으로 초기화
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * TRACKS.length)
    setCurrentTrackIndex(randomIndex)
  }, [])

  // 볼륨 변경 적용
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // 배타적 재생: 다른 오디오(TTS) 재생 시 음악 일시정지
  useEffect(() => {
    if (currentAudioId && currentAudioId !== 'bgm') {
      setIsPlaying(false)
    }
  }, [currentAudioId])

  // 재생 제어
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        // 활성 오디오 소스로 등록
        if (currentAudioId !== 'bgm') {
          playAudio('bgm')
        }

        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            setIsPlaying(false)
          })
        }
      } else {
        audioRef.current.pause()
        // 우리가 소유자일 때만 ID 해제
        if (currentAudioId === 'bgm') {
          stopAudio('bgm')
        }
      }
    }
  }, [isPlaying, currentAudioId, playAudio, stopAudio])

  // 트랙 변경 시 자동 재생
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    }
  }, [currentTrackIndex])

  // 1초 후 자동 재생 (다른 오디오 없을 때)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentAudioId) {
        setIsPlaying(true)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const nextTrack = () => {
    let nextIndex
    do {
      nextIndex = Math.floor(Math.random() * TRACKS.length)
    } while (nextIndex === currentTrackIndex && TRACKS.length > 1)

    setCurrentTrackIndex(nextIndex)
    setIsPlaying(true)
  }

  const handleEnded = () => {
    nextTrack()
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  // 트랙 이름 추출 (파일명에서 확장자 제거)
  const getTrackName = () => {
    const fileName = TRACKS[currentTrackIndex].split('/').pop() || ''
    return fileName.replace('.wav', '')
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg">
      <audio ref={audioRef} src={TRACKS[currentTrackIndex]} onEnded={handleEnded} />

      {/* 재생/일시정지 */}
      <button
        onClick={togglePlay}
        className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label={isPlaying ? '일시정지' : '재생'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* 다음 트랙 */}
      <button
        onClick={nextTrack}
        className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label="다음 트랙"
      >
        <SkipForward size={14} />
      </button>

      {/* 볼륨 컨트롤 */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          aria-label={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number.parseFloat(e.target.value))
            setIsMuted(false)
          }}
          className="w-16 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-primary-600"
          aria-label="볼륨"
        />
      </div>

      {/* 트랙 이름 */}
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 max-w-[100px] truncate select-none">
        {getTrackName()}
      </div>
    </div>
  )
}
