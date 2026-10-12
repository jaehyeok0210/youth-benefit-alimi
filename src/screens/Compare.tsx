import { useEffect, useMemo, useState } from 'react'
import { axisOf } from '../lib/constants'
import type { Dataset, Product, Profile } from '../lib/types'
import { Icon, TopBar, back } from '../ui'

type Answers = { mainBank: string; salary: boolean | null; card: boolean | null }

const COND_LABEL: Record<string, string> = {
  급여이체: '급여 이체',
  카드실적: '카드 실적',
  첫거래: '이 은행 첫 거래',
  주거래: '주거래 은행',
  자동이체: '자동이체',
  비대면: '비대면 가입',
}

/** 내 답변으로 이 우대 조건을 채울 수 있는지 */
function canMeet(cond: string, org: string, a: Answers): boolean {
  if (cond === '급여이체') return a.salary === true
  if (cond === '카드실적') return a.card === true
  if (cond === '주거래') return a.mainBank === org
  if (cond === '첫거래') return a.mainBank !== org
  if (cond === '자동이체' || cond === '비대면') return true
  return false
}

export function rank(products: Product[], a: Answers) {
  return products
    .map((p) => {
      const met = p.perks.filter((k) => canMeet(k.cond, p.org, a))
      const miss = p.perks.filter((k) => !canMeet(k.cond, p.org, a))
      const rate = Math.min(p.max || Infinity, p.base + met.reduce((s, k) => s + k.bonus, 0))
      return { p, met, miss, rate: Math.round(rate * 100) / 100 }
    })
    .sort((x, y) => y.rate - x.rate || x.miss.length - y.miss.length)
}

export default function Compare({ data, profile, id }: { data: Dataset; profile: Profile; id: string }) {
  const policy = data.policies.find((p) => p.id === id)
  const products = useMemo(() => data.products.filter((p) => p.policyId === id), [data.products, id])
  const [a, setA] = useState<Answers>({ mainBank: '', salary: profile.job === '재직' ? null : false, card: null })
  const [done, setDone] = useState(false)
  const [ai, setAi] = useState<string | null>(null)
  const ranked = useMemo(() => rank(products, a), [products, a])
  const ready = a.mainBank !== '' && a.salary !== null && a.card !== null

  // LLM 설명: 서버에 API 키가 있을 때만 응답, 없으면 조용히 생략
  useEffect(() => {
    if (!done || !policy) return
    setAi(null)
    const ctrl = new AbortController()
    fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        policy: policy.name,
        answers: a,
        ranking: ranked.map((r) => ({ org: r.p.org, rate: r.rate, met: r.met.map((k) => k.cond), miss: r.miss.map((k) => k.cond) })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.text && setAi(j.text))
      .catch(() => {})
    return () => ctrl.abort()
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!policy || !products.length) {
    return (
      <div className="page">
        <TopBar onBack={() => back('/home')} />
        <div className="pad muted">비교할 선택지가 아직 없어요</div>
      </div>
    )
  }
  const ax = axisOf(policy.axis)
  const banks = products.map((p) => p.org)
  const asOf = products.map((p) => p.asOf).filter(Boolean).sort()[0]
  const sample = products.some((p) => p.note.includes('샘플'))

  if (!done) {
    const yn = (k: 'salary' | 'card', v: boolean, label: string) => (
      <button className={`opt${a[k] === v ? ' on' : ''}`} aria-pressed={a[k] === v} onClick={() => setA({ ...a, [k]: v })}>{label}</button>
    )
    return (
      <div className="page">
        <TopBar onBack={() => back(`/p/${id}`)} />
        <div className="pad" style={{ paddingTop: 8, flex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <span className={`chip c-${policy.axis}`}>{ax.name}</span>
            <h1 className="h1" style={{ marginTop: 10 }}>{policy.name}<br />어디서 가입할까요?</h1>
            <p className="desc">우대 조건을 채울 수 있는지 3가지만 알려주면 {banks.length}곳을 내 조건 기준으로 비교해요.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>주로 쓰는 은행</div>
            <div className="field">
              <select aria-label="주거래 은행" value={a.mainBank} onChange={(e) => setA({ ...a, mainBank: e.target.value })}>
                <option value="">선택</option>
                {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="기타">목록에 없어요</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>급여 이체 은행을 옮길 수 있나요?</div>
            <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>{yn('salary', true, '옮길 수 있어요')}{yn('salary', false, '어려워요')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>그 은행 카드를 매달 일정 금액 쓸 수 있나요?</div>
            <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>{yn('card', true, '쓸 수 있어요')}{yn('card', false, '어려워요')}</div>
          </div>
        </div>
        <div className="bottom">
          <button className="cta" disabled={!ready} onClick={() => setDone(true)}>비교 결과 보기</button>
        </div>
      </div>
    )
  }

  const top = ranked[0]
  return (
    <div className="page">
      <TopBar onBack={() => setDone(false)} title="비교 결과" />
      <div className="pad" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="muted" style={{ fontSize: 15 }}>내 조건 기준으로 가장 높은 곳은</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{top.p.org} · 연 {top.rate.toFixed(2)}%</div>
        <div className="muted" style={{ fontSize: 13 }}>{asOf ? `${asOf} 기준 · ` : ''}{a.mainBank && a.mainBank !== '기타' ? `주거래 ${a.mainBank} · ` : ''}급여 이체 {a.salary ? '가능' : '어려움'} · 카드 실적 {a.card ? '가능' : '어려움'}</div>
      </div>
      {ai && (
        <div style={{ margin: '18px 20px 0', background: ax.bg, borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ax.color, marginBottom: 6 }}>한 줄 정리</div>
          <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ai}</div>
        </div>
      )}
      <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ranked.map((r, i) => (
          <div key={r.p.org} style={{ borderRadius: 18, padding: '16px 18px', background: i === 0 ? ax.bg : '#F2F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: 12, background: i === 0 ? ax.color : '#B0B8C1', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>{r.p.org}</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>연 {r.rate.toFixed(2)}%</span>
            </div>
            <div className="muted" style={{ fontSize: 13, margin: '6px 0 10px 34px' }}>기본 {r.p.base}% · 최고 {r.p.max}%</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 34 }}>
              {r.met.map((k) => <span key={k.cond} className={`chip c-${policy.axis}`}>{COND_LABEL[k.cond] ?? k.cond} +{k.bonus}%p</span>)}
              {r.miss.map((k) => <span key={k.cond} className="chip c-check" style={{ textDecoration: 'line-through' }}>{COND_LABEL[k.cond] ?? k.cond} +{k.bonus}%p</span>)}
            </div>
            <a href={r.p.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, marginLeft: 34, fontSize: 14, fontWeight: 600, color: i === 0 ? ax.color : '#4E5968' }}>{r.p.org}에서 가입하기{Icon.ext}</a>
          </div>
        ))}
      </div>
      <div className="pad muted" style={{ fontSize: 12, lineHeight: 1.6, padding: '16px 24px 32px' }}>
        내 답변으로 채울 수 있는 우대 조건만 더해 계산한 비교 결과예요. 실제 금리는 가입 시점과 은행 심사로 확정돼요.
        {sample && <><br />지금 보이는 금리는 화면 확인용 샘플이에요.</>}
      </div>
    </div>
  )
}
