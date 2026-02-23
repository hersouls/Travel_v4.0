import { useState } from 'react'
import { Search, Plus, Star, MapPin, Trash2, Loader2, Sparkles, Globe, Edit, ExternalLink, ChevronDown, ChevronUp, Copy, Volume2, Download, Upload, FileJson, X, ArrowUpDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { PlanTypeBadge } from '@/components/ui/Badge'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { usePlaceStore, usePlaces, usePlaceLoading } from '@/stores/placeStore'
import type { PlaceSortBy } from '@/stores/placeStore'
import { toast } from '@/stores/uiStore'
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete'
import { extractPlaceInfo, isGoogleMapsUrl } from '@/services/googleMaps'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import { detectPlanType } from '@/utils/place'
import {
  exportSinglePlace,
  importSinglePlace,
  validateSinglePlaceBackup,
  getSinglePlaceTemplate,
} from '@/services/database'
import type { PlanType, Place } from '@/types'
import type { PlaceDetails, PlacePrediction } from '@/services/placesAutocomplete'

const planTypes: Array<PlanType | 'all'> = ['all', 'attraction', 'restaurant', 'hotel', 'transport', 'car', 'plane', 'airport', 'other']

export function PlaceLibrary() {
  const _places = usePlaces()
  const isLoading = usePlaceLoading()
  const { searchQuery, filterType, sortBy, sortOrder, setSearchQuery, setFilterType, setSortBy, setSortOrder, getFilteredPlaces, toggleFavorite, deletePlace, addPlace, updatePlace } = usePlaceStore()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPlaceId, setEditingPlaceId] = useState<number | null>(null)

  const [placeToDelete, setPlaceToDelete] = useState<Place | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [geminiInput, setGeminiInput] = useState('')
  const [showManualCoords, setShowManualCoords] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'attraction' as PlanType,
    address: '',
    memo: '',
    mapUrl: '',
    website: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    rating: undefined as number | undefined,
    googlePlaceId: undefined as string | undefined,
    audioScript: '',
    photos: [] as string[],
    googleInfo: undefined as any,
  })

  const filteredPlaces = getFilteredPlaces()

  const handleCopyJSON = () => {
    const json = JSON.stringify(formData, null, 2)
    navigator.clipboard.writeText(json)
    toast.success('JSON데이터가 복사되었습니다')
  }

  const handleExtractInfo = async () => {
    if (!formData.mapUrl) {
      toast.error('지도 URL을 입력해주세요')
      return
    }
    if (!isGoogleMapsUrl(formData.mapUrl)) {
      toast.error('Google Maps URL만 지원합니다')
      return
    }

    setIsExtracting(true)
    try {
      const extracted = await extractPlaceInfo(formData.mapUrl)
      setFormData((prev) => ({
        ...prev,
        name: extracted.placeName || prev.name,
        address: extracted.address || prev.address,
        website: extracted.website || prev.website,
        latitude: extracted.latitude,
        longitude: extracted.longitude,
        rating: extracted.googleInfo.rating,
        googlePlaceId: extracted.googleInfo.placeId,
        googleInfo: extracted.googleInfo,
        memo: extracted.googleInfo.openingHours
          ? (prev.memo ? prev.memo + '\n\n' : '') + '[영업 시간]\n' + extracted.googleInfo.openingHours.join('\n')
          : prev.memo
      }))
      toast.success('장소 정보를 추출했습니다')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '정보 추출 실패')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSmartPaste = () => {
    if (!geminiInput.trim()) return

    const lines = geminiInput.split('\n')
    const updates: Partial<typeof formData> = {}
    const openingHoursList: string[] = []
    const descriptionLines: string[] = []
    const structuredFields = ['공식명칭:', '주소:', '웹사이트:', '연락처:', '운영시간:', '평점:', '카테고리:', '위치:']

    let currentSection = ''

    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) {
        if (currentSection === 'description') {
          descriptionLines.push('')
        }
        return
      }

      if (trimmed.startsWith('공식명칭:')) {
        updates.name = trimmed.replace('공식명칭:', '').trim()
        currentSection = 'structured'
      } else if (trimmed.startsWith('주소:') || trimmed.startsWith('위치:')) {
        updates.address = trimmed.replace(/^(주소|위치):/, '').trim()
        currentSection = 'structured'
      } else if (trimmed.startsWith('웹사이트:')) {
        const website = trimmed.replace('웹사이트:', '').trim()
        updates.website = website.startsWith('http') ? website : `https://${website}`
        currentSection = 'structured'
      } else if (trimmed.startsWith('운영시간:')) {
        openingHoursList.push(trimmed.replace('운영시간:', '').trim())
        currentSection = 'structured'
      } else if (trimmed.startsWith('평점:')) {
        const ratingMatch = trimmed.match(/(\d+\.?\d*)\//)
        if (ratingMatch) {
          updates.rating = Number.parseFloat(ratingMatch[1])
        }
        currentSection = 'structured'
      } else {
        const isStructuredField = structuredFields.some(field => trimmed.startsWith(field))
        if (!isStructuredField) {
          currentSection = 'description'
          descriptionLines.push(trimmed)
        }
      }
    })

    const description = descriptionLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (description) {
      updates.memo = description
    }

    setFormData(prev => ({
      ...prev,
      ...updates,
    }))

    toast.success('Gemini 정보가 적용되었습니다')
    setGeminiInput('')
  }

  const handleOpenAddDialog = () => {
    setEditingPlaceId(null)
    setFormData({
      name: '',
      type: 'attraction',
      address: '',
      memo: '',
      mapUrl: '',
      website: '',
      latitude: undefined,
      longitude: undefined,
      rating: undefined,
      googlePlaceId: undefined,
      audioScript: '',
      photos: [],
      googleInfo: undefined,
    })
    setIsDialogOpen(true)
  }

  const handleEditClick = (place: Place) => {
    setEditingPlaceId(place.id || null)
    setFormData({
      name: place.name,
      type: place.type,
      address: place.address || '',
      memo: place.memo || '',
      mapUrl: place.mapUrl || '',
      website: place.website || '',
      latitude: place.latitude,
      longitude: place.longitude,
      rating: place.rating,
      googlePlaceId: place.googlePlaceId,
      audioScript: place.audioScript || '',
      photos: place.photos || [],
      googleInfo: undefined,
    })
    setIsDialogOpen(true)
  }

  const handleSavePlace = async () => {
    if (!formData.name.trim()) {
      toast.error('장소 이름을 입력해주세요')
      return
    }

    try {
      if (editingPlaceId) {
        await updatePlace(editingPlaceId, formData)
        toast.success('장소가 수정되었습니다')
      } else {
        await addPlace(formData)
        toast.success('장소가 추가되었습니다')
      }
      setIsDialogOpen(false)
    } catch {
      toast.error(editingPlaceId ? '장소 수정 실패' : '장소 추가 실패')
    }
  }

  const handleDeletePlace = async () => {
    if (placeToDelete?.id) {
      await deletePlace(placeToDelete.id)
      toast.success('장소가 삭제되었습니다')
    }
    setPlaceToDelete(null)
  }

  // 장소 내보내기 (편집 모드에서만)
  const handleExportPlace = async () => {
    if (!editingPlaceId) return
    setIsExporting(true)
    try {
      const data = await exportSinglePlace(editingPlaceId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (formData.name || 'place').replace(/[^a-zA-Z0-9가-힣]/g, '_')
      a.download = `place-${safeName}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('장소가 내보내기되었습니다')
    } catch {
      toast.error('내보내기 실패')
    } finally {
      setIsExporting(false)
    }
  }

  // 파일에서 장소 가져오기
  const handleImportPlace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const validation = validateSinglePlaceBackup(data)
      if (!validation.valid) {
        toast.error(validation.error || '유효하지 않은 파일입니다')
        return
      }

      await importSinglePlace(data)
      toast.success('장소가 가져오기되었습니다')
      setIsDialogOpen(false)
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('파일 형식이 올바르지 않습니다 (JSON 파싱 오류)')
      } else {
        toast.error('가져오기 실패')
      }
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  // 템플릿 다운로드
  const handleDownloadPlaceTemplate = () => {
    const template = getSinglePlaceTemplate()
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'place-template.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('템플릿이 다운로드되었습니다')
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton height={48} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="rectangular" height={120} />
            ))}
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">장소 라이브러리</h1>
            <p className="text-sm text-zinc-500 mt-1">자주 가는 장소를 저장하고 관리하세요</p>
          </div>
          <Button color="primary" leftIcon={<Plus className="size-4" />} onClick={handleOpenAddDialog}>
            장소 추가
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="장소 검색..."
              value={searchQuery}
              onChange={(value) => setSearchQuery(value)}
              leftIcon={<Search className="size-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PlaceSortBy)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-0 outline-none cursor-pointer transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <option value="name">이름순</option>
              <option value="date">최신순</option>
              <option value="usage">사용순</option>
              <option value="rating">평점순</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label={sortOrder === 'asc' ? '내림차순으로 변경' : '오름차순으로 변경'}
              title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
            >
              <ArrowUpDown className={`size-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {planTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterType === type
                ? 'bg-primary-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
            >
              {type === 'all' ? '전체' : PLAN_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Places Grid */}
        {filteredPlaces.length === 0 ? (
          <Card padding="lg" className="text-center">
            <div className="py-8 max-w-sm mx-auto">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-primary-100 dark:bg-primary-950/50 rounded-full" />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-10 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                {searchQuery || filterType !== 'all' ? '검색 결과가 없습니다' : '저장된 장소가 없습니다'}
              </h3>
              <p className="text-zinc-500 mb-6 text-sm">
                {searchQuery || filterType !== 'all'
                  ? '다른 키워드로 검색해보세요'
                  : '자주 가는 장소를 추가하고 일정에 빠르게 활용하세요'}
              </p>
              {!searchQuery && filterType === 'all' && (
                <Button color="primary" leftIcon={<Plus className="size-4" />} onClick={handleOpenAddDialog}>
                  장소 추가
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlaces.map((place) => (
              <Card key={place.id} padding="md" className="group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <PlanTypeBadge type={place.type} />
                      {place.isFavorite && (
                        <Star className="size-4 fill-warning-400 text-warning-400" />
                      )}
                      {place.createdAt && (Date.now() - new Date(place.createdAt).getTime()) < 5 * 60 * 1000 && (
                        <span className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full animate-pulse">
                          방금 등록됨
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-[var(--foreground)] truncate">{place.name}</h3>
                    {place.address && (
                      <p className="text-sm text-zinc-500 mt-1 truncate">{place.address}</p>
                    )}
                    {place.memo && (
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{place.memo}</p>
                    )}
                    <p className="text-xs text-zinc-400 mt-2">
                      사용 횟수: {place.usageCount}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-center self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <IconButton
                      plain
                      color={place.isFavorite ? 'warning' : 'secondary'}
                      size="xs"
                      onClick={() => place.id && toggleFavorite(place.id)}
                      aria-label={place.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                    >
                      <Star className={`size-4 ${place.isFavorite ? 'fill-current' : ''}`} />
                    </IconButton>
                    <IconButton
                      plain
                      color="primary"
                      size="xs"
                      onClick={() => handleEditClick(place)}
                      aria-label="수정"
                    >
                      <Edit className="size-4" />
                    </IconButton>
                    <IconButton
                      plain
                      color="danger"
                      size="xs"
                      onClick={() => setPlaceToDelete(place)}
                      aria-label="삭제"
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Place Dialog */}
        <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
              {editingPlaceId ? '장소 수정' : '새 장소 추가'}
            </h2>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {editingPlaceId && (
                <Button
                  type="button"
                  color="secondary"
                  outline
                  size="sm"
                  leftIcon={<Download className="size-4" />}
                  onClick={handleExportPlace}
                  isLoading={isExporting}
                >
                  <span className="hidden sm:inline">내보내기</span>
                </Button>
              )}
              <label>
                <Button
                  type="button"
                  color="secondary"
                  outline
                  size="sm"
                  leftIcon={<Upload className="size-4" />}
                  as="span"
                  isLoading={isImporting}
                >
                  <span className="hidden sm:inline">가져오기</span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportPlace}
                />
              </label>
              <Button
                type="button"
                color="secondary"
                plain
                size="sm"
                leftIcon={<FileJson className="size-4" />}
                onClick={handleDownloadPlaceTemplate}
              >
                <span className="hidden sm:inline">템플릿</span>
              </Button>
              <IconButton
                plain
                color="secondary"
                onClick={() => setIsDialogOpen(false)}
                aria-label="닫기"
                className="-mr-2"
              >
                <X className="size-5" />
              </IconButton>
            </div>
          </div>
          <DialogBody className="space-y-6">
            {/* Map URL */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    label="지도 URL"
                    value={formData.mapUrl}
                    onChange={(value) => setFormData((prev) => ({ ...prev, mapUrl: value }))}
                    placeholder="Google Maps URL (maps.app.goo.gl/...)"
                    leftIcon={<MapPin className="size-4" />}
                  />
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <Button
                    type="button"
                    color="primary"
                    size="sm"
                    onClick={handleExtractInfo}
                    disabled={!formData.mapUrl || isExtracting}
                    leftIcon={
                      isExtracting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )
                    }
                  >
                    {isExtracting ? '추출 중...' : '정보 추출'}
                  </Button>
                  <Button
                    type="button"
                    color="secondary"
                    outline
                    size="sm"
                    onClick={handleCopyJSON}
                    disabled={!formData.mapUrl}
                    className="ml-2"
                    leftIcon={<Copy className="size-4" />}
                  >
                    JSON 복사
                  </Button>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Google Maps URL을 입력하고 "정보 추출"을 클릭하면 장소 정보를 자동으로 가져옵니다
              </p>

              {/* 추출된 좌표 표시 */}
              {(formData.latitude && formData.longitude) && (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      📍 추출된 좌표
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      위도: {formData.latitude?.toFixed(6)}
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      경도: {formData.longitude?.toFixed(6)}
                    </span>
                  </div>
                </div>
              )}

              {/* 수동 좌표 입력 토글 */}
              <button
                type="button"
                onClick={() => setShowManualCoords(!showManualCoords)}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                {showManualCoords ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                좌표 직접 입력
              </button>
              {showManualCoords && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="위도 (Latitude)"
                      type="number"
                      step="any"
                      value={formData.latitude?.toString() || ''}
                      onChange={(value) => setFormData((prev) => ({
                        ...prev,
                        latitude: value ? parseFloat(value) : undefined
                      }))}
                      placeholder="예: 37.5665"
                    />
                    <Input
                      label="경도 (Longitude)"
                      type="number"
                      step="any"
                      value={formData.longitude?.toString() || ''}
                      onChange={(value) => setFormData((prev) => ({
                        ...prev,
                        longitude: value ? parseFloat(value) : undefined
                      }))}
                      placeholder="예: 126.9780"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Gemini Gem Integration */}
            <div className="space-y-2 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <Label className="text-purple-700 dark:text-purple-300">Gemini 장소 가이드</Label>
                <a
                  href="https://gemini.google.com/gem/1sJ4ixxslCiVSVAeeH2mvkGwpxWG0b06g?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  <Sparkles className="size-4" />
                  Gemini Gem 열기
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <Textarea
                value={geminiInput}
                onChange={(value) => setGeminiInput(value)}
                placeholder="Gemini에서 생성된 장소 가이드를 여기에 붙여넣으세요..."
                rows={4}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                  공식명칭, 주소, 웹사이트가 자동으로 추출됩니다
                </p>
                <Button
                  type="button"
                  color="secondary"
                  size="sm"
                  onClick={handleSmartPaste}
                  disabled={!geminiInput.trim()}
                  leftIcon={<Sparkles className="size-4" />}
                >
                  정보 적용
                </Button>
              </div>
            </div>

            {/* Place Name */}
            <Input
              label="장소 이름"
              value={formData.name}
              onChange={(value) => setFormData((prev) => ({ ...prev, name: value }))}
              placeholder="예: 스타벅스 강남점"
              required
            />

            {/* Type */}
            <div>
              <Label>유형</Label>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {planTypes.filter((t): t is PlanType => t !== 'all').map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${formData.type === type
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      } min-w-[4.5rem] flex justify-center whitespace-nowrap`}
                  >
                    {PLAN_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Places Autocomplete (Address) */}
            <PlacesAutocomplete
              label="주소 검색"
              placeholder="장소 이름 또는 주소 검색..."
              value={formData.address}
              onChange={(value) => setFormData((prev) => ({ ...prev, address: value }))}
              localPlaces={_places}
              onPlaceSelect={(details: PlaceDetails, prediction: PlacePrediction) => {
                const detectedType = detectPlanType(details.name) || detectPlanType(details.category || '')

                setFormData((prev) => ({
                  ...prev,
                  name: prev.name || details.name,
                  address: details.address,
                  latitude: details.latitude,
                  longitude: details.longitude,
                  website: details.website || prev.website,
                  rating: details.rating,
                  googlePlaceId: prediction.placeId,
                  type: detectedType || prev.type,
                }))

                if (detectedType) {
                  toast.success(`"${PLAN_TYPE_LABELS[detectedType]}"(으)로 분류했습니다`)
                }
              }}
            />

            <Input
              label="웹사이트"
              value={formData.website}
              onChange={(value) => setFormData((prev) => ({ ...prev, website: value }))}
              placeholder="https://"
              leftIcon={<Globe className="size-4" />}
            />

            {/* Memo */}
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea
                value={formData.memo}
                onChange={(value) => setFormData((prev) => ({ ...prev, memo: value }))}
                placeholder="메모 입력 (선택)"
                rows={3}
              />
            </div>

            {/* Moonyou Guide Audio Script */}
            <div className="space-y-2 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-emerald-700 dark:text-emerald-300">Moonyou Guide 음성 스크립트</Label>
                </div>
              </div>
              <Textarea
                value={formData.audioScript || ''}
                onChange={(value) => setFormData((prev) => ({ ...prev, audioScript: value }))}
                placeholder="Moonyou Guide 대본을 입력하세요..."
                rows={4}
              />
            </div>

          </DialogBody>
          <DialogActions>
            <Button color="secondary" onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button color="primary" onClick={handleSavePlace}>
              {editingPlaceId ? '수정' : '추가'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Place Dialog */}
        <Dialog open={placeToDelete !== null} onClose={() => setPlaceToDelete(null)}>
          <DialogTitle onClose={() => setPlaceToDelete(null)}>장소 삭제</DialogTitle>
          <DialogBody>
            <p className="text-zinc-600 dark:text-zinc-400">
              "{placeToDelete?.name}" 장소를 삭제하시겠습니까?
            </p>
          </DialogBody>
          <DialogActions>
            <Button color="secondary" onClick={() => setPlaceToDelete(null)}>
              취소
            </Button>
            <Button color="danger" onClick={handleDeletePlace}>
              삭제
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </PageContainer>
  )
}
