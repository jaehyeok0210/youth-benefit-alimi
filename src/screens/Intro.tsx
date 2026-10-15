import { AXES, DISCLAIMER } from '../lib/constants'

const Dots = () => (
  <span style={{ display: 'flex', gap: 5 }} aria-hidden="true">
    {AXES.map((a) => (
      <i key={a.key} style={{ width: 9, height: 9, borderRadius: 5, background: a.color, display: 'block' }} />
    ))}
  </span>
)

const POINTS = [
  { t: '질문 10개, 1분이면 끝나요', d: '나이·거주지·소득 같은 기본 조건만 물어봐요' },
  { t: '못 받는 정책은 빼고 보여줘요', d: '받을 수 있거나 확인이 필요한 정책만 마감 순서대로' },
  { t: '같이 받을 수 있는지 비교해줘요', d: '둘 중 하나만 되는 정책은 미리 알려줘요' },
]

export default function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="page intro">
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 700 }}>
        <Dots />
        청년 혜택 알리미
      </div>
      <div style={{ padding: '36px 24px 0' }}>
        <h1 style={{ fontSize: 30, lineHeight: 1.32, fontWeight: 700, letterSpacing: '-0.03em' }}>
          내가 받을 수 있는
          <br />
          청년 혜택만 모아줘요
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: '#4E5968', marginTop: 12 }}>
          서울 사회초년생·취준생을 위한
          <br />
          주거·금융·취업·세금 혜택 정리
        </p>
      </div>
      <div style={{ margin: '28px 24px 0', padding: '18px 0', borderTop: '1px solid #E5E8EB', borderBottom: '1px solid #E5E8EB', display: 'flex', justifyContent: 'space-around' }} aria-hidden="true">
        {AXES.map((a, i) => (
          <div key={a.key} className="intro-icon" style={{ animationDelay: `${i * 0.08}s` }}>
            <img src={a.img} alt="" width={36} height={36} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#4E5968' }}>{a.name}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '28px 24px 0', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {POINTS.map((p, i) => (
          <div key={p.t} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: '#191F28', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{p.t}</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 2, lineHeight: 1.5 }}>{p.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bottom" style={{ paddingTop: 24 }}>
        <button className="cta" onClick={onStart}>1분 만에 내 혜택 찾기</button>
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.6, textAlign: 'center', marginTop: 10 }}>{DISCLAIMER}</div>
      </div>
    </div>
  )
}

export function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div className="tiles" style={{ height: 56 }} aria-hidden="true">
        {AXES.map((a, i) => (
          <i key={a.key} style={{ width: 28, height: 28, borderRadius: 9, background: a.color, animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
      <div className="muted" style={{ fontSize: 15 }} role="status">
        정책 정보를 불러오고 있어요
      </div>
    </div>
  )
}
