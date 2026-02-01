import { useState } from 'react'
import { Search, Plus, Star, MapPin, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { PlanTypeBadge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePlaceStore, usePlaces, usePlaceLoading } from '@/stores/placeStore'
import { toast } from '@/stores/uiStore'
import { PLAN_TYPE_LABELS } from '@/utils/constants'
import type { PlanType, Place } from '@/types'

const planTypes: Array<PlanType | 'all'> = ['all', 'attraction', 'restaurant', 'hotel', 'transport', 'car', 'plane', 'airport', 'other']

export function PlaceLibrary() {
  const _places = usePlaces()
  const isLoading = usePlaceLoading()
  const { searchQuery, filterType, setSearchQuery, setFilterType, getFilteredPlaces, toggleFavorite, deletePlace, addPlace } = usePlaceStore()

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [placeToDelete, setPlaceToDelete] = useState<Place | null>(null)
  const [newPlace, setNewPlace] = useState({
    name: '',
    type: 'attraction' as PlanType,
    address: '',
    memo: '',
  })

  const filteredPlaces = getFilteredPlaces()

  const handleAddPlace = async () => {
    if (!newPlace.name.trim()) {
      toast.error('장소 이름을 입력해주세요')
      return
    }

    try {
      await addPlace(newPlace)
      toast.success('장소가 추가되었습니다')
      setIsAddDialogOpen(false)
      setNewPlace({ name: '', type: 'attraction', address: '', memo: '' })
    } catch {
      toast.error('장소 추가 실패')
    }
  }

  const handleDeletePlace = async () => {
    if (placeToDelete?.id) {
      await deletePlace(placeToDelete.id)
      toast.success('장소가 삭제되었습니다')
    }
    setPlaceToDelete(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton height={48} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="rectangular" height={120} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">장소 라이브러리</h1>
          <p className="text-sm text-zinc-500 mt-1">자주 가는 장소를 저장하고 관리하세요</p>
        </div>
        <Button color="primary" leftIcon={<Plus className="size-4" />} onClick={() => setIsAddDialogOpen(true)}>
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
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {planTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterType === type
                  ? 'bg-primary-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {type === 'all' ? '전체' : PLAN_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Places Grid */}
      {filteredPlaces.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="py-8">
            <MapPin className="size-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {searchQuery || filterType !== 'all' ? '검색 결과가 없습니다' : '저장된 장소가 없습니다'}
            </h3>
            <p className="text-zinc-500 mb-6">
              {searchQuery || filterType !== 'all'
                ? '다른 조건으로 검색해보세요'
                : '자주 가는 장소를 추가해보세요!'}
            </p>
            {!searchQuery && filterType === 'all' && (
              <Button color="primary" leftIcon={<Plus className="size-4" />} onClick={() => setIsAddDialogOpen(true)}>
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
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Add Place Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)}>
        <DialogTitle onClose={() => setIsAddDialogOpen(false)}>새 장소 추가</DialogTitle>
        <DialogBody className="space-y-4">
          <Input
            label="장소 이름"
            value={newPlace.name}
            onChange={(value) => setNewPlace((prev) => ({ ...prev, name: value }))}
            placeholder="예: 스타벅스 강남점"
            required
          />
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              유형
            </label>
            <div className="flex flex-wrap gap-2">
              {(['attraction', 'restaurant', 'hotel', 'transport', 'other'] as PlanType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewPlace((prev) => ({ ...prev, type }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    newPlace.type === type
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {PLAN_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="주소"
            value={newPlace.address}
            onChange={(value) => setNewPlace((prev) => ({ ...prev, address: value }))}
            placeholder="주소 입력 (선택)"
          />
          <Input
            label="메모"
            value={newPlace.memo}
            onChange={(value) => setNewPlace((prev) => ({ ...prev, memo: value }))}
            placeholder="메모 입력 (선택)"
          />
        </DialogBody>
        <DialogActions>
          <Button color="secondary" onClick={() => setIsAddDialogOpen(false)}>
            취소
          </Button>
          <Button color="primary" onClick={handleAddPlace}>
            추가
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
  )
}
