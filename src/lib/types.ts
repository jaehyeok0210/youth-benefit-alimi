export type AxisKey = 'h' | 'f' | 'j' | 't'

export interface Policy {
  id: string
  axis: AxisKey
  axisName: string
  name: string
  org: string
  region: string // 전국 / 서울 / 경기 / 인천
  benefit: string
  amountFormula: string
  realSchedule: string
  deadline: string // YYYY-MM-DD 또는 상시
  start: string // YYYY-MM-DD 또는 상시
  url: string
  source: string
  memo: string
  regionBasis: '거주지' | '희망 지역'
  total: number | null // 지원 총액(만 원, 최대)
}

export interface Complex {
  id: string
  policyId: string
  name: string
  sido: string
  sigungu: string
  start: string
  deadline: string
  supply: string
  terms: string
  url: string
  note: string
}

export interface Product {
  policyId: string
  org: string
  name: string
  base: number
  max: number
  perks: { cond: string; bonus: number }[]
  url: string
  asOf: string
  source: string
  note: string
  /** ISA 등 유형으로 고르는 상품: 중개형·신탁형·일임형 */
  kind: string
  tradeFee: number | null
  yearFee: number | null
  /** 시트에 적힌 그대로 (예: 0.1~0.7) */
  yearFeeText: string
  perk: string
}

export interface Eligibility {
  id: string
  ageMin: number | null
  ageMax: number | null
  homeless: boolean
  single: boolean
  text: {
    own: string
    parent: string
    job: string
    company: string
    subscription: string
    asset: string
    vulnerable: string
  }
  jobCode: string // 무관 / 재직(근로자만) / 구직 / 소득자(근로·사업) / 사업(사업자만)
  /** 사업자일 때 소득 상한(연 만 원)과 기준(종합소득·사업소득·매출) */
  bizCap: number | null
  bizBasis: string
  companyCode: string // 무관 / 중소 / 중소·중견
  subscriptionRequired: boolean
  ownBasis: string // 없음 / 중위소득% / 도시근로자% / 월 원 / 연 만원
  ownMax: number | null
  ownMin: number | null
  parentBasis: string
  parentMax: number | null
  parentKind: string // 필수 / 우선순위
  vulnCode: string // 없음 / 우선순위 / 우대 / 필수 / 제외 / 확인 필요
  vulnTargets: string[]
  note: string
}

export interface Relation {
  a: string
  b: string
  type: string // 같이 가능 / 둘 중 하나 / 조건 변화 / 확인 필요
  desc: string
  basis: string
}

export interface Standards {
  median: Record<number, number>
  urban: Record<number, number>
  employeeRate: number
  regionalRate: number
  baseDate: Date
  values: Record<string, string> // 기준값 탭의 나머지 항목 (항목명 → 값)
}

export interface Dataset {
  policies: Policy[]
  eligibility: Record<string, Eligibility>
  relations: Relation[]
  standards: Standards
  complexes: Complex[]
  products: Product[]
  source: 'sheet' | 'fallback'
}

export type InsuranceType = '직장' | '지역' | '피부양자' | '모름'

export interface Profile {
  birthYear: number | null
  birthMonth: number | null
  sido: string
  sigungu: string
  wish: string[] // '서울 동작구' 형식
  wishAny: boolean
  married: boolean | null
  homeless: boolean | null
  job: '재직' | '구직' | '사업' | null
  company: '중소기업' | '중견기업' | '대기업' | '공공기관' | null
  gross: number | null // 연 세전 총급여, 만 원
  household: number
  father: { type: InsuranceType | null; premium: number | null }
  mother: { type: InsuranceType | null; premium: number | null }
  subscription: boolean | null
  vulnerable: string[]
}

export type RowResult = 'ok' | 'check' | 'info'

export interface JudgeRow {
  label: string
  mine: string
  result: RowResult
}

export interface Judgement {
  status: 'ok' | 'check' | 'fail'
  rows: JudgeRow[]
  flags: string[]
}
