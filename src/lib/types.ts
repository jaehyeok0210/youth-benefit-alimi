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
  jobCode: string // 무관 / 재직 / 구직
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
}

export interface Dataset {
  policies: Policy[]
  eligibility: Record<string, Eligibility>
  relations: Relation[]
  standards: Standards
  source: 'sheet' | 'fallback'
}

export type InsuranceType = '직장' | '지역' | '피부양자' | '모름'

export interface Profile {
  birthYear: number | null
  birthMonth: number | null
  sido: string
  sigungu: string
  married: boolean | null
  homeless: boolean | null
  job: '재직' | '구직' | null
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
