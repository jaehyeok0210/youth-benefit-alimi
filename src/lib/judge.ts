import type { Dataset, Eligibility, Judgement, JudgeRow, Policy, Profile, Standards } from './types'

export const won = (n: number) => {
  if (n >= 100000000) {
    const eok = Math.floor(n / 100000000)
    const man = Math.round((n % 100000000) / 10000)
    return `${eok}억${man ? ` ${man.toLocaleString()}만` : ''} 원`
  }
  return `${Math.round(n / 10000).toLocaleString()}만 원`
}

export function ageOf(p: Profile, base: Date): number | null {
  if (!p.birthYear) return null
  const m = p.birthMonth ?? 1
  let a = base.getFullYear() - p.birthYear
  if (m > base.getMonth() + 1) a -= 1
  return a
}

/** 본인 월 소득(세전) */
export const ownMonthly = (p: Profile) => ((p.gross ?? 0) * 10000) / 12

/** 부모 월 소득 추정 (건강보험료 기준). 한 분이라도 모르면 null */
export function parentMonthly(p: Profile, s: Standards): number | null {
  let sum = 0
  for (const x of [p.father, p.mother]) {
    if (!x.type || x.type === '모름') return null
    if (x.type === '피부양자') continue
    const prem = x.premium ?? 0
    sum += x.type === '직장' ? prem / s.employeeRate : prem / s.regionalRate
  }
  return sum
}

const table = (s: Standards, basis: string) => (basis.startsWith('중위') ? s.median : s.urban)
const sizeVal = (t: Record<number, number>, n: number) => {
  const keys = Object.keys(t).map(Number).sort((a, b) => a - b)
  if (!keys.length) return 0
  const k = Math.min(Math.max(n, keys[0]), keys[keys.length - 1])
  return t[k] ?? 0
}

/** 기준에 따른 월 금액 한도 (본인은 1인 가구 기준) */
function limit(basis: string, value: number, s: Standards, size: number): number {
  if (basis === '월 원') return value
  if (basis === '연 만원') return (value * 10000) / 12
  if (basis.endsWith('%')) return (sizeVal(table(s, basis), size) * value) / 100
  return Infinity
}

const basisLabel = (basis: string, v: number | null) => {
  if (v == null) return ''
  if (basis === '중위소득%') return `기준 중위소득 ${v}%`
  if (basis === '도시근로자%') return `도시근로자 월평균소득 ${v}%`
  if (basis === '월 원') return `월 ${won(v)}`
  if (basis === '연 만원') return `연 ${won(v * 10000)}`
  return ''
}

