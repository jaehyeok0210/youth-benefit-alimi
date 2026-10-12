import Papa from 'papaparse'
import type { AxisKey, Complex, Dataset, Eligibility, Policy, Product, Relation, Standards } from './types'

// 시트 탭 → /api/sheet 함수가 구글 시트 CSV로 바꿔서 돌려줌 (api/sheet.js)
const SHEETS = {
  policies: 'policies',
  eligibility: 'eligibility',
  relations: 'relations',
  standards: 'standards',
  complexes: 'complexes',
  products: 'products',
} as const
type SheetKey = keyof typeof SHEETS

const AXIS: Record<string, AxisKey> = { 주거: 'h', '금융·자산': 'f', '고용·소득': 'j', '취업·수당': 'j', 세제: 't', 세금: 't' }

const sheetUrl = (tab: string) => `/api/sheet?tab=${tab}`

async function fetchText(url: string, ms = 6000): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

const parse = (text: string): string[][] =>
  (Papa.parse<string[]>(text.trim(), { skipEmptyLines: false }).data || []).map((r) => r.map((c) => (c ?? '').trim()))

const num = (s: string | undefined): number | null => {
  if (s == null) return null
  const v = Number(String(s).replace(/[,\s원%]/g, ''))
  return s.trim() === '' || Number.isNaN(v) ? null : v
}

const date = (s: string) => (s || '').replace(/^'/, '').trim()

function toPolicies(rows: string[][]): Policy[] {
  return rows
    .slice(1)
    .filter((r) => /^[A-Z]\d{2}$/.test(r[0] || ''))
    .map((r) => ({
      id: r[0],
      axis: AXIS[r[1]] ?? 'h',
      axisName: r[1],
      name: r[2],
      org: r[3],
      region: r[4] || '전국',
      benefit: r[5],
      amountFormula: r[6],
      realSchedule: r[7],
      deadline: date(r[8]) || '상시',
      url: r[9],
      source: r[10],
      memo: r[11],
      start: date(r[12]) || '상시',
      regionBasis: (r[13] || '').includes('희망') ? '희망 지역' : '거주지',
    }))
}

function toEligibility(rows: string[][]): Record<string, Eligibility> {
  const out: Record<string, Eligibility> = {}
  for (const r of rows.slice(1)) {
    if (!/^[A-Z]\d{2}$/.test(r[0] || '')) continue
    out[r[0]] = {
      id: r[0],
      ageMin: num(r[2]),
      ageMax: num(r[3]),
      homeless: /필요|무주택/.test(r[4] || ''),
      single: (r[5] || '') === '미혼',
      text: { own: r[6], parent: r[7], job: r[8], company: r[9], subscription: r[10], asset: r[11], vulnerable: r[12] },
      jobCode: r[13] || '무관',
      companyCode: r[14] || '무관',
      subscriptionRequired: (r[15] || '').toUpperCase() === 'Y',
      ownBasis: r[16] || '없음',
      ownMax: num(r[17]),
      ownMin: num(r[18]),
      parentBasis: r[19] || '없음',
      parentMax: num(r[20]),
      parentKind: r[21] || '필수',
      vulnCode: r[22] || '없음',
      vulnTargets: (r[23] || '').split(',').map((s) => s.trim()).filter(Boolean),
      note: r[24] || '',
    }
  }
  return out
}

function toComplexes(rows: string[][]): Complex[] {
  return rows
    .slice(1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      id: r[0], policyId: r[1], name: r[2], sido: r[3], sigungu: r[4],
      start: date(r[5]), deadline: date(r[6]), supply: r[7], terms: r[8], url: r[9], note: r[11] || '',
    }))
}

function toProducts(rows: string[][]): Product[] {
  return rows
    .slice(1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      policyId: r[0], org: r[1], name: r[2], base: num(r[3]) ?? 0, max: num(r[4]) ?? 0,
      perks: [[r[5], r[6]], [r[7], r[8]], [r[9], r[10]]].filter(([c]) => c).map(([c, b]) => ({ cond: c.trim(), bonus: num(b) ?? 0 })),
      url: r[11], asOf: date(r[12] || ''), source: r[13] || '', note: r[14] || '',
    }))
}

function toRelations(rows: string[][]): Relation[] {
  return rows
    .slice(1)
    .filter((r) => r[0] && r[2])
    .map((r) => ({ a: r[0], b: r[2], type: r[4], desc: r[5], basis: r[6] }))
}

function toStandards(rows: string[][]): Standards {
  const median: Record<number, number> = {}
  const urban: Record<number, number> = {}
  let employeeRate = 0.03595
  let regionalRate = 0.0719
  let baseDate = new Date()
  for (const r of rows) {
    const n = num(r[0])
    if (n && n >= 1 && n <= 10) {
      const m = num(r[1])
      const u = num(r[2])
      if (m) median[n] = m
      if (u) urban[n] = u
    }
    if ((r[0] || '').startsWith('직장가입자')) employeeRate = num(r[1]) || employeeRate
    if ((r[0] || '').startsWith('지역가입자')) regionalRate = num(r[1]) || regionalRate
    if ((r[0] || '').startsWith('판정 기준일')) {
      const d = date(r[1] || '')
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) baseDate = new Date(d + 'T00:00:00')
    }
  }
  return { median, urban, employeeRate, regionalRate, baseDate }
}

async function loadSet(get: (k: SheetKey) => Promise<string>): Promise<Omit<Dataset, 'source'>> {
  const [p, e, r, s, c, pr] = await Promise.all((Object.keys(SHEETS) as SheetKey[]).map(get))
  const policies = toPolicies(parse(p))
  if (policies.length === 0) throw new Error('정책 데이터가 비어 있어요')
  return {
    policies,
    eligibility: toEligibility(parse(e)),
    relations: toRelations(parse(r)),
    standards: toStandards(parse(s)),
    complexes: toComplexes(parse(c)),
    products: toProducts(parse(pr)),
  }
}

export async function loadData(): Promise<Dataset> {
  try {
    const d = await loadSet((k) => fetchText(sheetUrl(SHEETS[k])))
    return { ...d, source: 'sheet' }
  } catch (err) {
    console.warn('구글 시트를 읽지 못해 저장된 데이터를 써요', err)
    const d = await loadSet((k) => fetchText(`${import.meta.env.BASE_URL}data/${k}.csv`, 10000))
    return { ...d, source: 'fallback' }
  }
}
