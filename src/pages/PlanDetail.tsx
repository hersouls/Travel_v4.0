import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
    ArrowLeft,
    Edit,
    MapPin,
    Clock,
    Globe,
    Youtube,
    ExternalLink,
    Star,
    Phone,
    Calendar,
    Camera,
    Utensils,
    Bed,
    Bus,
    Car,
    Plane,
    PlaneTakeoff,
    MapPin as DefaultMapPin,
    Volume2,
    FileText,
    Sparkles,
    type LucideIcon
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { AudioPlayer } from '@/components/audio'
import { MemoRenderer } from '@/components/memo'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge, PlanTypeBadge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { AIGuideGenerator, AIMemoGenerator } from '@/components/ai'
import { useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/uiStore'
import { formatTime } from '@/utils/format'
import { formatReviewCount } from '@/services/googleMaps'
import { PLAN_TYPE_ICONS } from '@/utils/constants'
import type { PlanType } from '@/types'
import { StreetViewThumbnail } from '@/components/map/StreetViewThumbnail'
import { NearbyPlacesPanel } from '@/components/map/NearbyPlacesPanel'
import { getPlacePhotos, type PlacePhoto } from '@/services/placePhotosService'
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader'

const iconMap: Record<string, LucideIcon> = {
    Camera,
    Utensils,
    Bed,
    Bus,
    Car,
    Plane,
    PlaneTakeoff,
    MapPin: DefaultMapPin,
}

export function PlanDetail() {
    const { tripId, planId } = useParams<{ tripId: string; planId: string }>()
    const navigate = useNavigate()

    const loadTrip = useTripStore((state) => state.loadTrip)
    const addPlan = useTripStore((state) => state.addPlan)
    const updatePlan = useTripStore((state) => state.updatePlan)
    const currentTrip = useTripStore((state) => state.currentTrip)
    const plans = useCurrentPlans()
    const isLoading = useTripLoading()
    const claudeEnabled = useSettingsStore((state) => state.claudeEnabled)

    // Find the current plan from the store
    const plan = plans.find((p) => p.id === parseInt(planId || '0'))

    const [googlePhotos, setGooglePhotos] = useState<PlacePhoto[]>([])
    const [isGuideDialogOpen, setIsGuideDialogOpen] = useState(false)
    const [isMemoDialogOpen, setIsMemoDialogOpen] = useState(false)

    // Fetch Google Place photos
    useEffect(() => {
        if (plan?.googlePlaceId) {
            getPlacePhotos(plan.googlePlaceId, 6).then(setGooglePhotos)
        }
    }, [plan?.googlePlaceId])

    // Check Street View availability
    const [isStreetViewAvailable, setIsStreetViewAvailable] = useState<boolean>(false)
    const { isLoaded: isGoogleMapsLoaded } = useGoogleMapsLoader()

    useEffect(() => {
        if (!plan?.latitude || !plan?.longitude || !isGoogleMapsLoaded) {
            return
        }

        const svService = new google.maps.StreetViewService()
        svService.getPanorama(
            { location: { lat: plan.latitude, lng: plan.longitude }, radius: 50 },
            (data, status) => {
                setIsStreetViewAvailable(status === google.maps.StreetViewStatus.OK)
            }
        )
    }, [plan?.latitude, plan?.longitude, isGoogleMapsLoaded])

    useEffect(() => {
        if (tripId) {
            loadTrip(parseInt(tripId))
        }
    }, [tripId, loadTrip])

    // Get icon for the plan type
    const getPlanIcon = (type: PlanType) => {
        const iconName = PLAN_TYPE_ICONS[type] || 'MapPin'
        return iconMap[iconName] || DefaultMapPin
    }

    if (isLoading) {
        return (
            <PageContainer maxWidth="lg" noPadding>
                <div className="px-4 sm:px-6 lg:px-8 space-y-6">
                    <Skeleton height={200} className="rounded-xl" />
                    <Skeleton height={400} className="rounded-xl" />
                </div>
            </PageContainer>
        )
    }

    if (!plan) {
        return (
            <PageContainer maxWidth="lg">
                <Card padding="lg" className="text-center mt-10">
                    <MapPin className="size-12 mx-auto text-zinc-300 mb-4" />
                    <h2 className="text-lg font-semibold mb-2">일정을 찾을 수 없습니다</h2>
                    <Button to={`/trips/${tripId}`} color="primary">
                        여행 상세로 돌아가기
                    </Button>
                </Card>
            </PageContainer>
        )
    }

    const PlanIcon = getPlanIcon(plan.type)
    const hasGoogleInfo = plan.googleInfo && (plan.googleInfo.rating || plan.googleInfo.phone)

    // Embed YouTube video if link exists
    const getEmbedUrl = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
        const match = url.match(regExp)
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null
    }

    return (
        <PageContainer maxWidth="lg" noPadding className="animate-fade-in">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--background)]/80 backdrop-blur-md z-10 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/5 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기" className="flex-shrink-0">
                        <ArrowLeft className="size-5" />
                    </IconButton>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl font-bold text-[var(--foreground)] truncate pr-2">
                            {plan.placeName}
                        </h1>
                        <p className="text-sm text-zinc-500 truncate">
                            Day {plan.day} · {formatTime(plan.startTime)} {plan.endTime && `- ${formatTime(plan.endTime)}`}
                        </p>
                    </div>
                </div>
                <Button
                    to="edit"
                    color="primary"
                    size="sm"
                    className="flex-shrink-0 ml-2"
                    leftIcon={<Edit className="size-4" />}
                >
                    편집
                </Button>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-6 pt-6">
                {/* Main Info Card */}
                <Card padding="none" className="overflow-hidden">
                    {/* Type Icon Header */}
                    <div className="p-6 pb-0 flex items-start justify-between">
                        <div className="size-14 rounded-2xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center">
                            <PlanIcon className="size-7 text-primary-600 dark:text-primary-400" />
                        </div>
                        <PlanTypeBadge type={plan.type} size="lg" />
                    </div>

                    <div className="p-6 pt-4 space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-3">
                            <h2 className="text-2xl font-bold text-[var(--foreground)]">
                                {plan.placeName}
                            </h2>

                            {plan.address && (
                                <div className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
                                    <MapPin className="size-5 flex-shrink-0 mt-0.5 text-zinc-400" />
                                    <span>{plan.address}</span>
                                </div>
                            )}

                            {/* Google Info (Rating, Category, Phone) */}
                            {hasGoogleInfo && (
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                    {plan.googleInfo?.rating && (
                                        <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                                            <Star className="size-4 fill-current" />
                                            <span>{plan.googleInfo.rating.toFixed(1)}</span>
                                            {plan.googleInfo.reviewCount && (
                                                <span className="text-zinc-400 font-normal">
                                                    ({formatReviewCount(plan.googleInfo.reviewCount)})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {plan.googleInfo?.category && (
                                        <span className="text-zinc-500 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                                            {plan.googleInfo.category}
                                        </span>
                                    )}
                                    {plan.googleInfo?.phone && (
                                        <a
                                            href={`tel:${plan.googleInfo.phone}`}
                                            className="flex items-center gap-1.5 text-zinc-500 hover:text-primary-600 transition-colors"
                                        >
                                            <Phone className="size-4" />
                                            <span>{plan.googleInfo.phone}</span>
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Opening Hours */}
                            {plan.googleInfo?.openingHours && plan.googleInfo.openingHours.length > 0 && (
                                <div className="pt-2">
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-sm">
                                        <div className="flex items-center gap-2 mb-2 text-zinc-700 dark:text-zinc-300 font-medium">
                                            <Clock className="size-4" />
                                            <span>영업 시간</span>
                                        </div>
                                        <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 pl-6 list-disc">
                                            {plan.googleInfo.openingHours.map((hour: string, i: number) => (
                                                <li key={i}>{hour}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Links */}
                        {(plan.website || plan.mapUrl || plan.googleInfo?.website) && (
                            <div className="flex gap-2 pt-2">
                                {(plan.website || plan.googleInfo?.website) && (
                                    <a
                                        href={plan.website || plan.googleInfo?.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-transparent border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <Globe className="size-4" />
                                        웹사이트
                                    </a>
                                )}
                                {plan.mapUrl && (
                                    <a
                                        href={plan.mapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-transparent border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <MapPin className="size-4" />
                                        Google 지도
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Memo */}
                {(plan.memo || claudeEnabled) && (
                    <Card padding="lg">
                        <CardHeader
                            title="메모"
                            icon={<FileText className="size-5 text-blue-500" />}
                            action={claudeEnabled ? (
                                <Button
                                    size="xs"
                                    outline
                                    color="primary"
                                    leftIcon={<Sparkles className="size-3" />}
                                    onClick={() => setIsMemoDialogOpen(true)}
                                >
                                    AI 메모
                                </Button>
                            ) : undefined}
                        />
                        <CardContent>
                            {plan.memo ? (
                                <MemoRenderer content={plan.memo} />
                            ) : (
                                <p className="text-sm text-zinc-400 text-center py-4">메모가 없습니다. AI로 생성해보세요.</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Photos */}
                {plan.photos && plan.photos.length > 0 && (
                    <Card padding="lg">
                        <CardHeader title={`사진 (${plan.photos.length})`} icon={<Camera className="size-5" />} />
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {plan.photos.map((photo: string, index: number) => (
                                    <div key={index} className="aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                        <img
                                            src={photo}
                                            alt={`${plan.placeName} photo ${index + 1}`}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                            onClick={() => window.open(photo, '_blank')}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Google Place Photos */}
                {googlePhotos.length > 0 && (
                    <Card padding="lg">
                        <CardHeader title={`Google 사진 (${googlePhotos.length})`} icon={<Camera className="size-5 text-blue-500" />} />
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {googlePhotos.map((photo, index) => (
                                    <div key={index} className="aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                        <img
                                            src={photo.url}
                                            alt={`Google photo ${index + 1}`}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                            onClick={() => window.open(photo.url, '_blank')}
                                        />
                                    </div>
                                ))}
                            </div>
                            {googlePhotos[0]?.attribution && (
                                <p className="text-xs text-zinc-400 mt-2">{googlePhotos[0].attribution}</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Street View */}
                {plan.latitude && plan.longitude && isStreetViewAvailable && (
                    <Card padding="lg">
                        <CardHeader title="Street View" icon={<MapPin className="size-5 text-green-500" />} />
                        <CardContent>
                            <StreetViewThumbnail
                                latitude={plan.latitude}
                                longitude={plan.longitude}
                                size="lg"
                            />
                        </CardContent>
                    </Card>
                )}

                {/* YouTube Video */}
                {plan.youtubeLink && (
                    <Card padding="lg">
                        <CardHeader title="관련 영상" icon={<Youtube className="size-5 text-red-600" />} />
                        <CardContent>
                            {getEmbedUrl(plan.youtubeLink) ? (
                                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={getEmbedUrl(plan.youtubeLink)!}
                                        title="YouTube video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : (
                                <a
                                    href={plan.youtubeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-600 hover:text-primary-600 transition-colors"
                                >
                                    <Youtube className="size-5" />
                                    <span className="truncate">{plan.youtubeLink}</span>
                                    <ExternalLink className="size-4 ml-auto" />
                                </a>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Moonyou Guide Audio */}
                {(plan.audioScript || claudeEnabled) && (
                    <Card padding="lg">
                        <CardHeader
                            title="Moonyou Guide"
                            icon={<Volume2 className="size-5 text-emerald-600" />}
                            action={claudeEnabled ? (
                                <Button
                                    size="xs"
                                    outline
                                    color="primary"
                                    leftIcon={<Sparkles className="size-3" />}
                                    onClick={() => setIsGuideDialogOpen(true)}
                                >
                                    AI 생성
                                </Button>
                            ) : undefined}
                        />
                        <CardContent>
                            {plan.audioScript ? (
                                <AudioPlayer text={plan.audioScript} />
                            ) : (
                                <p className="text-sm text-zinc-400 text-center py-4">음성 가이드가 없습니다. AI로 생성해보세요.</p>
                            )}
                        </CardContent>
                    </Card>
                )}
                {/* Nearby Recommendations */}
                {plan.latitude && plan.longitude && (
                    <NearbyPlacesPanel
                        latitude={plan.latitude}
                        longitude={plan.longitude}
                        className="px-0"
                        onAddPlace={async (nearbyPlace) => {
                            try {
                                await addPlan({
                                    tripId: parseInt(tripId!),
                                    day: plan.day,
                                    placeName: nearbyPlace.name,
                                    address: nearbyPlace.address || '',
                                    latitude: nearbyPlace.latitude,
                                    longitude: nearbyPlace.longitude,
                                    googlePlaceId: nearbyPlace.placeId,
                                    startTime: plan.endTime || plan.startTime,
                                    endTime: '',
                                    type: 'attraction' as const,
                                    photos: [],
                                    order: plans.filter((p) => p.day === plan.day).length,
                                })
                                toast.success(`"${nearbyPlace.name}" Day ${plan.day}에 추가됨`)
                            } catch {
                                toast.error('일정 추가에 실패했습니다')
                            }
                        }}
                    />
                )}
            </div>

            {/* AI Dialogs */}
            {claudeEnabled && plan && currentTrip && (
                <>
                    <AIGuideGenerator
                        open={isGuideDialogOpen}
                        onClose={() => setIsGuideDialogOpen(false)}
                        plan={plan}
                        trip={currentTrip}
                        onApply={async (script) => {
                            await updatePlan(plan.id!, { audioScript: script })
                            toast.success('AI 가이드가 적용되었습니다')
                        }}
                    />
                    <AIMemoGenerator
                        open={isMemoDialogOpen}
                        onClose={() => setIsMemoDialogOpen(false)}
                        plan={plan}
                        country={currentTrip.country}
                        mode={plan.memo ? 'append' : 'replace'}
                        onApply={async (memo) => {
                            await updatePlan(plan.id!, { memo })
                            toast.success('AI 메모가 적용되었습니다')
                        }}
                    />
                </>
            )}
        </PageContainer>
    )
}
