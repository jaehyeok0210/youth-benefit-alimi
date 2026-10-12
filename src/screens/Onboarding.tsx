import { SIDO, VULNERABLE } from '../lib/constants'
import type { ReactNode } from 'react'
import type { InsuranceType, Profile } from '../lib/types'
import { Icon } from '../ui'

export const STEP_COUNT = 9
type Props = { profile: Profile; step: number; edit: boolean; onChange: (p: Profile) => void; onNext: () => void; onBack: () => void }

const YEARS = Array.from({ length: 30 }, (_, i) => 2008 - i) // 1979~2008년생

function Opt<T>({ value, cur, set, label, cols }: { value: T; cur: T; set: (v: T) => void; label?: string; cols?: boolean }) {
  return (
    <button className={`opt${cur === value ? ' on' : ''}${cols ? '' : ' left'}`} aria-pressed={cur === value} onClick={() => set(value)}>
      {label ?? String(value)}
    </button>
  )
}

function Insurance({ who, v, set }: { who: string; v: Profile['father']; set: (x: Profile['father']) => void }) {
  const types: InsuranceType[] = ['직장', '지역', '피부양자', '모름']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{who}</div>
      <div className="seg" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        {types.map((t) => (
          <button key={t} className={`opt${v.type === t ? ' on' : ''}`} style={{ padding: 0, fontSize: 15 }} aria-pressed={v.type === t} onClick={() => set({ type: t, premium: t === '직장' || t === '지역' ? v.premium : null })}>
            {t}
          </button>
        ))}
      </div>
      {(v.type === '직장' || v.type === '지역') && (
        <div className="field">
          <label htmlFor={`prem-${who}`}>월 보험료</label>
          <input
            id={`prem-${who}`}
            inputMode="numeric"
            placeholder="예: 120,000"
            value={v.premium ? v.premium.toLocaleString() : ''}
            onChange={(e) => set({ ...v, premium: Number(e.target.value.replace(/\D/g, '')) || null })}
          />
          <span className="unit">원</span>
        </div>
      )}
      {v.type === '피부양자' && <div style={{ fontSize: 13 }} className="muted">피부양자는 보험료가 없어서 입력하지 않아도 돼요</div>}
    </div>
  )
}

export function stepValid(p: Profile, step: number): boolean {
  switch (step) {
    case 1: return !!p.birthYear && !!p.birthMonth
    case 2: return !!p.sido && !!p.sigungu
    case 3: return p.married !== null
    case 4: return p.homeless !== null
    case 5: return p.job === '구직' || (p.job === '재직' && !!p.company)
    case 6: return p.gross !== null
    case 7: {
      const ok = (x: Profile['father']) => !!x.type && (x.type === '피부양자' || x.type === '모름' || (x.premium ?? 0) > 0)
      return ok(p.father) && ok(p.mother)
    }
    case 8: return p.subscription !== null
    case 9: return p.vulnerable.length > 0
  }
  return true
}