export function judge(policy: Policy, el: Eligibility | undefined, p: Profile, d: Dataset): Judgement {
  const s = d.standards
  const rows: JudgeRow[] = []
  const flags: string[] = []
  let fail = false
  const bad = () => {
    fail = true
  }

  // 지역
  if (policy.region !== '전국') {
    if (p.sido !== policy.region) bad()
    rows.push({ label: `${policy.region} 거주`, mine: `내 조건: ${p.sido} ${p.sigungu}`.trim(), result: 'ok' })
  }
  if (!el) return { status: fail ? 'fail' : 'ok', rows, flags }

  // 나이
  const age = ageOf(p, s.baseDate)
  if (el.ageMin != null || el.ageMax != null) {
    if (age == null || (el.ageMin != null && age < el.ageMin) || (el.ageMax != null && age > el.ageMax)) bad()
    const range =
      el.ageMin != null && el.ageMax != null
        ? el.ageMin === el.ageMax
          ? `만 ${el.ageMin}세`
          : `만 ${el.ageMin}~${el.ageMax}세`
        : el.ageMin != null
          ? `만 ${el.ageMin}세 이상`
          : `만 ${el.ageMax}세 이하`
    rows.push({ label: `나이 ${range}`, mine: `내 조건: 만 ${age ?? '?'}세`, result: 'ok' })
  }

  // 무주택·미혼
  if (el.homeless || el.single) {
    if (el.homeless && p.homeless !== true) bad()
    if (el.single && p.married !== false) bad()
    const label = [el.homeless ? '무주택' : '', el.single ? '미혼' : ''].filter(Boolean).join(' ')
    const mine = [el.homeless ? (p.homeless ? '무주택' : '주택 있음') : '', el.single ? (p.married ? '기혼' : '미혼') : '']
      .filter(Boolean)
      .join(', ')
    rows.push({ label, mine: `내 조건: ${mine}`, result: 'ok' })
  }

  // 재직·구직
  if (el.jobCode === '재직' || el.jobCode === '구직') {
    if (p.job !== el.jobCode) bad()
    rows.push({
      label: el.jobCode === '재직' ? '재직 중' : '미취업·구직 중',
      mine: `내 조건: ${p.job === '재직' ? `재직 · ${p.company ?? ''}` : '구직 중'}`,
      result: 'ok',
    })
  }
  if (el.companyCode !== '무관') {
    const okSizes = el.companyCode === '중소' ? ['중소기업'] : ['중소기업', '중견기업']
    if (!p.company || !okSizes.includes(p.company)) bad()
    rows.push({ label: `${el.companyCode === '중소' ? '중소기업' : '중소·중견기업'} 재직`, mine: `내 조건: ${p.company ?? '-'}`, result: 'ok' })
  }

  // 청약통장
  if (el.subscriptionRequired) {
    if (!p.subscription) bad()
    rows.push({ label: '청약통장 가입', mine: '내 조건: 있음', result: 'ok' })
  }

  // 취약 유형
  const mineV = p.vulnerable.filter((v) => v !== '해당 없음')
  const hit = mineV.filter((v) => el.vulnTargets.includes(v))
  let priority = false
  if (el.vulnCode === '필수') {
    if (!hit.length) bad()
    rows.push({ label: '대상 유형에 해당', mine: `내 조건: ${hit.join(', ') || '해당 없음'}`, result: 'ok' })
  } else if (el.vulnCode === '제외') {
    if (hit.length) bad()
  } else if (el.vulnCode === '우선순위' && hit.length) {
    priority = true
    rows.push({ label: '1순위 대상', mine: `${hit.join(', ')} → 소득 심사 없이 1순위로 신청할 수 있어요`, result: 'ok' })
  } else if (el.vulnCode === '우대' && hit.length) {
    rows.push({ label: '우대 대상', mine: `${hit.join(', ')} → 지원이 늘어날 수 있어요`, result: 'info' })
  } else if (el.vulnCode === '확인 필요' && hit.length) {
    rows.push({ label: '참여 제한 여부', mine: `${hit.join(', ')}는 참여가 제한될 수 있어요`, result: 'check' })
    flags.push('대상 유형 확인 필요')
  }

  // 본인 소득
  const own = ownMonthly(p)
  if (!priority && el.ownBasis !== '없음' && (el.ownMax != null || el.ownMin != null)) {
    const max = el.ownMax != null ? limit(el.ownBasis, el.ownMax, s, 1) : Infinity
    const min = el.ownMin != null ? limit(el.ownBasis, el.ownMin, s, 1) : -Infinity
    if (own > max || own < min) bad()
    const label =
      el.ownMax != null && el.ownMin != null
        ? `본인 소득 ${basisLabel(el.ownBasis, el.ownMin)} 이상 ${basisLabel(el.ownBasis, el.ownMax)} 이하`
        : el.ownMax != null
          ? `본인 소득 ${basisLabel(el.ownBasis, el.ownMax)} 이하`
          : `본인 소득 ${basisLabel(el.ownBasis, el.ownMin)} 이상`
    rows.push({
      label,
      mine: `총급여 ${won((p.gross ?? 0) * 10000)} → 월 약 ${won(own)}${max !== Infinity ? ` (기준 월 ${won(max)})` : ''}`,
      result: 'ok',
    })
  }

  // 부모·가구 소득
  if (!priority && el.parentBasis !== '없음' && el.parentMax != null) {
    const pm = parentMonthly(p, s)
    const isDependent = el.parentBasis === '연 만원' // 부양의무자(부모) 소득만
    const cap = isDependent ? (el.parentMax * 10000) / 12 : limit(el.parentBasis, el.parentMax, s, p.household)
    const kind = el.parentKind === '우선순위' ? ' (2순위)' : ''
    const label = isDependent
      ? `부모 소득 ${basisLabel(el.parentBasis, el.parentMax)} 미만${kind}`
      : `가구 소득 ${basisLabel(el.parentBasis, el.parentMax)} 이하${kind}`
    if (pm == null) {
      rows.push({ label, mine: '모름으로 답해서 충족으로 가정했어요', result: 'check' })
      flags.push('부모 소득 확인 필요')
    } else {
      const total = isDependent ? pm : pm + own
      const over = total > cap
      if (over && el.parentKind !== '우선순위') bad()
      rows.push({
        label,
        mine: `건강보험료로 추정한 ${isDependent ? '부모' : `원가구 ${p.household}명`} 월 소득 약 ${won(total)} (기준 ${won(cap)})${
          over ? ' → 2순위는 어렵고 3순위로 신청할 수 있어요' : ''
        }`,
        result: over ? 'info' : 'ok',
      })
    }
  }

  if (el.note) rows.push({ label: '판정하지 않은 조건', mine: el.note, result: 'info' })
  if (el.text.asset && !/^(미적용|무관)/.test(el.text.asset)) {
    rows.push({ label: '자산 기준 (직접 확인)', mine: el.text.asset, result: 'info' })
  }

  const status = fail ? 'fail' : rows.some((r) => r.result === 'check') ? 'check' : 'ok'
  return { status, rows, flags }
}

export function judgeAll(d: Dataset, p: Profile) {
  const out: Record<string, Judgement> = {}
  for (const pol of d.policies) out[pol.id] = judge(pol, d.eligibility[pol.id], p, d)
  return out
}

export const dday = (deadline: string, base: Date): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null
  const t = new Date(deadline + 'T00:00:00').getTime()
  return Math.round((t - base.getTime()) / 86400000)
}
