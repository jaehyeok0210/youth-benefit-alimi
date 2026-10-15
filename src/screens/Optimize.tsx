import { useMemo, useState } from 'react'
import { axisOf } from '../lib/constants'
import { optimizeCombos, rentTax } from '../lib/optimize'
import type { Dataset, Policy, Profile } from '../lib/types'
import { TopBar, back } from '../ui'

const man = (n: number) => `${Math.round(n).toLocaleString()}만 원`

/* ---------- 겹치는 정책 고르기 ---------- */
export function Combo({ data, eligible }: { data: Dataset; eligible: Policy[] }) {
  const groups = useMemo(() => optimizeCombos(eligible, data.relations), [eligible, data.relations])
  return (
    <div className="page">
      <TopBar onBack={() => back('/home')} />
      <div className="pad" style={{ paddingTop: 8 }}>
        <h1 className="h1">겹치는 정책,<br />뭘 고르면 좋을까요?</h1>
        <p className="desc">둘 중 하나만 받을 수 있는 정책끼리 지원 총액을 비교해서, 내 조건에서 더 많이 받는 쪽을 골랐어요.</p>
      </div>
      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.length === 0 && <div className="muted" style={{ background: '#F2F4F6', borderRadius: 16, padding: '18px 20px', fontSize: 15 }}>지금 받을 수 있는 정책 중에는 서로 겹치는 정책이 없어요. 모두 같이 신청해도 돼요.</div>}
        {groups.map((g, i) => (
          <div key={i} style={{ background: '#F2F4F6', borderRadius: 18, padding: '18px 18px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F766E', marginBottom: 8 }}>이쪽이 더 많이 받아요 · 최대 {man(g.total)}</div>
            {g.chosen.map((p) => (
              <a key={p.id} href={`#/p/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span className={`chip c-${p.axis}`}>{axisOf(p.axis).name}</span>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{man(p.total ?? 0)}</span>
              </a>
            ))}
            <div style={{ height: 1, background: '#E5E8EB', margin: '10px 0' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7684', marginBottom: 4 }}>대신 포기하는 쪽 · {man(g.droppedTotal)}</div>
            {g.dropped.map((d) => (
              <a key={d.p.id} href={`#/p/${d.p.id}`} style={{ display: 'block', padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 15, color: '#6B7684' }}>{d.p.name}</span>
                  <span style={{ fontSize: 14, color: '#8B95A1' }}>{man(d.p.total ?? 0)}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{d.against.name}와(과) 겹쳐요{d.desc ? ` · ${d.desc}` : ''}</div>
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="pad muted" style={{ fontSize: 12, lineHeight: 1.6, padding: '16px 24px 32px' }}>
        금액은 각 정책을 최대한 받았을 때 기준이에요. 실제로는 기간·조건에 따라 달라지고, 정책을 순서대로(먼저 하나 끝내고 다른 것) 받을 수 있는 경우도 있어요. 실제 자격은 신청 기관 심사로 확정돼요.
      </div>
    </div>
  )
}

/* ---------- 월세 세액공제 vs 현금영수증 ---------- */
export function RentCalc({ data, profile }: { data: Dataset; profile: Profile }) {
  const [rent, setRent] = useState('')
  const [other, setOther] = useState('')
  const gross = profile.gross ?? 0
  const r = Number(rent.replace(/\D/g, '')) || 0
  const o = Number(other.replace(/\D/g, '')) || 0
  const biz = profile.job === '사업'
  const res = r > 0 && gross > 0 ? rentTax(data.standards, gross, r, o, !!profile.homeless, biz) : null
  const winner = res ? (res.credit.ok && res.credit.saving >= res.receipt.saving ? 'credit' : 'receipt') : null
  const diff = res ? Math.abs(res.credit.saving - res.receipt.saving) : 0
  const field = (id: string, label: string, val: string, set: (s: string) => void, ph: string, unit: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor={id} style={{ fontSize: 16, fontWeight: 600 }}>{label}</label>
      <div className="field"><input id={id} inputMode="numeric" placeholder={ph} value={val ? Number(val.replace(/\D/g, '')).toLocaleString() : ''} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} /><span className="unit">{unit}</span></div>
    </div>
  )
  return (
    <div className="page">
      <TopBar onBack={() => back('/p/T01')} />
      <div className="pad" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <span className="chip c-t">세금</span>
          <h1 className="h1" style={{ marginTop: 10 }}>월세, 세액공제와<br />현금영수증 중 뭐가 유리할까요?</h1>
          <p className="desc">{biz ? <>개인사업자는 현금영수증 소득공제를 받을 수 없어서 월세 세액공제만 계산해요. 종합소득 {gross.toLocaleString()}만 원 기준이에요.</> : <>같은 월세로 두 가지를 다 받을 수는 없어요. 총급여 {gross.toLocaleString()}만 원 기준으로 계산해요.</>}</p>
        </div>
        {field('rent', '한 달 월세', rent, setRent, '예: 55', '만 원')}
        {!biz && field('other', '월세 말고 1년 카드·현금 사용액', other, setOther, '예: 1,200', '만 원')}
      </div>
      {gross === 0 && <div className="pad muted" style={{ paddingTop: 16, fontSize: 14 }}>총급여가 0원이면 줄일 세금이 없어요. 내 정보에서 총급여를 확인해 주세요.</div>}
      {res && (
        <div style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {biz ? (
          <div style={{ background: '#F1EAFD', borderRadius: 20, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#7C3AED' }}>월세 세액공제로 줄어드는 세금</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{res.credit.ok ? `약 ${man(res.credit.saving)}` : '받을 수 없어요'}</div>
            <div style={{ fontSize: 14, color: '#4E5968', marginTop: 6, lineHeight: 1.5 }}>개인사업자는 성실사업자이거나 성실신고확인대상자여야 받을 수 있어요. 해당하는지는 세무서나 세무대리인에게 확인해 주세요.</div>
          </div>
          ) : (
          <div style={{ background: '#F1EAFD', borderRadius: 20, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#7C3AED' }}>내 조건 기준으로 유리한 쪽</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{winner === 'credit' ? '월세 세액공제' : '현금영수증 소득공제'}</div>
            <div style={{ fontSize: 15, color: '#4E5968', marginTop: 4 }}>{diff >= 1 ? `약 ${man(diff)} 더 줄어요` : '두 방식의 차이가 거의 없어요'}</div>
          </div>
          )}
          {[
            { k: 'credit', t: '월세 세액공제', s: res.credit.ok ? res.credit.saving : 0, d: res.credit.ok ? `연 월세 ${man(res.credit.base)} × ${Math.round(res.credit.rate * 100)}% (지방소득세 포함)${res.credit.capped != null ? ` · 낼 세금(약 ${man(res.credit.capped)})까지만 줄어요` : ''}` : `받을 수 없어요 · ${res.credit.reason}` },
            ...(res.receipt.none ? [] : [{ k: 'receipt', t: '현금영수증 소득공제', s: res.receipt.saving, d: `공제 ${man(res.receipt.deduction)} × 세율 ${Math.round(res.receipt.marginal * 100)}% 추정 (지방소득세 포함) · 총급여 25%(${man(res.receipt.threshold)})를 넘는 사용분부터 공제` }]),
          ].map((x) => (
            <div key={x.k} style={{ background: '#F2F4F6', borderRadius: 16, padding: '16px 18px', opacity: winner === x.k ? 1 : 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{x.t}</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>약 {man(x.s)}</span>
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{x.d}</div>
            </div>
          ))}
        </div>
      )}
      <div className="pad muted" style={{ fontSize: 12, lineHeight: 1.6, padding: '16px 24px 32px' }}>
        세율과 과세표준은 총급여로 대략 추정했어요. 실제로는 낼 세금(결정세액)보다 더 줄일 수 없고, 다른 공제에 따라 결과가 달라질 수 있어요. 정확한 금액은 연말정산 간소화 서비스에서 확인해 주세요.
      </div>
    </div>
  )
}