export default function Onboarding({ profile: p, step, edit, onChange, onNext, onBack }: Props) {
  const set = (patch: Partial<Profile>) => onChange({ ...p, ...patch })
  let title: ReactNode = ''
  let desc: ReactNode = null
  let body: ReactNode = null

  if (step === 1) {
    title = <>생년월일을<br />알려주세요</>
    desc = '나이 기준을 판정할 때 써요'
    body = (
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1.3 }}>
          <select aria-label="태어난 해" value={p.birthYear ?? ''} onChange={(e) => set({ birthYear: Number(e.target.value) || null })}>
            <option value="">년도</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <select aria-label="태어난 달" value={p.birthMonth ?? ''} onChange={(e) => set({ birthMonth: Number(e.target.value) || null })}>
            <option value="">월</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>
    )
  } else if (step === 2) {
    title = <>어디에 살고 있나요?</>
    desc = '수도권(서울·경기·인천) 정책을 모아줘요'
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {Object.keys(SIDO).map((s) => (
            <button key={s} className={`opt${p.sido === s ? ' on' : ''}`} aria-pressed={p.sido === s} onClick={() => set({ sido: s, sigungu: '' })}>{s}</button>
          ))}
        </div>
        {p.sido && (
          <div className="field">
            <select aria-label="시·군·구" value={p.sigungu} onChange={(e) => set({ sigungu: e.target.value })}>
              <option value="">시·군·구 선택</option>
              {SIDO[p.sido].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}
      </div>
    )
  } else if (step === 3) {
    title = <>결혼하셨나요?</>
    body = <div className="seg"><Opt value={false} cur={p.married} set={(v) => set({ married: v })} label="미혼" /><Opt value={true} cur={p.married} set={(v) => set({ married: v })} label="기혼" /></div>
  } else if (step === 4) {
    title = <>본인 명의 주택이<br />있나요?</>
    desc = '세대원 전원 기준이 필요한 정책은 상세 화면에서 따로 알려줘요'
    body = <div className="seg"><Opt value={true} cur={p.homeless} set={(v) => set({ homeless: v })} label="없어요 (무주택)" /><Opt value={false} cur={p.homeless} set={(v) => set({ homeless: v })} label="있어요" /></div>
  } else if (step === 5) {
    title = <>지금 일하고 있나요?</>
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="seg">
          <Opt<Profile["job"]> value="재직" cur={p.job} set={(v) => set({ job: v })} label="재직 중이에요" />
          <Opt<Profile["job"]> value="구직" cur={p.job} set={(v) => set({ job: v, company: null })} label="구직 중이에요 (미취업)" />
        </div>
        {p.job === '재직' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>회사 규모</div>
            <div className="seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              {(['중소기업', '중견기업', '대기업', '공공기관'] as const).map((c) => (
                <button key={c} className={`opt${p.company === c ? ' on' : ''}`} aria-pressed={p.company === c} onClick={() => set({ company: c })}>{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  } else if (step === 6) {
    title = <>작년 세전 총급여는<br />얼마인가요?</>
    desc = p.job === '구직' ? '소득이 없으면 0을, 아르바이트 소득이 있으면 그 금액을 적어주세요' : '원천징수영수증의 총급여(비과세 제외)를 적어주세요'
    body = (
      <div className="field">
        <label htmlFor="gross">연</label>
        <input id="gross" inputMode="numeric" placeholder="예: 3,200" value={p.gross == null ? '' : p.gross.toLocaleString()} onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); set({ gross: d === '' ? null : Number(d) }) }} />
        <span className="unit">만 원</span>
      </div>
    )
  } else if (step === 7) {
    title = <>부모님 건강보험료를<br />한 분씩 알려주세요</>
    desc = <>합산과 기준표 선택은 앱이 알아서 해요.<br />The건강보험 앱이나 고지서에서 볼 수 있어요.</>
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 16, fontWeight: 600 }}>원가구 인원</div><div style={{ fontSize: 13, marginTop: 2 }} className="muted">부모님 + 본인 + 형제자매</div></div>
          <div className="stepper">
            <button aria-label="한 명 줄이기" onClick={() => set({ household: Math.max(1, p.household - 1) })}>−</button>
            <span>{p.household}명</span>
            <button aria-label="한 명 늘리기" onClick={() => set({ household: Math.min(8, p.household + 1) })}>+</button>
          </div>
        </div>
        <Insurance who="아버지" v={p.father} set={(x) => set({ father: x })} />
        <Insurance who="어머니" v={p.mother} set={(x) => set({ mother: x })} />
        <div style={{ fontSize: 13, lineHeight: 1.6 }} className="muted">한 분이라도 '모름'이면 조건을 충족한 것으로 보고 '부모 소득 확인 필요'를 표시해요. 해당하지 않으면(안 계심 등) 피부양자를 골라주세요.</div>
      </div>
    )
  } else if (step === 8) {
    title = <>청약통장이 있나요?</>
    body = <div className="seg"><Opt value={true} cur={p.subscription} set={(v) => set({ subscription: v })} label="있어요" /><Opt value={false} cur={p.subscription} set={(v) => set({ subscription: v })} label="없어요" /></div>
  } else if (step === 9) {
    title = <>해당되는 항목을<br />모두 골라주세요</>
    desc = '일부 정책은 우선 선정되거나 소득 심사 없이 신청할 수 있어요.'
    const toggle = (v: string) => {
      if (v === '해당 없음') return set({ vulnerable: p.vulnerable.includes(v) ? [] : [v] })
      const rest = p.vulnerable.filter((x) => x !== '해당 없음')
      set({ vulnerable: rest.includes(v) ? rest.filter((x) => x !== v) : [...rest, v] })
    }
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {VULNERABLE.map((v, i) => {
          const on = p.vulnerable.includes(v)
          return (
            <button key={v} className={`opt left${on ? ' on' : ''}`} style={i === 0 ? { marginBottom: 8 } : undefined} aria-pressed={on} onClick={() => toggle(v)}>
              <span className={`box${on ? ' on' : ''}`} style={{ borderRadius: 11 }}>{on && Icon.check('#191F28')}</span>
              <span>{v}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const valid = stepValid(p, step)
  return (
    <div className="page">
      <div className="top">
        <button className="ib" aria-label="이전" onClick={onBack}>{Icon.back}</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#8B95A1' }}>{edit ? '정보 수정' : `${step} / ${STEP_COUNT}`}</span>
        <span style={{ width: 44 }} />
      </div>
      {!edit && <div className="progress"><i style={{ width: `${(step / STEP_COUNT) * 100}%` }} /></div>}
      <div className="pad" style={{ flex: 1, paddingTop: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 className="h1">{title}</h1>
          {desc && <p className="desc">{desc}</p>}
        </div>
        {body}
      </div>
      <div className="bottom">
        <button className="cta" disabled={!valid} onClick={onNext}>{edit ? '저장' : step === STEP_COUNT ? '결과 보기' : '다음'}</button>
      </div>
    </div>
  )
}
