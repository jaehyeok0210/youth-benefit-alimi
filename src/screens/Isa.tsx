import { useMemo, useState } from 'react'
import { axisOf } from '../lib/constants'
import type { Dataset, Product, Profile } from '../lib/types'
import { Icon, TopBar, back } from '../ui'

type Manage = 'self' | 'trust'
type Risk = 'safe' | 'some' | 'more'
type Hold = 'deposit' | 'etf' | 'unsure'
type Answers = { manage: Manage | null; risk: Risk | null; hold: Hold | null }

export const KINDS: Record<string, { one: string; can: string; cant: string }> = {
  중개형: { one: '주식·ETF를 내가 직접 사고팔아요', can: '국내 상장 주식, ETF, 펀드, 채권', cant: '예금은 못 담아요' },
  신탁형: { one: '담을 상품을 내가 고르고, 운용은 금융사가 해요', can: '예금, 펀드, ETF, 채권', cant: '주식을 직접 사고팔 수는 없어요' },
  일임형: { one: '전문가가 만든 포트폴리오에 통째로 맡겨요', can: '금융사 모델 포트폴리오', cant: '종목을 직접 고를 수 없어요' },
}

/** 답변 → ISA 유형 */
export function isaKind(a: Answers): { kind: string; why: string } {
  if (a.manage === 'trust') {
    return {
      kind: '일임형',
      why: a.risk === 'safe' ? '직접 고르기보다 맡기고 싶다고 했어요. 원금이 먼저라면 안정형 포트폴리오를 고르면 돼요.' : '직접 고르기보다 맡기고 싶다고 했어요.',
    }
  }
  if (a.hold === 'etf') return { kind: '중개형', why: '직접 고르고, ETF·주식을 담고 싶다고 했어요. ETF를 직접 사고팔 수 있는 건 중개형뿐이에요.' }
  if (a.hold === 'deposit') return { kind: '신탁형', why: '직접 고르고, 예금·채권 위주로 담고 싶다고 했어요. 예금을 담을 수 있는 건 신탁형이에요.' }
  if (a.risk === 'safe') return { kind: '신탁형', why: '직접 고르고 싶지만 원금이 먼저라고 했어요. 예금을 담을 수 있는 신탁형이 맞아요.' }
  return { kind: '중개형', why: '직접 고르고, 일부는 투자해도 된다고 했어요. 상품 선택 폭이 가장 넓은 중개형이 맞아요.' }
}

const feeOf = (p: Product) => (p.kind === '중개형' ? p.tradeFee : p.yearFee)
const feeText = (p: Product) =>
  p.kind === '중개형'
    ? p.tradeFee != null ? `국내주식 매매 수수료 ${p.tradeFee}%` : '매매 수수료 확인 필요'
    : p.yearFee != null ? `연 보수 ${p.yearFee}%` : '연 보수 확인 필요'

