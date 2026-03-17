import { useState, useEffect, useRef } from 'react'
import { Sun, Moon, Monitor, Download, Upload, Trash2, Database, Palette, HardDrive, Shield, FileJson, Music, Map, Sparkles, Eye, EyeOff, Settings as SettingsIcon, Volume2, Smartphone } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { PageContainer } from '@/components/layout'
import { TimezoneSettings } from '@/components/timezone'
import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore, useTheme, useColorPalette, useMusicPlayerEnabled } from '@/stores/settingsStore'
import { toast } from '@/stores/uiStore'
import { exportAllData, importAllData, clearAllData, validateBackupData, type BackupData } from '@/services/database'
import { testConnection } from '@/services/claudeService'
import { testOpenAIConnection } from '@/services/openaiTtsService'
import { APP_VERSION, COLOR_PALETTES, SCHEMA_VERSION, TRAVEL_MODE_LABELS } from '@/utils/constants'
import { DEFAULT_SETTINGS } from '@/types'
import { getStorageInfo, formatBytes, requestPersistentStorage, type StorageInfo } from '@/services/storageQuota'
import type { ThemeMode, ColorPalette, MapProvider, TravelMode, ClaudeModel, GeminiModel, AIProvider, AIKeyMode } from '@/types'

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
  { value: 'system', label: '시스템', icon: Monitor },
]

