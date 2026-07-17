// ============================================
// MusicPlayer Component - 배경 음악 플레이어
// Moonwave 오리지널 음악 재생
// ============================================

import { useAudioStore } from '@/stores/audioStore'
import { ChevronDown, Music2, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const MUSIC_BASE_URL = import.meta.env.VITE_MUSIC_CDN_URL || '/music'

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
].map((name) => `${MUSIC_BASE_URL}/${encodeURIComponent(name)}`)

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [volume, setVolume] = useState(0.2)
  const [isMuted, setIsMuted] = useState(false)
  // 좁은 화면(갤럭시 폴드 커버 등)에서 와이드 바가 하단 콘텐츠를 가리지 않도록
  // 모바일은 컴팩트 필로 접어두고, 데스크톱(lg+)은 전체 바를 펼쳐 시작
  const [isExpanded, setIsExpanded] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  const audioRef = useRef<HTMLAudioElement>(null)
  // 배타 재생 양보 전 재생 의도를 기억 (TTS 종료 후 BGM 재개용)
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying
  const wasPlayingBeforeExclusive = useRef(false)

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

  // 배타적 재생: 다른 오디오(TTS) 재생 시 음악 일시정지, 종료 시 재개
  useEffect(() => {
    if (currentAudioId && currentAudioId !== 'bgm') {
      // 다른 소스(TTS)가 점유 → 현재 재생 의도를 기억하고 양보
      wasPlayingBeforeExclusive.current = isPlayingRef.current
      setIsPlaying(false)
    } else if (currentAudioId === null && wasPlayingBeforeExclusive.current) {
      // 배타 소스 해제 → 이전에 재생 중이었으면 BGM 재개
      wasPlayingBeforeExclusive.current = false
      setIsPlaying(true)
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
      // 마운트 시점의 stale 값이 아닌 라이브 store 값을 읽어, 1초 내 다른 오디오가 시작된 경우 충돌 방지
      if (!useAudioStore.getState().currentAudioId) {
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
    // URL-인코딩된 파일명(%20 등)을 디코드하고 끝의 .wav만 제거
    return decodeURIComponent(fileName).replace(/\.wav$/, '')
  }

  // 오디오 엘리먼트는 접힘/펼침 상태와 무관하게 항상 마운트 유지 (재생 연속성)
  const audioEl = <audio ref={audioRef} src={TRACKS[currentTrackIndex]} onEnded={handleEnded} />

  // 접힌 상태(모바일 기본) — 재생/일시정지 + 펼치기만 있는 컴팩트 필
  if (!isExpanded) {
    return (
      <div className="flex items-center gap-0.5 p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg">
        {audioEl}
        <button
          type="button"
          onClick={togglePlay}
          className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          aria-label={isPlaying ? '음악 일시정지' : '음악 재생'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          aria-label="음악 플레이어 펼치기"
        >
          <Music2 size={16} className={isPlaying ? 'text-primary-600 dark:text-primary-400' : ''} />
        </button>
      </div>
    )
  }

  // 펼친 상태 — 전체 컨트롤
  return (
    <div className="flex items-center gap-1.5 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg">
      {audioEl}

      {/* 재생/일시정지 */}
      <button
        type="button"
        onClick={togglePlay}
        className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label={isPlaying ? '일시정지' : '재생'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* 다음 트랙 */}
      <button
        type="button"
        onClick={nextTrack}
        className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label="다음 트랙"
      >
        <SkipForward size={14} />
      </button>

      {/* 볼륨 컨트롤 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
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
          className="w-14 sm:w-16 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-primary-600"
          aria-label="볼륨"
        />
      </div>

      {/* 트랙 이름 */}
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 max-w-[72px] sm:max-w-[100px] truncate select-none">
        {getTrackName()}
      </div>

      {/* 접기 */}
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label="음악 플레이어 접기"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