export default function IsaCompare({ data, profile, id }: { data: Dataset; profile: Profile; id: string }) {
  const policy = data.policies.find((p) => p.id === id)!
  const products = useMemo(() => data.products.filter((p) => p.policyId === id && p.kind), [data.products, id])
  const [a, setA] = useState<Answers>({ manage: null, risk: null, hold: null })
  const [done, setDone] = useState(false)
  const ax = axisOf(policy.axis)
  const ready = a.manage !== null && a.risk !== null && (a.manage === 'trust' || a.hold !== null)

  if (!done) {
    const opt = <K extends keyof Answers>(k: K, v: NonNullable<Answers[K]>, label: string) => (
      <button className={`opt left${a[k] === v ? ' on' : ''}`} aria-pressed={a[k] === v} onClick={() => setA({ ...a, [k]: v })}>{label}</button>
    )
    return (
      <div className="page">
        <TopBar onBack={() => back(`/p/${id}`)} />
        <div className="pad" style={{ paddingTop: 8, flex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <span className={`chip c-${policy.axis}`}>{ax.name}</span>
            <h1 className="h1" style={{ marginTop: 10 }}>ISA는 유형부터<br />골라야 해요</h1>
            <p className="desc">ISA는 중개형·신탁형·일임형으로 나뉘고, 유형마다 담을 수 있는 상품이 달라요. 투자 성향을 알려주면 맞는 유형부터 찾고, 그 유형끼리 비교해요.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>투자 상품은 누가 고를까요?</div>
            {opt('manage', 'self', '내가 직접 고를래요')}
            {opt('manage', 'trust', '전문가에게 맡길래요')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>원금 손실, 어디까지 괜찮아요?</div>
            {opt('risk', 'safe', '원금을 지키는 게 먼저예요')}
            {opt('risk', 'some', '일부는 투자해도 괜찮아요')}
            {opt('risk', 'more', '수익을 위해 손실도 감수해요')}
          </div>
          {a.manage !== 'trust' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>주로 뭘 담고 싶어요?</div>
              {opt('hold', 'deposit', '예금·채권 위주')}
              {opt('hold', 'etf', 'ETF·주식')}
              {opt('hold', 'unsure', '아직 모르겠어요')}
            </div>
          )}
        </div>
        <div className="bottom">
          <button className="cta" disabled={!ready} onClick={() => setDone(true)}>비교 결과 보기</button>
        </div>
      </div>
    )
  }

  const { kind, why } = isaKind(a)
  const list = products
    .filter((p) => p.kind === kind)
    .sort((x, y) => (feeOf(x) ?? 99) - (feeOf(y) ?? 99) || Number(!!y.perk) - Number(!!x.perk))
  const gross = profile.gross ?? 0
  const seomin = profile.job === '재직' && gross > 0 && gross <= 5000
  const sample = list.some((p) => p.note.includes('샘플'))
  const asOf = list.map((p) => p.asOf).filter(Boolean).sort()[0]
  const k = KINDS[kind]

  return (
    <div className="page">
      <TopBar onBack={() => setDone(false)} title="비교 결과" />
      <div className="pad" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="muted" style={{ fontSize: 15 }}>내 조건 기준으로 맞는 유형은</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{kind} ISA</div>
        <div style={{ fontSize: 15, color: '#4E5968', lineHeight: 1.55 }}>{why}</div>
      </div>
      <div style={{ margin: '18px 20px 0', background: ax.bg, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: ax.color }}>{k.one}</div>
        <div>담을 수 있어요 · {k.can}</div>
        <div className="muted">{k.cant}</div>
        <div style={{ height: 1, background: 'rgba(0,0,0,.06)', margin: '4px 0' }} />
        <div>{seomin ? '총급여 5,000만 원 이하라 서민형으로 가입할 수 있어요 · 순이익 400만 원까지 비과세' : profile.job === '재직' && gross > 5000 ? '총급여 5,000만 원 초과라 일반형이에요 · 순이익 200만 원까지 비과세' : '서민형(비과세 400만 원)은 총급여 5,000만 원 이하일 때 가입할 수 있어요. 일반형은 200만 원까지 비과세예요.'}</div>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{kind} ISA, 수수료 낮은 순</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.length === 0 && <div className="muted" style={{ background: '#F2F4F6', borderRadius: 16, padding: '16px 18px', fontSize: 14 }}>이 유형은 아직 비교할 기관 데이터가 없어요</div>}
          {list.map((p, i) => (
            <div key={p.org + p.name} style={{ borderRadius: 18, padding: '16px 18px', background: i === 0 ? ax.bg : '#F2F4F6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, background: i === 0 ? ax.color : '#B0B8C1', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>{p.org}</span>
              </div>
              <div style={{ fontSize: 14, margin: '6px 0 0 34px' }}>{feeText(p)}</div>
              {p.perk && <div style={{ marginLeft: 34, marginTop: 8 }}><span className={`chip c-${policy.axis}`}>{p.perk}</span></div>}
              <a href={p.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, marginLeft: 34, fontSize: 14, fontWeight: 600, color: i === 0 ? ax.color : '#4E5968' }}>{p.org}에서 가입하기{Icon.ext}</a>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '22px 20px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>다른 유형과 비교하면</div>
        <div style={{ background: '#F2F4F6', borderRadius: 16, padding: '6px 18px' }}>
          {Object.entries(KINDS).map(([name, v], i) => (
            <div key={name} style={{ padding: '12px 0', borderTop: i ? '1px solid #E5E8EB' : 0, opacity: name === kind ? 1 : 0.75 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{name}{name === kind ? ' · 내 유형' : ''}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{v.one} · {v.cant}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pad muted" style={{ fontSize: 12, lineHeight: 1.6, padding: '16px 24px 32px' }}>
        ISA는 한 사람이 한 계좌만 열 수 있어요. 나중에 유형이나 기관을 바꾸려면 계좌 이전을 해야 해요. 투자 상품은 원금 손실이 생길 수 있어요.
        {asOf && <><br />{asOf} 기준이에요.</>}
        {sample && <><br />지금 보이는 수수료는 화면 확인용 샘플이에요.</>}
      </div>
    </div>
  )
}
