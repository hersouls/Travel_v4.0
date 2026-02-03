// ============================================
// Country Information Data
// ============================================

export interface CountryInfo {
  timezone: string
  currency: string
  visa: string
  plug: string
}

export const COUNTRY_INFO: Record<string, CountryInfo> = {
  '일본': {
    timezone: 'UTC+9 (한국과 동일)',
    currency: 'JPY (¥)',
    visa: '무비자 90일',
    plug: 'A타입 (110V)',
  },
  '태국': {
    timezone: 'UTC+7 (한국 -2시간)',
    currency: 'THB (฿)',
    visa: '무비자 90일',
    plug: 'A/B/C타입 (220V)',
  },
  '베트남': {
    timezone: 'UTC+7 (한국 -2시간)',
    currency: 'VND (₫)',
    visa: '무비자 45일',
    plug: 'A/C타입 (220V)',
  },
  '미국': {
    timezone: 'UTC-5~-10 (다양)',
    currency: 'USD ($)',
    visa: 'ESTA 필요',
    plug: 'A/B타입 (120V)',
  },
  '영국': {
    timezone: 'UTC+0 (한국 -9시간)',
    currency: 'GBP (£)',
    visa: '무비자 6개월',
    plug: 'G타입 (230V)',
  },
  '프랑스': {
    timezone: 'UTC+1 (한국 -8시간)',
    currency: 'EUR (€)',
    visa: '무비자 90일',
    plug: 'C/E타입 (230V)',
  },
  '독일': {
    timezone: 'UTC+1 (한국 -8시간)',
    currency: 'EUR (€)',
    visa: '무비자 90일',
    plug: 'C/F타입 (230V)',
  },
  '이탈리아': {
    timezone: 'UTC+1 (한국 -8시간)',
    currency: 'EUR (€)',
    visa: '무비자 90일',
    plug: 'C/F/L타입 (230V)',
  },
  '스페인': {
    timezone: 'UTC+1 (한국 -8시간)',
    currency: 'EUR (€)',
    visa: '무비자 90일',
    plug: 'C/F타입 (230V)',
  },
  '중국': {
    timezone: 'UTC+8 (한국 -1시간)',
    currency: 'CNY (¥)',
    visa: '비자 필요',
    plug: 'A/C/I타입 (220V)',
  },
  '대만': {
    timezone: 'UTC+8 (한국 -1시간)',
    currency: 'TWD (NT$)',
    visa: '무비자 90일',
    plug: 'A/B타입 (110V)',
  },
  '홍콩': {
    timezone: 'UTC+8 (한국 -1시간)',
    currency: 'HKD (HK$)',
    visa: '무비자 90일',
    plug: 'G타입 (220V)',
  },
  '싱가포르': {
    timezone: 'UTC+8 (한국 -1시간)',
    currency: 'SGD (S$)',
    visa: '무비자 90일',
    plug: 'G타입 (230V)',
  },
  '호주': {
    timezone: 'UTC+8~+11 (다양)',
    currency: 'AUD (A$)',
    visa: 'ETA 필요',
    plug: 'I타입 (230V)',
  },
  '캐나다': {
    timezone: 'UTC-3.5~-8 (다양)',
    currency: 'CAD (C$)',
    visa: 'eTA 필요',
    plug: 'A/B타입 (120V)',
  },
}

export function getCountryInfo(country: string): CountryInfo | null {
  return COUNTRY_INFO[country] || null
}