export function Settings() {
  const theme = useTheme()
  const colorPalette = useColorPalette()
  const isMusicPlayerEnabled = useMusicPlayerEnabled()
  const {
    lastBackupDate,
    mapProvider: rawMapProvider,
    defaultTravelMode: rawTravelMode,
    claudeEnabled: rawClaudeEnabled,
    claudeApiKey: rawClaudeApiKey,
    claudeModel: rawClaudeModel,
    aiProvider: rawAiProvider,
    aiKeyMode: rawAiKeyMode,
    ttsKeyMode: rawTtsKeyMode,
    geminiApiKey: rawGeminiApiKey,
    geminiModel: rawGeminiModel,
    setTheme,
    setColorPalette,
    setMusicPlayerEnabled,
    updateLastBackupDate,
    setMapProvider,
    setDefaultTravelMode,
    setClaudeEnabled,
    setClaudeApiKey,
    setClaudeModel,
    setAIProvider,
    setAIKeyMode,
    setTtsKeyMode,
    setGeminiApiKey,
    setGeminiModel,
    openaiApiKey: rawOpenaiApiKey,
    openaiTtsModel: rawOpenaiTtsModel,
    openaiTtsVoice: rawOpenaiTtsVoice,
    setOpenaiApiKey,
    setOpenaiTtsModel,
    setOpenaiTtsVoice,
  } = useSettingsStore(useShallow((state) => ({
    lastBackupDate: state.lastBackupDate,
    mapProvider: state.mapProvider,
    defaultTravelMode: state.defaultTravelMode,
    claudeEnabled: state.claudeEnabled,
    claudeApiKey: state.claudeApiKey,
    claudeModel: state.claudeModel,
    aiProvider: state.aiProvider,
    aiKeyMode: state.aiKeyMode,
    ttsKeyMode: state.ttsKeyMode,
    geminiApiKey: state.geminiApiKey,
    geminiModel: state.geminiModel,
    setTheme: state.setTheme,
    setColorPalette: state.setColorPalette,
    setMusicPlayerEnabled: state.setMusicPlayerEnabled,
    updateLastBackupDate: state.updateLastBackupDate,
    setMapProvider: state.setMapProvider,
    setDefaultTravelMode: state.setDefaultTravelMode,
    setClaudeEnabled: state.setClaudeEnabled,
    setClaudeApiKey: state.setClaudeApiKey,
    setClaudeModel: state.setClaudeModel,
    setAIProvider: state.setAIProvider,
    setAIKeyMode: state.setAIKeyMode,
    setTtsKeyMode: state.setTtsKeyMode,
    setGeminiApiKey: state.setGeminiApiKey,
    setGeminiModel: state.setGeminiModel,
    openaiApiKey: state.openaiApiKey,
    openaiTtsModel: state.openaiTtsModel,
    openaiTtsVoice: state.openaiTtsVoice,
    setOpenaiApiKey: state.setOpenaiApiKey,
    setOpenaiTtsModel: state.setOpenaiTtsModel,
    setOpenaiTtsVoice: state.setOpenaiTtsVoice,
  })))

  const mapProvider = (rawMapProvider as MapProvider) || 'google'
  const defaultTravelMode = (rawTravelMode as TravelMode) || 'DRIVE'
  const claudeEnabled = rawClaudeEnabled ?? false
  const claudeApiKey = rawClaudeApiKey ?? ''
  const claudeModel = (rawClaudeModel ?? 'sonnet') as ClaudeModel
  const aiProvider = (rawAiProvider ?? 'claude') as AIProvider
  const aiKeyMode = (rawAiKeyMode ?? 'server') as AIKeyMode
  const ttsKeyMode = (rawTtsKeyMode ?? 'server') as AIKeyMode
  const geminiApiKey = rawGeminiApiKey ?? ''
  const geminiModel = (rawGeminiModel ?? 'flash') as GeminiModel
  const openaiApiKey = rawOpenaiApiKey ?? ''
  const openaiTtsModel = (rawOpenaiTtsModel ?? 'tts-1') as 'tts-1' | 'tts-1-hd'
  const openaiTtsVoice = rawOpenaiTtsVoice ?? 'alloy'
  const [showApiKey, setShowApiKey] = useState(false)
  const [showOpenaiApiKey, setShowOpenaiApiKey] = useState(false)

  // Current active API key for test connection
  const currentAiApiKey = aiProvider === 'gemini' ? geminiApiKey : claudeApiKey
  const currentAiModel = aiProvider === 'gemini' ? geminiModel : claudeModel

  // PWA Install state
  const [canInstallPWA, setCanInstallPWA] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isTestingOpenaiConnection, setIsTestingOpenaiConnection] = useState(false)

  // PWA Install detection
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    setIsInstalled(isStandalone)

    const handleInstallAvailable = () => setCanInstallPWA(true)
    window.addEventListener('pwaInstallAvailable', handleInstallAvailable)

    return () => {
      window.removeEventListener('pwaInstallAvailable', handleInstallAvailable)
    }
  }, [])

  // PWA Install handler
  const handleInstallPWA = async () => {
    const accepted = await window.installPWA()
    if (accepted) {
      setCanInstallPWA(false)
      setIsInstalled(true)
    }
  }

  const handleTestConnection = async () => {
    const key = aiKeyMode === 'custom' ? currentAiApiKey : undefined
    if (aiKeyMode === 'custom' && !key) {
      toast.error('API 키를 입력하세요')
      return
    }
    setIsTestingConnection(true)
    try {
      await testConnection(key, currentAiModel, aiProvider)
      toast.success(`${aiProvider === 'gemini' ? 'Gemini' : 'Claude'} AI 연결 성공!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claude AI 연결 실패')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleTestOpenaiConnection = async () => {
    if (!openaiApiKey) {
      toast.error('API 키를 입력하세요')
      return
    }
    setIsTestingOpenaiConnection(true)
    try {
      const success = await testOpenAIConnection(openaiApiKey)
      if (success) {
        toast.success('OpenAI API 연결 성공!')
      } else {
        throw new Error('API 키가 유효하지 않거나 연결할 수 없습니다')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'OpenAI API 연결 실패')
    } finally {
      setIsTestingOpenaiConnection(false)
    }
  }

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)

  // Load storage info on mount
  useEffect(() => {
    const loadStorageInfo = async () => {
      const info = await getStorageInfo()
      setStorageInfo(info)
    }
    loadStorageInfo()
  }, [])

  const handleRequestPersistentStorage = async () => {
    const granted = await requestPersistentStorage()
    if (granted) {
      toast.success('영구 저장소가 활성화되었습니다')
      const info = await getStorageInfo()
      setStorageInfo(info)
    } else {
      toast.error('영구 저장소 활성화가 거부되었습니다')
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const data = await exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `travel-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      updateLastBackupDate()
      toast.success('백업이 완료되었습니다')
    } catch {
      toast.error('백업 실패')
    } finally {
      setIsExporting(false)
    }
  }

  // 빈 백업 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const template: BackupData = {
      version: APP_VERSION,
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      trips: [
        {
          id: 1,
          title: '예시 여행 (삭제 후 사용하세요)',
          country: '대한민국',
          timezone: 'Asia/Seoul',
          startDate: '2025-01-01',
          endDate: '2025-01-03',
          coverImage: '',
          plansCount: 0,
          isFavorite: false,
          createdAt: new Date().toISOString() as unknown as Date,
          updatedAt: new Date().toISOString() as unknown as Date,
        },
      ],
      plans: [
        {
          id: 1,
          tripId: 1,
          day: 1,
          order: 0,
          type: 'attraction',
          placeName: '예시 일정 (삭제 후 사용하세요)',
          startTime: '09:00',
          endTime: '12:00',
          address: '서울',
          memo: '메모를 입력하세요',
          createdAt: new Date().toISOString() as unknown as Date,
          updatedAt: new Date().toISOString() as unknown as Date,
        },
      ],
      places: [],
      settings: DEFAULT_SETTINGS,
    }

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'travel-backup-template.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('백업 템플릿이 다운로드되었습니다')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate backup data
      const validation = validateBackupData(data)
      if (!validation.valid) {
        toast.error(validation.error || '유효하지 않은 백업 파일입니다')
        return
      }

      if (validation.needsMigration) {
        toast.info(`이전 버전(v${validation.appVersion || 'unknown'})의 백업을 복원합니다`)
      }

      await importAllData(data as BackupData)
      toast.success(`데이터를 복원했습니다 (${data.trips.length}개 여행, ${data.plans?.length || 0}개 일정)`)
      window.location.reload()
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('백업 파일 형식이 올바르지 않습니다 (JSON 파싱 오류)')
      } else {
        toast.error('복원 실패: 올바른 백업 파일인지 확인해주세요')
      }
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  const handleClearData = async () => {
    try {
      await clearAllData()
      toast.success('모든 데이터가 삭제되었습니다')
      setIsClearDialogOpen(false)
      window.location.reload()
    } catch {
      toast.error('데이터 삭제 실패')
    }
  }

  const SETTING_SECTIONS = [
    { id: 'general', label: '일반', icon: SettingsIcon },
    { id: 'theme', label: '테마', icon: Palette },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'data', label: '데이터', icon: Database },
  ] as const

  type SettingSection = typeof SETTING_SECTIONS[number]['id']

  const [activeSection, setActiveSection] = useState<SettingSection>('general')
  const sectionRefs = {
    general: useRef<HTMLDivElement>(null),
    theme: useRef<HTMLDivElement>(null),
    ai: useRef<HTMLDivElement>(null),
    data: useRef<HTMLDivElement>(null),
  }

  // IntersectionObserver to update active tab on scroll
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const entries = Object.entries(sectionRefs) as [SettingSection, React.RefObject<HTMLDivElement | null>][]

    entries.forEach(([id, ref]) => {
      if (!ref.current) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id)
          }
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      )
      observer.observe(ref.current)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">설정</h1>

        {/* Section Tab Bar */}
        <div className="sticky top-0 z-10 bg-[var(--background)] py-2 -mx-1 px-1">
          <div className="flex gap-0.5 sm:gap-1 p-1 bg-[var(--muted)] rounded-lg">
            {SETTING_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id)
                  sectionRefs[section.id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === section.id
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
              >
                <section.icon className="size-4" />
                <span className="hidden sm:inline">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* === GENERAL SECTION === */}
        <div ref={sectionRefs.general} className="scroll-mt-20">

          {/* PWA Install */}
          <Card padding="lg">
            <CardHeader
              title="앱 설치"
              description="홈 화면에 추가하여 네이티브 앱처럼 사용"
              icon={<Smartphone className="size-5" />}
            />
            <CardContent>
              {isInstalled ? (
                <div className="flex items-center gap-3 p-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                  <Smartphone className="size-5 text-success-600 dark:text-success-400" />
                  <span className="text-sm font-medium text-success-700 dark:text-success-400">앱이 이미 설치되어 있습니다</span>
                </div>
              ) : canInstallPWA ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Moonwave Travel을 홈 화면에 추가하여 네이티브 앱처럼 사용할 수 있습니다.
                  </p>
                  <Button
                    color="primary"
                    size="sm"
                    leftIcon={<Download className="size-4" />}
                    onClick={handleInstallPWA}
                  >
                    앱 설치하기
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  <p className="mb-2">
                    브라우저 메뉴에서 &quot;홈 화면에 추가&quot;를 선택하여 앱을 설치할 수 있습니다.
                  </p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>Chrome: 메뉴 → 앱 설치</li>
                    <li>Safari: 공유 → 홈 화면에 추가</li>
                    <li>Samsung: 메뉴 → 페이지를 다음으로 추가 → 홈 화면</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Theme */}
          <Card padding="lg">
            <CardHeader title="테마" description="앱의 외관을 선택하세요" />
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-lg border-2 transition-colors ${theme === option.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    <option.icon
                      className={`size-6 ${theme === option.value
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-zinc-500'
                        }`}
                    />
                    <span
                      className={`text-sm font-medium ${theme === option.value
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                    >
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timezone Settings */}
          <TimezoneSettings />

        </div>{/* end general section */}

        {/* === THEME SECTION === */}
        <div ref={sectionRefs.theme} className="scroll-mt-20">

          {/* Color Palette */}
          <Card padding="lg">
            <CardHeader
              title="컬러 팔레트"
              description="라이트 모드에서 적용되는 색상 테마"
              icon={<Palette className="size-5" />}
            />
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                {Object.values(COLOR_PALETTES).map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => setColorPalette(palette.id as ColorPalette)}
                    className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${colorPalette === palette.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    <div className="flex gap-0.5 mb-1.5">
                      <div
                        className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: palette.colors.primary }}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: palette.colors.secondary }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${colorPalette === palette.id
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                    >
                      {palette.nameKo}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                다크 모드에서는 기본 민트 색상이 사용됩니다.
              </p>
            </CardContent>
          </Card>

          {/* Music Player */}
          <Card padding="lg">
            <CardHeader
              title="배경 음악"
              description="Moonwave 오리지널 음악을 재생합니다"
              icon={<Music className="size-5" />}
            />
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  음악 플레이어 활성화
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isMusicPlayerEnabled}
                  onClick={() => setMusicPlayerEnabled(!isMusicPlayerEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMusicPlayerEnabled ? 'bg-primary-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMusicPlayerEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                활성화하면 앱 하단에 음악 플레이어가 표시됩니다.
              </p>
            </CardContent>
          </Card>

          {/* Map Settings */}
          <Card padding="lg">
            <CardHeader
              title="지도 설정"
              description="지도 제공자와 기본 이동수단을 설정합니다"
              icon={<Map className="size-5" />}
            />
            <CardContent className="space-y-4">
              {/* Map Provider */}
              <div>
                <p className="text-sm font-medium text-[var(--foreground)] mb-2">지도 제공자</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'google' as MapProvider, label: 'Google Maps', desc: '실시간 경로, Street View' },
                    { value: 'leaflet' as MapProvider, label: 'Leaflet/OSM', desc: '오프라인 지원, 가벼움' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setMapProvider(option.value)}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${mapProvider === option.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                    >
                      <span className={`text-sm font-medium ${mapProvider === option.value
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-zinc-600 dark:text-zinc-400'
                        }`}>
                        {option.label}
                      </span>
                      <p className="text-xs text-zinc-500 mt-0.5">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Travel Mode */}
              <div>
                <p className="text-sm font-medium text-[var(--foreground)] mb-2">기본 이동수단</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                  {(Object.entries(TRAVEL_MODE_LABELS) as [TravelMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setDefaultTravelMode(mode)}
                      className={`p-2 rounded-lg border-2 text-center transition-colors ${defaultTravelMode === mode
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                    >
                      <span className={`text-xs font-medium ${defaultTravelMode === mode
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-zinc-600 dark:text-zinc-400'
                        }`}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>{/* end theme section */}

        {/* === AI SECTION === */}
        <div ref={sectionRefs.ai} className="scroll-mt-20">

          {/* AI Settings */}
          <Card padding="lg">
            <CardHeader
              title="AI 설정"
              description="AI 여행 어시스턴트를 사용합니다"
              icon={<Sparkles className="size-5" />}
            />
            <CardContent className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  AI 기능 활성화
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={claudeEnabled}
                  onClick={() => setClaudeEnabled(!claudeEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${claudeEnabled ? 'bg-primary-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${claudeEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {claudeEnabled && (
                <>
                  {/* AI Provider Selection */}
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">AI 프로바이더</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'claude' as AIProvider, label: 'Claude', desc: 'Anthropic' },
                        { value: 'gemini' as AIProvider, label: 'Gemini', desc: 'Google' },
                      ]).map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setAIProvider(option.value)}
                          className={`p-2 sm:p-3 rounded-lg border-2 text-left transition-colors ${aiProvider === option.value
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                        >
                          <span className={`text-sm font-medium ${aiProvider === option.value
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                            }`}>
                            {option.label}
                          </span>
                          <p className="text-xs text-zinc-500 mt-0.5">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">모델</p>
                    <div className={`grid gap-2 ${aiProvider === 'claude' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                      {aiProvider === 'claude' ? ([
                        { value: 'haiku' as ClaudeModel, label: 'Haiku', desc: '빠른 응답, 경제적' },
                        { value: 'sonnet' as ClaudeModel, label: 'Sonnet', desc: '균형 잡힌 성능 (추천)' },
                        { value: 'opus' as ClaudeModel, label: 'Opus', desc: '최고 품질' },
                      ]).map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setClaudeModel(option.value)}
                          className={`p-2 sm:p-3 rounded-lg border-2 text-left transition-colors ${claudeModel === option.value
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                        >
                          <span className={`text-sm font-medium ${claudeModel === option.value
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                            }`}>
                            {option.label}
                          </span>
                          <p className="text-xs text-zinc-500 mt-0.5">{option.desc}</p>
                        </button>
                      )) : ([
                        { value: 'flash' as GeminiModel, label: 'Flash', desc: '빠른 응답 (추천)' },
                        { value: 'pro' as GeminiModel, label: 'Pro', desc: '최고 품질' },
                      ]).map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setGeminiModel(option.value)}
                          className={`p-2 sm:p-3 rounded-lg border-2 text-left transition-colors ${geminiModel === option.value
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                        >
                          <span className={`text-sm font-medium ${geminiModel === option.value
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                            }`}>
                            {option.label}
                          </span>
                          <p className="text-xs text-zinc-500 mt-0.5">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key Mode */}
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">API 키</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAIKeyMode('server')}
                        className={`p-2 rounded-lg border-2 text-center transition-colors ${aiKeyMode === 'server'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                          }`}
                      >
                        <span className={`text-sm font-medium ${aiKeyMode === 'server'
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-zinc-600 dark:text-zinc-400'
                          }`}>
                          서버 키 사용
                        </span>
                      </button>
                      <button
                        onClick={() => setAIKeyMode('custom')}
                        className={`p-2 rounded-lg border-2 text-center transition-colors ${aiKeyMode === 'custom'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                          }`}
                      >
                        <span className={`text-sm font-medium ${aiKeyMode === 'custom'
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-zinc-600 dark:text-zinc-400'
                          }`}>
                          직접 입력
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Custom API Key Input */}
                  {aiKeyMode === 'custom' && (
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                        {aiProvider === 'gemini' ? 'Google AI API 키' : 'Anthropic API 키'}
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={currentAiApiKey}
                            onChange={(e) => aiProvider === 'gemini' ? setGeminiApiKey(e.target.value) : setClaudeApiKey(e.target.value)}
                            placeholder={aiProvider === 'gemini' ? 'AI...' : 'sk-ant-...'}
                            className="w-full h-10 px-3 pr-10 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          >
                            {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        <Button
                          color="secondary"
                          outline
                          size="sm"
                          onClick={handleTestConnection}
                          isLoading={isTestingConnection}
                          disabled={!currentAiApiKey}
                        >
                          {isTestingConnection ? '' : '연결 테스트'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Server key mode info or test */}
                  {aiKeyMode === 'server' && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        서버에 등록된 API 키를 사용합니다
                      </p>
                      <Button
                        color="secondary"
                        outline
                        size="sm"
                        onClick={handleTestConnection}
                        isLoading={isTestingConnection}
                      >
                        {isTestingConnection ? '' : '연결 테스트'}
                      </Button>
                    </div>
                  )}

                  {/* Info */}
                  <div className="pt-2 space-y-1">
                    {aiKeyMode === 'custom' && (
                      <>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          API 키는 이 기기에만 저장되며 클라우드에 동기화되지 않습니다.
                        </p>
                        <a
                          href={aiProvider === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://console.anthropic.com/settings/keys'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          {aiProvider === 'gemini' ? 'API 키 발급: aistudio.google.com' : 'API 키 발급: console.anthropic.com'}
                        </a>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* OpenAI TTS Settings */}
          <Card padding="lg">
            <CardHeader
              title="AI 음성 (TTS)"
              description="OpenAI TTS API로 고품질 AI 음성을 사용합니다"
              icon={<Volume2 className="size-5" />}
            />
            <CardContent className="space-y-4">
              {/* TTS API Key Mode */}
              <div>
                <p className="text-sm font-medium text-[var(--foreground)] mb-2">API 키</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTtsKeyMode('server')}
                    className={`p-2 rounded-lg border-2 text-center transition-colors ${ttsKeyMode === 'server'
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    <span className={`text-sm font-medium ${ttsKeyMode === 'server'
                        ? 'text-violet-600 dark:text-violet-400'
                        : 'text-zinc-600 dark:text-zinc-400'
                      }`}>
                      서버 키 사용
                    </span>
                  </button>
                  <button
                    onClick={() => setTtsKeyMode('custom')}
                    className={`p-2 rounded-lg border-2 text-center transition-colors ${ttsKeyMode === 'custom'
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    <span className={`text-sm font-medium ${ttsKeyMode === 'custom'
                        ? 'text-violet-600 dark:text-violet-400'
                        : 'text-zinc-600 dark:text-zinc-400'
                      }`}>
                      직접 입력
                    </span>
                  </button>
                </div>
              </div>

              {/* Custom API Key Input */}
              {ttsKeyMode === 'custom' && (
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">OpenAI API 키</p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showOpenaiApiKey ? 'text' : 'password'}
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full h-10 px-3 pr-10 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenaiApiKey(!showOpenaiApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showOpenaiApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <Button
                      color="secondary"
                      outline
                      size="sm"
                      onClick={handleTestOpenaiConnection}
                      isLoading={isTestingOpenaiConnection}
                      disabled={!openaiApiKey}
                    >
                      {isTestingOpenaiConnection ? '' : '연결 테스트'}
                    </Button>
                  </div>
                </div>
              )}

              {ttsKeyMode === 'server' && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  서버에 등록된 OpenAI API 키를 사용합니다
                </p>
              )}

              {(ttsKeyMode === 'server' || openaiApiKey) && (
                <>
                  {/* TTS Model */}
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">TTS 모델</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'tts-1' as const, label: 'TTS-1', desc: '빠른 응답, 일반 품질' },
                        { value: 'tts-1-hd' as const, label: 'TTS-1 HD', desc: '고음질 (추천)' },
                      ]).map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setOpenaiTtsModel(option.value)}
                          className={`p-3 rounded-lg border-2 text-left transition-colors ${openaiTtsModel === option.value
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                        >
                          <span className={`text-sm font-medium ${openaiTtsModel === option.value
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                            }`}>
                            {option.label}
                          </span>
                          <p className="text-xs text-zinc-500 mt-0.5">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice Selection */}
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">기본 음성</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                      {[
                        { value: 'alloy', label: 'Alloy', desc: '중성적' },
                        { value: 'echo', label: 'Echo', desc: '남성적' },
                        { value: 'fable', label: 'Fable', desc: '따뜻한' },
                        { value: 'onyx', label: 'Onyx', desc: '깊은' },
                        { value: 'nova', label: 'Nova', desc: '여성적' },
                        { value: 'shimmer', label: 'Shimmer', desc: '밝은' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setOpenaiTtsVoice(option.value)}
                          className={`p-2 rounded-lg border-2 text-center transition-colors ${openaiTtsVoice === option.value
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                        >
                          <span className={`text-sm font-medium ${openaiTtsVoice === option.value
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                            }`}>
                            {option.label}
                          </span>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Info */}
              <div className="pt-2 space-y-1">
                {ttsKeyMode === 'custom' && (
                  <>
                    {!openaiApiKey && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        API 키를 입력하면 고품질 AI 음성을 사용할 수 있습니다. 미입력 시 브라우저 기본 TTS가 사용됩니다.
                      </p>
                    )}
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      API 키는 이 기기에만 저장되며 클라우드에 동기화되지 않습니다.
                    </p>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      API 키 발급: platform.openai.com
                    </a>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

        </div>{/* end ai section */}

        {/* === DATA SECTION === */}
        <div ref={sectionRefs.data} className="scroll-mt-20">

          {/* Data Management */}
          <Card padding="lg">
            <CardHeader
              title="데이터 관리"
              description="백업 및 복원, 데이터 초기화"
              icon={<Database className="size-5" />}
            />
            <CardContent className="space-y-4">
              {/* Last Backup */}
              {lastBackupDate && (
                <p className="text-sm text-zinc-500">
                  마지막 백업: {new Date(lastBackupDate).toLocaleString('ko-KR')}
                </p>
              )}

              {/* Backup */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  color="primary"
                  leftIcon={<Download className="size-4" />}
                  onClick={handleExport}
                  isLoading={isExporting}
                  className="flex-1"
                >
                  데이터 백업
                </Button>

                <label className="flex-1">
                  <Button
                    color="secondary"
                    outline
                    leftIcon={<Upload className="size-4" />}
                    isLoading={isImporting}
                    className="w-full"
                    as="span"
                  >
                    데이터 복원
                  </Button>
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
              </div>

              {/* Template Download */}
              <div className="pt-2">
                <Button
                  color="secondary"
                  outline
                  size="sm"
                  leftIcon={<FileJson className="size-4" />}
                  onClick={handleDownloadTemplate}
                >
                  백업 양식 내려받기
                </Button>
                <p className="mt-2 text-sm text-zinc-400">
                  예시 데이터가 포함된 백업 파일 양식을 다운로드합니다. 직접 편집하여 데이터를 복원할 수 있습니다.
                </p>
              </div>

              {/* Clear Data */}
              <div className="pt-4 border-t border-[var(--border)]">
                <Button
                  color="danger"
                  outline
                  leftIcon={<Trash2 className="size-4" />}
                  onClick={() => setIsClearDialogOpen(true)}
                >
                  모든 데이터 삭제
                </Button>
                <p className="mt-2 text-sm text-zinc-400">
                  모든 여행, 일정, 장소 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Storage Info */}
          <Card padding="lg">
            <CardHeader
              title="저장소 정보"
              description="로컬 데이터 저장소 상태"
              icon={<HardDrive className="size-5" />}
            />
            <CardContent className="space-y-4">
              {storageInfo && (
                <>
                  {/* Storage Usage Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">사용량</span>
                      <span className="font-medium text-[var(--foreground)]">
                        {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${storageInfo.status === 'critical'
                          ? 'bg-danger-500'
                          : storageInfo.status === 'warning'
                            ? 'bg-warning-500'
                            : 'bg-primary-500'
                          }`}
                        style={{ width: `${Math.min(storageInfo.percentage * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-400">
                      {Math.round(storageInfo.percentage * 100)}% 사용 중
                    </p>
                  </div>

                  {/* Data Breakdown */}
                  <div className="pt-4 border-t border-[var(--border)]">
                    <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">데이터 분류</h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">여행</dt>
                        <dd className="font-medium text-[var(--foreground)]">{formatBytes(storageInfo.breakdown.trips)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">일정</dt>
                        <dd className="font-medium text-[var(--foreground)]">{formatBytes(storageInfo.breakdown.plans)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">장소</dt>
                        <dd className="font-medium text-[var(--foreground)]">{formatBytes(storageInfo.breakdown.places)}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Persistent Storage Status */}
                  <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className={`size-4 ${storageInfo.isPersisted ? 'text-success-500' : 'text-zinc-400'}`} />
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {storageInfo.isPersisted ? '영구 저장소 활성화됨' : '영구 저장소 비활성화'}
                      </span>
                    </div>
                    {!storageInfo.isPersisted && (
                      <Button size="sm" color="secondary" outline onClick={handleRequestPersistentStorage}>
                        활성화
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* App Info */}
          <Card padding="lg">
            <CardHeader title="앱 정보" />
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">버전</dt>
                  <dd className="font-medium text-[var(--foreground)]">v{APP_VERSION}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">빌드</dt>
                  <dd className="font-medium text-[var(--foreground)]">Production</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

        </div>{/* end data section */}

        {/* Clear Data Dialog */}
        <Dialog open={isClearDialogOpen} onClose={() => setIsClearDialogOpen(false)}>
          <DialogTitle onClose={() => setIsClearDialogOpen(false)}>데이터 삭제</DialogTitle>
          <DialogBody>
            <p className="text-zinc-600 dark:text-zinc-400">
              정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">
              모든 여행, 일정, 장소 데이터가 영구적으로 삭제됩니다.
            </p>
          </DialogBody>
          <DialogActions>
            <Button color="secondary" onClick={() => setIsClearDialogOpen(false)}>
              취소
            </Button>
            <Button color="danger" onClick={handleClearData}>
              삭제
            </Button>
          </DialogActions>
        </Dialog>

      </div>
    </PageContainer>
  )
}
