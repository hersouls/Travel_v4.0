import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, Monitor, Download, Upload, Trash2, Database, CloudOff, Palette, HardDrive, Shield, Cloud, RefreshCw, Check, X, FileJson, Music } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { PageContainer } from '@/components/layout'
import { TimezoneSettings } from '@/components/timezone'
import { useSettingsStore, useTheme, useColorPalette, useMusicPlayerEnabled } from '@/stores/settingsStore'
import { toast } from '@/stores/uiStore'
import { exportAllData, importAllData, clearAllData, validateBackupData, type BackupData } from '@/services/database'
import { importFromFirebase, validateBackupFile, type MigrationProgress } from '@/services/migration'
import { APP_VERSION, COLOR_PALETTES, SCHEMA_VERSION } from '@/utils/constants'
import { DEFAULT_SETTINGS } from '@/types'
import { getStorageInfo, formatBytes, requestPersistentStorage, type StorageInfo } from '@/services/storageQuota'
import { googleDrive, DriveError, DriveErrorCode, type DriveFile, type UploadProgress } from '@/services/googleDrive'
import type { ThemeMode, ColorPalette } from '@/types'

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
  { value: 'system', label: '시스템', icon: Monitor },
]

export function Settings() {
  const theme = useTheme()
  const colorPalette = useColorPalette()
  const isMusicPlayerEnabled = useMusicPlayerEnabled()
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setColorPalette = useSettingsStore((state) => state.setColorPalette)
  const setMusicPlayerEnabled = useSettingsStore((state) => state.setMusicPlayerEnabled)
  const updateLastBackupDate = useSettingsStore((state) => state.updateLastBackupDate)
  const lastBackupDate = useSettingsStore((state) => state.lastBackupDate)

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null)
  const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false)
  const [migrationStats, setMigrationStats] = useState<{ trips: number; plans: number; places: number } | null>(null)
  const [pendingMigrationFile, setPendingMigrationFile] = useState<string | null>(null)
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)

  // Google Drive states
  const [isDriveConnected, setIsDriveConnected] = useState(false)
  const [driveBackups, setDriveBackups] = useState<DriveFile[]>([])
  const [isDriveLoading, setIsDriveLoading] = useState(false)
  const [isDriveUploading, setIsDriveUploading] = useState(false)
  const [driveUploadProgress, setDriveUploadProgress] = useState<UploadProgress | null>(null)
  const [isDriveRestoring, setIsDriveRestoring] = useState(false)
  const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFile | null>(null)
  const [isDriveRestoreDialogOpen, setIsDriveRestoreDialogOpen] = useState(false)

  // Load storage info and check Drive connection on mount
  useEffect(() => {
    const loadStorageInfo = async () => {
      const info = await getStorageInfo()
      setStorageInfo(info)
    }
    loadStorageInfo()

    // Check Google Drive connection
    const initDrive = async () => {
      try {
        await googleDrive.init()
        setIsDriveConnected(googleDrive.isConnected())
      } catch (error) {
        console.error('Failed to initialize Google Drive:', error)
      }
    }
    initDrive()

    // Check URL params for Drive connection result
    const params = new URLSearchParams(window.location.search)
    if (params.get('drive_connected') === 'true') {
      // Drive 서비스 재초기화하여 새 토큰 적용
      const reinitDrive = async () => {
        try {
          await googleDrive.init()
          if (googleDrive.isConnected()) {
            setIsDriveConnected(true)
            toast.success('Google Drive가 연결되었습니다')
            // 연결 후 백업 목록 자동 로드
            const files = await googleDrive.listBackups()
            setDriveBackups(files)
          }
        } catch (error) {
          console.error('Failed to reinitialize after OAuth:', error)
          toast.error('Google Drive 초기화 실패')
        }
      }
      reinitDrive()
      window.history.replaceState({}, '', '/settings')
    }
    if (params.get('drive_error')) {
      const errorType = params.get('drive_error')
      const errorMessages: Record<string, string> = {
        access_denied: '사용자가 권한을 거부했습니다',
        no_code: '인증 코드를 받지 못했습니다',
        token_exchange_failed: '토큰 교환에 실패했습니다',
        server_error: '서버 오류가 발생했습니다',
      }
      toast.error(errorMessages[errorType as string] || 'Google Drive 연결 실패')
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  // Drive error handler
  const handleDriveError = (error: unknown, context: string) => {
    console.error(`${context} error:`, error)

    if (error instanceof DriveError) {
      switch (error.code) {
        case DriveErrorCode.TOKEN_EXPIRED:
        case DriveErrorCode.NOT_AUTHENTICATED:
          toast.error('세션이 만료되었습니다. 다시 연결해주세요.')
          setIsDriveConnected(false)
          setDriveBackups([])
          break
        case DriveErrorCode.NETWORK_ERROR:
          toast.error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
          break
        case DriveErrorCode.QUOTA_EXCEEDED:
          toast.error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
          break
        case DriveErrorCode.PERMISSION_DENIED:
          toast.error('권한이 없습니다. Google Drive 연결을 다시 설정해주세요.')
          setIsDriveConnected(false)
          break
        case DriveErrorCode.FILE_NOT_FOUND:
          toast.error('파일을 찾을 수 없습니다.')
          break
        case DriveErrorCode.CONFIG_MISSING:
          toast.error('Google Drive 설정이 올바르지 않습니다.')
          break
        default:
          toast.error(`${context} 실패: ${error.message}`)
      }
    } else {
      toast.error(`${context} 실패`)
    }
  }

  // Load Drive backups when connected
  const loadDriveBackups = useCallback(async () => {
    if (!isDriveConnected) return

    setIsDriveLoading(true)
    try {
      const files = await googleDrive.listBackups()
      setDriveBackups(files)
    } catch (error) {
      handleDriveError(error, '백업 목록 로드')
    } finally {
      setIsDriveLoading(false)
    }
  }, [isDriveConnected])

  useEffect(() => {
    loadDriveBackups()
  }, [loadDriveBackups])

  const handleDriveConnect = async () => {
    console.log('[Settings] handleDriveConnect called')
    try {
      await googleDrive.connect()
      console.log('[Settings] googleDrive.connect() resolved')
      console.log('[Settings] googleDrive.isConnected():', googleDrive.isConnected())
      setIsDriveConnected(true)
      toast.success('Google Drive가 연결되었습니다')
      loadDriveBackups()
    } catch (error) {
      console.error('[Settings] handleDriveConnect error:', error)
      handleDriveError(error, 'Google Drive 연결')
    }
  }

  const handleDriveDisconnect = () => {
    googleDrive.disconnect()
    setIsDriveConnected(false)
    setDriveBackups([])
    toast.success('Google Drive 연결이 해제되었습니다')
  }

  const handleDriveBackup = async () => {
    setIsDriveUploading(true)
    setDriveUploadProgress(null)

    try {
      const data = await exportAllData()
      const fileName = `travel-backup-${new Date().toISOString().split('T')[0]}.json`
      const jsonData = JSON.stringify(data, null, 2)

      await googleDrive.uploadBackup(jsonData, fileName, setDriveUploadProgress)

      updateLastBackupDate()
      toast.success('Google Drive에 백업되었습니다')
      loadDriveBackups()
    } catch (error) {
      handleDriveError(error, '백업')
    } finally {
      setIsDriveUploading(false)
      setDriveUploadProgress(null)
    }
  }

  const handleDriveRestoreClick = (file: DriveFile) => {
    setSelectedDriveFile(file)
    setIsDriveRestoreDialogOpen(true)
  }

  const handleDriveRestore = async () => {
    if (!selectedDriveFile) return

    setIsDriveRestoring(true)
    setIsDriveRestoreDialogOpen(false)

    try {
      const content = await googleDrive.downloadBackup(selectedDriveFile.id)
      const data = JSON.parse(content)

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
        toast.error('백업 파일 형식이 올바르지 않습니다')
      } else {
        handleDriveError(error, '복원')
      }
    } finally {
      setIsDriveRestoring(false)
      setSelectedDriveFile(null)
    }
  }

  const handleDriveDelete = async (file: DriveFile) => {
    if (!confirm(`"${file.name}" 백업을 삭제하시겠습니까?`)) return

    try {
      await googleDrive.deleteBackup(file.id)
      toast.success('백업이 삭제되었습니다')
      loadDriveBackups()
    } catch (error) {
      handleDriveError(error, '백업 삭제')
    }
  }

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
          type: 'activity',
          title: '예시 일정 (삭제 후 사용하세요)',
          startTime: '09:00',
          endTime: '12:00',
          location: '서울',
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

  const handleMigrationFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const validation = validateBackupFile(text)

      if (!validation.valid) {
        toast.error(validation.error || '유효하지 않은 파일입니다')
        return
      }

      setMigrationStats(validation.stats || null)
      setPendingMigrationFile(text)
      setIsMigrationDialogOpen(true)
    } catch {
      toast.error('파일 읽기 실패')
    } finally {
      e.target.value = ''
    }
  }

  const handleMigration = async (clearExisting: boolean) => {
    if (!pendingMigrationFile) return

    setIsMigrating(true)
    setIsMigrationDialogOpen(false)

    try {
      const result = await importFromFirebase(pendingMigrationFile, {
        convertImages: true,
        clearExisting,
        onProgress: setMigrationProgress,
      })

      if (result.success) {
        toast.success(
          `마이그레이션 완료: ${result.tripsImported}개 여행, ${result.plansImported}개 일정, ${result.placesImported}개 장소`
        )
        if (result.warnings.length > 0) {
          console.warn('Migration warnings:', result.warnings)
        }
        window.location.reload()
      } else {
        toast.error(`마이그레이션 일부 실패: ${result.errors.join(', ')}`)
      }
    } catch {
      toast.error('마이그레이션 실패')
    } finally {
      setIsMigrating(false)
      setMigrationProgress(null)
      setPendingMigrationFile(null)
      setMigrationStats(null)
    }
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">설정</h1>

      {/* Theme */}
      <Card padding="lg">
        <CardHeader title="테마" description="앱의 외관을 선택하세요" />
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${theme === option.value
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

      {/* Color Palette */}
      <Card padding="lg">
        <CardHeader
          title="컬러 팔레트"
          description="라이트 모드에서 적용되는 색상 테마"
          icon={<Palette className="size-5" />}
        />
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
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
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isMusicPlayerEnabled ? 'bg-primary-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isMusicPlayerEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            활성화하면 앱 하단에 음악 플레이어가 표시됩니다.
          </p>
        </CardContent>
      </Card>

      {/* Timezone Settings */}
      <TimezoneSettings />

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

      {/* Google Drive Backup */}
      <Card padding="lg">
        <CardHeader
          title="Google Drive 백업"
          description="클라우드에 데이터를 자동 백업합니다"
          icon={<Cloud className="size-5" />}
        />
        <CardContent className="space-y-4">
          {!isDriveConnected ? (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Google Drive를 연결하면 데이터를 클라우드에 백업하고 다른 기기에서 복원할 수 있습니다.
              </p>
              <Button
                color="primary"
                leftIcon={<Cloud className="size-4" />}
                onClick={handleDriveConnect}
              >
                Google Drive 연결
              </Button>
            </>
          ) : (
            <>
              {/* Connection Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="size-4 text-success-500" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Google Drive 연결됨
                  </span>
                </div>
                <Button size="sm" color="secondary" outline onClick={handleDriveDisconnect}>
                  연결 해제
                </Button>
              </div>

              {/* Backup Button */}
              <div className="pt-4 border-t border-[var(--border)]">
                <Button
                  color="primary"
                  leftIcon={<Upload className="size-4" />}
                  onClick={handleDriveBackup}
                  isLoading={isDriveUploading}
                  className="w-full sm:w-auto"
                >
                  {isDriveUploading ? '업로드 중...' : 'Drive에 백업'}
                </Button>

                {isDriveUploading && driveUploadProgress && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>업로드 중...</span>
                      <span>{driveUploadProgress.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${driveUploadProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Backup List */}
              <div className="pt-4 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-[var(--foreground)]">저장된 백업</h4>
                  <button
                    onClick={loadDriveBackups}
                    disabled={isDriveLoading}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="새로고침"
                  >
                    <RefreshCw className={`size-4 text-zinc-500 ${isDriveLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {isDriveLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="size-5 text-zinc-400 animate-spin" />
                  </div>
                ) : driveBackups.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4 text-center">
                    저장된 백업이 없습니다
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {driveBackups.slice(0, 5).map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileJson className="size-5 text-zinc-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {file.modifiedTime
                                ? new Date(file.modifiedTime).toLocaleString('ko-KR')
                                : '날짜 없음'}
                              {file.size && ` · ${formatBytes(parseInt(file.size))}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleDriveRestoreClick(file)}
                            disabled={isDriveRestoring}
                            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            title="복원"
                          >
                            <Download className="size-4 text-primary-500" />
                          </button>
                          <button
                            onClick={() => handleDriveDelete(file)}
                            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            title="삭제"
                          >
                            <X className="size-4 text-zinc-400 hover:text-danger-500" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Firebase Migration */}
      <Card padding="lg">
        <CardHeader
          title="Firebase 마이그레이션"
          description="Travel v2.1 데이터를 가져옵니다"
          icon={<CloudOff className="size-5" />}
        />
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            기존 Firebase 기반 Travel v2.1에서 내보낸 JSON 파일을 가져올 수 있습니다.
          </p>

          <label className="block">
            <Button
              color="secondary"
              outline
              leftIcon={<Upload className="size-4" />}
              isLoading={isMigrating}
              className="w-full sm:w-auto"
              as="span"
            >
              {isMigrating ? '마이그레이션 중...' : 'Firebase 데이터 가져오기'}
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleMigrationFileSelect}
              disabled={isMigrating}
            />
          </label>

          {isMigrating && migrationProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{migrationProgress.message}</span>
                <span className="text-zinc-500">
                  {migrationProgress.current}/{migrationProgress.total}
                </span>
              </div>
              <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{
                    width: `${(migrationProgress.current / migrationProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
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

      {/* Migration Confirmation Dialog */}
      <Dialog open={isMigrationDialogOpen} onClose={() => setIsMigrationDialogOpen(false)}>
        <DialogTitle onClose={() => setIsMigrationDialogOpen(false)}>Firebase 데이터 가져오기</DialogTitle>
        <DialogBody>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            다음 데이터를 가져옵니다:
          </p>
          {migrationStats && (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-zinc-500">여행</span>
                <span className="font-medium text-[var(--foreground)]">{migrationStats.trips}개</span>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500">일정</span>
                <span className="font-medium text-[var(--foreground)]">{migrationStats.plans}개</span>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500">장소</span>
                <span className="font-medium text-[var(--foreground)]">{migrationStats.places}개</span>
              </li>
            </ul>
          )}
          <p className="mt-4 text-sm text-zinc-500">
            기존 데이터를 유지하면서 가져오거나, 기존 데이터를 삭제하고 가져올 수 있습니다.
          </p>
        </DialogBody>
        <DialogActions>
          <Button color="secondary" onClick={() => setIsMigrationDialogOpen(false)}>
            취소
          </Button>
          <Button color="warning" onClick={() => handleMigration(false)}>
            기존 데이터 유지
          </Button>
          <Button color="primary" onClick={() => handleMigration(true)}>
            기존 데이터 삭제 후 가져오기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drive Restore Confirmation Dialog */}
      <Dialog open={isDriveRestoreDialogOpen} onClose={() => setIsDriveRestoreDialogOpen(false)}>
        <DialogTitle onClose={() => setIsDriveRestoreDialogOpen(false)}>Google Drive 백업 복원</DialogTitle>
        <DialogBody>
          {selectedDriveFile && (
            <>
              <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                다음 백업 파일을 복원하시겠습니까?
              </p>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <p className="font-medium text-[var(--foreground)]">{selectedDriveFile.name}</p>
                <p className="text-sm text-zinc-500">
                  {selectedDriveFile.modifiedTime
                    ? new Date(selectedDriveFile.modifiedTime).toLocaleString('ko-KR')
                    : '날짜 없음'}
                </p>
              </div>
              <p className="mt-4 text-sm text-danger-600 dark:text-danger-400">
                현재 모든 데이터가 백업 파일의 내용으로 대체됩니다.
              </p>
            </>
          )}
        </DialogBody>
        <DialogActions>
          <Button color="secondary" onClick={() => setIsDriveRestoreDialogOpen(false)}>
            취소
          </Button>
          <Button color="primary" onClick={handleDriveRestore} isLoading={isDriveRestoring}>
            복원
          </Button>
        </DialogActions>
      </Dialog>
      </div>
    </PageContainer>
  )
}
