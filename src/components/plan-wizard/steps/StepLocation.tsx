// ============================================
// StepLocation — 2단계: 분류 & 위치 (선택)
// 유형 그리드 · 주소 · 지도(선택) · 좌표 · mapUrl · 영업시간 · website · googleInfo
// ============================================

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { MapLocationPicker } from '@/components/ui/MapLocationPicker'
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete'
import { toast } from '@/stores/uiStore'
import { detectPlanType } from '@/utils/place'
import {
  ChevronDown,
  Clock3,
  Globe,
  Loader2,
  Map as MapIcon,
  MapPin,
  Sparkles,
  Star,
} from 'lucide-react'
import { useState } from 'react'
import { PlanTypePicker } from '../PlanTypePicker'
import type { StepProps } from '../types'

// 국가 → 대략 지도 초기 중심 (좌표 없을 때)
const COUNTRY_CENTER: Record<string, { lat: number; lng: number }> = {
  일본: { lat: 35.6762, lng: 139.6503 },
  대한민국: { lat: 37.5665, lng: 126.978 },
  프랑스: { lat: 48.8566, lng: 2.3522 },
  미국: { lat: 40.7128, lng: -74.006 },
  태국: { lat: 13.7563, lng: 100.5018 },
}

function coordError(v: number | undefined, kind: 'lat' | 'lng'): string | undefined {
  if (v === undefined) return undefined
  if (kind === 'lat' && (v < -90 || v > 90)) return '위도는 -90 ~ 90 사이여야 합니다'
  if (kind === 'lng' && (v < -180 || v > 180)) return '경도는 -180 ~ 180 사이여야 합니다'
  return undefined
}

export function StepLocation({ ctx }: StepProps) {
  const { data, update, applyPlaceSelection, localPlaces, currentTrip } = ctx
  const [showMap, setShowMap] = useState(false)
  const [showManualCoords, setShowManualCoords] = useState(false)

  const recommended = !ctx.typeManuallyChanged ? detectPlanType(data.placeName) : null
  const gi = data.googleInfo
  const latErr = coordError(data.latitude, 'lat')
  const lngErr = coordError(data.longitude, 'lng')

  const mapCenter =
    data.latitude !== undefined && data.longitude !== undefined
      ? { lat: data.latitude, lng: data.longitude }
      : currentTrip
        ? COUNTRY_CENTER[currentTrip.country]
        : undefined

  return (
    <div className="space-y-5">
      {/* 유형 */}
      <div>
        <Label className="mb-2 block">유형</Label>
        <PlanTypePicker
          value={data.type}
          recommended={recommended}
          onChange={(type) => {
            update({ type })
            ctx.setTypeManuallyChanged(true)
          }}
        />
      </div>

      {/* 주소 */}
      <PlacesAutocomplete
        label="주소 / 장소 검색"
        placeholder="주소 또는 장소 이름 검색..."
        value={data.address}
        onChange={(value) => update({ address: value })}
        localPlaces={localPlaces}
        onPlaceSelect={applyPlaceSelection}
      />

      {/* 추출된 좌표 표시 */}
      {data.latitude !== undefined && data.longitude !== undefined && !latErr && !lngErr && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">📍 좌표</span>
            <span className="text-sm tabular-nums text-blue-600 dark:text-blue-400">
              {data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}
            </span>
          </div>
          <Button
            type="button"
            size="xs"
            outline
            color="primary"
            onClick={() => {
              navigator.clipboard.writeText(`${data.latitude}, ${data.longitude}`)
              toast.success('좌표가 복사되었습니다')
            }}
          >
            복사
          </Button>
        </div>
      )}

      {/* 지도에서 위치 선택 (선택, lazy) */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-expanded={showMap}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300"
        >
          <MapIcon className="size-4 text-primary-500" />
          지도에서 위치 선택
          <ChevronDown
            className={`ml-auto size-4 transition-transform ${showMap ? 'rotate-180' : ''}`}
          />
        </button>
        {showMap && (
          <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
            <MapLocationPicker
              key={ctx.mapResetKey}
              initialCenter={mapCenter}
              height="220px"
              onLocationChange={(loc) => {
                if (!loc) return
                update({
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  address: loc.address || data.address,
                })
              }}
            />
          </div>
        )}
      </div>

      {/* 좌표 직접 입력 (선택) */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setShowManualCoords((v) => !v)}
          aria-expanded={showManualCoords}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300"
        >
          <MapPin className="size-4 text-primary-500" />
          좌표 직접 입력
          <ChevronDown
            className={`ml-auto size-4 transition-transform ${showManualCoords ? 'rotate-180' : ''}`}
          />
        </button>
        {showManualCoords && (
          <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-700">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                label="위도"
                type="number"
                step="any"
                value={data.latitude?.toString() ?? ''}
                onChange={(value) =>
                  update({ latitude: value ? Number.parseFloat(value) : undefined })
                }
                placeholder="예: 37.5665"
                error={latErr}
              />
              <Input
                label="경도"
                type="number"
                step="any"
                value={data.longitude?.toString() ?? ''}
                onChange={(value) =>
                  update({ longitude: value ? Number.parseFloat(value) : undefined })
                }
                placeholder="예: 126.9780"
                error={lngErr}
              />
            </div>
            <p className="text-xs text-zinc-500">
              💡 Google Maps에서 장소 우클릭 → 좌표 복사 후 붙여넣기
            </p>
          </div>
        )}
      </div>

      {/* 지도 URL + 재추출 */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            label="지도 URL"
            className="flex-1"
            value={data.mapUrl}
            onChange={(value) => update({ mapUrl: value })}
            placeholder="Google Maps URL"
            leftIcon={<MapPin className="size-4" />}
          />
          <Button
            type="button"
            color="secondary"
            outline
            size="sm"
            onClick={ctx.handleExtractInfo}
            disabled={!data.mapUrl || ctx.isExtracting}
            leftIcon={
              ctx.isExtracting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )
            }
          >
            재추출
          </Button>
        </div>
      </div>

      {/* 영업시간 · 웹사이트 */}
      <Input
        label="영업시간"
        value={data.openingHours}
        onChange={(value) => update({ openingHours: value })}
        placeholder="예: 09:00 - 18:00"
        leftIcon={<Clock3 className="size-4" />}
      />
      <Input
        label="웹사이트"
        value={data.website}
        onChange={(value) => update({ website: value })}
        placeholder="https://"
        leftIcon={<Globe className="size-4" />}
      />

      {/* googleInfo 배지 */}
      {gi && (gi.rating || gi.category || gi.phone) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {gi.rating !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Star className="size-3.5 fill-current" />
              {gi.rating.toFixed(1)}
              {gi.reviewCount ? (
                <span className="text-amber-600/70">({gi.reviewCount.toLocaleString()})</span>
              ) : null}
            </span>
          )}
          {gi.category && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {gi.category}
            </span>
          )}
          {gi.phone && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {gi.phone}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
