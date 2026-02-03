import type { PlanType } from '@/types'

// 키워드 기반 타입 자동 추천 매핑
export const typeKeywords: Record<PlanType, string[]> = {
    restaurant: ['식당', '레스토랑', '카페', '맛집', '음식', 'food', 'cafe', 'restaurant', 'coffee', '커피', '베이커리', '빵집', '라멘', '스시', '초밥', '우동', '돈부리', '이자카야', '야키토리', '디저트'],
    hotel: ['호텔', '숙소', '리조트', '펜션', '게스트하우스', 'hotel', 'resort', 'airbnb', '료칸', '민박', '모텔', 'hostel', '호스텔', 'inn'],
    attraction: ['관광', '박물관', '공원', '타워', '성', '궁', 'temple', 'museum', 'park', 'tower', '신사', '사찰', '절', '미술관', '전망대', '동물원', '수족관', '테마파크', '유적지', '명소'],
    transport: ['역', '버스', '지하철', 'station', 'terminal', '터미널', '정류장', '전철', '기차'],
    airport: ['공항', 'airport', '인천공항', '나리타', '하네다', '간사이', '후쿠오카'],
    plane: ['항공', '비행', 'flight', '대한항공', '아시아나', 'JAL', 'ANA'],
    car: ['렌트카', '렌터카', 'rent', 'car', '자동차', '드라이브'],
    other: [],
}

export function detectPlanType(text: string): PlanType | null {
    if (!text) return null
    const lowerText = text.toLowerCase()
    for (const [type, keywords] of Object.entries(typeKeywords) as [PlanType, string[]][]) {
        if (type === 'other') continue
        for (const keyword of keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                return type
            }
        }
    }
    return null
}
