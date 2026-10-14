import type { Policy, Relation, Standards } from './types'

export interface ComboGroup {
  chosen: Policy[]
  dropped: { p: Policy; against: Policy; desc: string }[]
  total: number
  droppedTotal: number
}

/**
 * '둘 중 하나' 관계로 묶인 정책들 중 지원 총액 합이 가장 큰 조합을 고른다.
 * 금액이 있는 정책끼리만 비교하고, 그룹(연결 요소)마다 완전 탐색한다.
 */
export function optimizeCombos(policies: Policy[], relations: Relation[]): ComboGroup[] {
  const cand = policies.filter((p) => (p.total ?? 0) > 0)
  const ids = new Set(cand.map((p) => p.id))
  const edges = relations.filter((r) => r.type === '둘 중 하나' && ids.has(r.a) && ids.has(r.b) && r.a !== r.b)
  const adj = new Map<string, Set<string>>()
  for (const e of edges) {
    if (!adj.has(e.a)) adj.set(e.a, new Set())
    if (!adj.has(e.b)) adj.set(e.b, new Set())
    adj.get(e.a)!.add(e.b)
    adj.get(e.b)!.add(e.a)
  }
  const byId = new Map(cand.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const groups: ComboGroup[] = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    while (stack.length) {
      const x = stack.pop()!
      if (seen.has(x)) continue
      seen.add(x)
      comp.push(x)
      adj.get(x)!.forEach((y) => !seen.has(y) && stack.push(y))
    }
    if (comp.length > 16) comp.length = 16 // 안전장치
    let best = 0
    let bestMask = 0
    for (let m = 1; m < 1 << comp.length; m++) {
      let ok = true
      let sum = 0
      for (let i = 0; i < comp.length && ok; i++) {
        if (!(m & (1 << i))) continue
        sum += byId.get(comp[i])!.total ?? 0
        for (let j = i + 1; j < comp.length; j++) if (m & (1 << j) && adj.get(comp[i])!.has(comp[j])) { ok = false; break }
      }
      if (ok && sum > best) { best = sum; bestMask = m }
    }
    const chosen = comp.filter((_, i) => bestMask & (1 << i)).map((id) => byId.get(id)!)
    const chosenIds = new Set(chosen.map((p) => p.id))
    const dropped = comp
      .filter((id) => !chosenIds.has(id))
      .map((id) => {
        const againstId = [...adj.get(id)!].find((y) => chosenIds.has(y))!
        const rel = edges.find((e) => (e.a === id && e.b === againstId) || (e.b === id && e.a === againstId))
        return { p: byId.get(id)!, against: byId.get(againstId)!, desc: rel?.desc ?? '' }
      })
    groups.push({ chosen, dropped, total: best, droppedTotal: dropped.reduce((s, d) => s + (d.p.total ?? 0), 0) })
  }
  return groups.sort((a, b) => b.total - a.total)
}

/* ---------- 월세 세액공제 vs 현금영수증 소득공제 ---------- */
const v = (s: Standards, k: string, d: number) => {
  const x = Number(s.values[k])
  return Number.isFinite(x) && s.values[k] !== undefined && s.values[k] !== '' ? x : d
}
const list = (s: Standards, k: string, d: number[]) => {
  const raw = s.values[k]
  if (!raw) return d
  const xs = raw.split(/[\/,\s]+/).filter(Boolean).map(Number)
  // 오름차순이 아니면(시트가 숫자로 바꿔버린 경우 등) 기본값 사용
  return xs.length === d.length && xs.every(Number.isFinite) && xs.every((x, i) => i === 0 || x > xs[i - 1]) ? xs : d
}

export function marginalRate(s: Standards, grossMan: number) {
  const taxable = grossMan * v(s, '과세표준 추정 비율', 0.7)
  const cuts = list(s, '과세표준 구간(만 원)', [1400, 5000, 8800, 15000])
  const rates = list(s, '구간별 세율', [0.06, 0.15, 0.24, 0.35, 0.38])
  let i = 0
  while (i < cuts.length && taxable > cuts[i]) i++
  return { rate: rates[Math.min(i, rates.length - 1)], taxable }
}

export interface RentResult {
  credit: { ok: boolean; reason?: string; saving: number; base: number; rate: number; capped?: number }
  receipt: { saving: number; deduction: number; marginal: number; threshold: number }
}

/** 산출세액 - 근로소득세액공제로 결정세액을 대략 추정 (만 원) */
export function estimatedTaxDue(s: Standards, grossMan: number) {
  const { taxable } = marginalRate(s, grossMan)
  const cuts = list(s, '과세표준 구간(만 원)', [1400, 5000, 8800, 15000])
  const rates = list(s, '구간별 세율', [0.06, 0.15, 0.24, 0.35, 0.38])
  let tax = 0
  let prev = 0
  for (let i = 0; i < rates.length; i++) {
    const top = i < cuts.length ? cuts[i] : Infinity
    if (taxable > prev) tax += (Math.min(taxable, top) - prev) * rates[i]
    prev = top
  }
  const workCredit = Math.min(tax <= 130 ? tax * 0.55 : 71.5 + (tax - 130) * 0.3, grossMan <= 3300 ? 74 : grossMan <= 7000 ? 66 : 50)
  return Math.max(0, tax - workCredit)
}

/** 금액 단위: 만 원. 절세액에는 지방소득세(10%)를 포함 */
export function rentTax(s: Standards, grossMan: number, rentMonthly: number, otherSpend: number, homeless: boolean): RentResult {
  const annual = rentMonthly * 12
  const cap = v(s, '월세 세액공제 총급여 상한(만 원)', 8000)
  const hiCut = v(s, '월세 세액공제 17% 총급여 기준(만 원)', 5500)
  const rate = grossMan <= hiCut ? v(s, '월세 세액공제율 높음', 0.17) : v(s, '월세 세액공제율 낮음', 0.15)
  const base = Math.min(annual, v(s, '월세 세액공제 한도(만 원)', 1000))
  let credit: RentResult['credit']
  if (grossMan > cap) credit = { ok: false, reason: `총급여 ${cap.toLocaleString()}만 원 초과`, saving: 0, base, rate }
  else if (!homeless) credit = { ok: false, reason: '무주택 세대주만 받을 수 있어요', saving: 0, base, rate }
  else {
    // 세액공제는 낼 세금(결정세액 추정)보다 많이 줄일 수 없음
    const due = estimatedTaxDue(s, grossMan)
    const raw = base * rate
    credit = { ok: true, saving: Math.min(raw, due) * 1.1, base, rate, capped: raw > due ? due : undefined }
  }

  const T = grossMan * v(s, '카드 공제 문턱(총급여 대비)', 0.25)
  const L = grossMan <= 7000 ? v(s, '카드 공제 기본한도 총급여 7천 이하(만 원)', 300) : v(s, '카드 공제 기본한도 총급여 7천 초과(만 원)', 250)
  const cardRate = v(s, '신용카드 공제율', 0.15)
  const cashRate = v(s, '현금영수증 소득공제율', 0.3)
  const otherDed = Math.max(0, otherSpend - T) * cardRate
  const rentEligible = Math.max(0, annual - Math.max(0, T - otherSpend))
  const deduction = Math.max(0, Math.min(L, otherDed + rentEligible * cashRate) - Math.min(L, otherDed))
  const { rate: marginal } = marginalRate(s, grossMan)
  return { credit, receipt: { saving: deduction * marginal * 1.1, deduction, marginal, threshold: T } }
}
