import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AXES, DISCLAIMER, axisOf } from '../lib/constants'
import { ageOf, dday, matchComplexes, won } from '../lib/judge'
import { optimizeCombos } from '../lib/optimize'
import type { AxisKey, Dataset, Judgement, Policy, Profile } from '../lib/types'
import { DdayChip, Icon, StatusChip, TopBar, back, go } from '../ui'

type Ctx = {
  data: Dataset
  profile: Profile
  judged: Record<string, Judgement>
  saved: string[]
  toggleSave: (id: string) => void
  hidden: string[]
  hide: (id: string) => void
  unhide: (id: string) => void
}

const visible = (c: Ctx) => c.data.policies.filter((p) => c.judged[p.id]?.status !== 'fail')
/** 목록·개수용: 받을 수 있는 정책 중 관심없음으로 숨긴 것 제외 */
const shown = (c: Ctx) => visible(c).filter((p) => !c.hidden.includes(p.id))

/** 마감 순 정렬: 진행 중(날짜) → 상시 → 마감 지남 */
const byDeadline = (base: Date) => (a: Policy, b: Policy) => {
  const da = dday(a.deadline, base)
  const db = dday(b.deadline, base)
  const rank = (d: number | null) => (d == null ? 1 : d < 0 ? 2 : 0)
  if (rank(da) !== rank(db)) return rank(da) - rank(db)
  return (da ?? 0) - (db ?? 0)
}

export function conditionText(p: Profile, base: Date) {
  return [
    `만 ${ageOf(p, base) ?? '?'}세`,
    `${p.sido} ${p.sigungu}`.trim(),
    `희망 ${p.wishAny ? '서울 전체' : p.wish.map((w) => w.split(' ')[1]).join('·') || '-'}`,
    p.married ? '기혼' : '미혼',
    p.homeless ? '무주택' : '주택 있음',
    p.job === '재직' ? `${p.company ?? ''} 재직` : '구직 중',
    `총급여 ${won((p.gross ?? 0) * 10000)}`,
    p.subscription ? '청약통장 있음' : '청약통장 없음',
  ]
}

/* ---------- 02 결과 요약 ---------- */
export function Summary({ ctx, axes, setAxes, onBuild }: { ctx: Ctx; axes: AxisKey[]; setAxes: (a: AxisKey[]) => void; onBuild: () => void }) {
  const list = shown(ctx)
  const ok = list.filter((p) => ctx.judged[p.id].status === 'ok').length
  const parentUnknown = !ctx.profile.father.type || ctx.profile.father.type === '모름' || ctx.profile.mother.type === '모름'
  return (
    <div className="page">
      <div className="pad" style={{ paddingTop: 64, flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#4E5968' }}>지금 받을 수 있는 혜택</div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>{list.length}개</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <div style={{ flex: 1, background: '#F2F4F6', borderRadius: 16, padding: '14px 16px' }}><div className="muted" style={{ fontSize: 13 }}>해당 가능</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{ok}개</div></div>
          <div style={{ flex: 1, background: '#F2F4F6', borderRadius: 16, padding: '14px 16px' }}><div className="muted" style={{ fontSize: 13 }}>확인 필요</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{list.length - ok}개</div></div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 32 }}>대시보드에 담을 분야</div>
        <div style={{ display: 'flex', flexDirection: 'column', margin: '8px -8px 0' }}>
          {AXES.map((a) => {
            const on = axes.includes(a.key)
            const n = list.filter((p) => p.axis === a.key).length
            return (
              <button key={a.key} aria-pressed={on} onClick={() => setAxes(on ? axes.filter((x) => x !== a.key) : [...axes, a.key])} style={{ height: 64, display: 'flex', alignItems: 'center', gap: 14, padding: '0 8px', border: 0, background: 'transparent', textAlign: 'left' }}>
                <span className={`cbox${on ? ' on' : ''}`}>{on && Icon.check()}</span>
                <img src={a.img} alt="" width={36} height={36} style={{ opacity: on ? 1 : 0.35 }} />
                <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: on ? '#191F28' : '#B0B8C1' }}>{a.name}</span>
                <span className="muted" style={{ fontSize: 15 }}>{n}개</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 20 }}>
          {conditionText(ctx.profile, ctx.data.standards.baseDate).map((t) => <span key={t} className="chip c-gray">{t}</span>)}
          {parentUnknown && <span className="chip c-check">부모 소득 모름</span>}
        </div>
      </div>
      <div className="bottom">
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, textAlign: 'center', paddingBottom: 10 }}>{DISCLAIMER}</div>
        <button className="cta" disabled={!axes.length} onClick={onBuild}>대시보드 만들기</button>
      </div>
    </div>
  )
}

/* ---------- 04 홈 ---------- */
/** 검색어를 띄어쓰기로 나눠 모두 포함하는 정책 (이름 > 기관 > 내용 순으로 정렬) */
export function searchPolicies(policies: Policy[], q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, '')
  return policies
    .map((p) => {
      const name = norm(p.name), org = norm(p.org), rest = norm(`${p.axisName} ${p.benefit} ${p.amountFormula}`)
      let score = 0
      for (const w of words) {
        const k = norm(w)
        if (name.includes(k)) score += 3
        else if (org.includes(k)) score += 2
        else if (rest.includes(k)) score += 1
        else return null
      }
      return { p, score }
    })
    .filter((x): x is { p: Policy; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p)
}

function SearchResults({ ctx, q }: { ctx: Ctx; q: string }) {
  const res = searchPolicies(ctx.data.policies, q)
  if (!res.length) return <div className="muted" style={{ padding: '28px 8px', textAlign: 'center', fontSize: 15 }}>'{q}'에 맞는 정책이 없어요</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="muted" style={{ fontSize: 13, padding: '0 4px 8px' }}>검색 결과 {res.length}개</div>
      {res.map((p) => {
        const j = ctx.judged[p.id]
        const on = ctx.saved.includes(p.id)
        const fail = j?.status === 'fail'
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', borderTop: '1px solid #F2F4F6' }}>
            <a href={`#/p/${p.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={`chip c-${p.axis}`}>{axisOf(p.axis).name}</span>
                {fail ? <span className="chip c-gray">{j?.flags[0] === '지금 공고 없음' ? '지금 공고 없음' : '조건 안 맞음'}</span> : ctx.hidden.includes(p.id) ? <span className="chip c-gray">관심없음</span> : <DdayChip d={dday(p.deadline, ctx.data.standards.baseDate)} deadline={p.deadline} />}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: fail ? '#6B7684' : undefined }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.org} · {p.benefit}</div>
            </a>
            <button className="ib" aria-label={on ? '저장 취소' : '저장하기'} aria-pressed={on} onClick={() => ctx.toggleSave(p.id)}>{Icon.bookmark(on)}</button>
          </div>
        )
      })}
    </div>
  )
}

/** 지금 신청 가능 / 다음에 챙길 정책 */
type Timing = { p: Policy; kind: 'now' | 'soon' | 'next'; label: string; sort: number }
export function timingOf(p: Policy, base: Date): Timing {
  const dl = dday(p.deadline, base)
  const st = dday(p.start, base)
  if (st != null && st > 0) return { p, kind: 'soon', label: p.axis === 't' ? `연말정산 D-${st}` : `D-${st} 접수 시작`, sort: st }
  if (dl == null || dl >= 0) return { p, kind: 'now', label: dl == null ? '상시' : dl === 0 ? '오늘 마감' : `D-${dl} 마감`, sort: dl ?? 9999 }
  const m = Number(p.deadline.slice(5, 7))
  const gap = (m - (base.getMonth() + 1) + 12) % 12 || 12
  return { p, kind: 'next', label: `${m}월 접수했던 정책 · 다음 공고 대기`, sort: 1000 + gap }
}

function NowNext({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<'now' | 'next'>('now')
  const [all, setAll] = useState(false)
  const base = ctx.data.standards.baseDate
  const ts = shown(ctx).map((p) => timingOf(p, base))
  const now = ts.filter((t) => t.kind === 'now').sort((a, b) => a.sort - b.sort)
  const next = ts.filter((t) => t.kind !== 'now').sort((a, b) => a.sort - b.sort)
  const items = tab === 'now' ? now : next
  const view = all ? items : items.slice(0, 3)
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 20, padding: '6px 16px 10px' }}>
      <div role="tablist" style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
        {([['now', '지금 신청 가능', now.length], ['next', '다음에 챙길 정책', next.length]] as const).map(([k, t, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setAll(false) }}
            style={{ flex: 1, height: 40, border: 0, borderRadius: 12, fontSize: 15, fontWeight: tab === k ? 700 : 500, background: tab === k ? '#191F28' : '#F2F4F6', color: tab === k ? '#fff' : '#4E5968' }}>
            {t} {n}
          </button>
        ))}
      </div>
      {items.length === 0 && <div className="muted" style={{ padding: '14px 4px', fontSize: 14 }}>{tab === 'now' ? '지금 신청할 수 있는 정책이 없어요' : '다음에 챙길 정책이 없어요'}</div>}
      {view.map(({ p, kind, label }) => {
        const urgent = kind === 'now' && /^D-[0-7] |오늘/.test(label)
        return (
          <a key={p.id} href={`#/p/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderTop: '1px solid #F2F4F6' }}>
            <span className={`chip c-${p.axis}`} style={{ width: 64, justifyContent: 'center' }}>{axisOf(p.axis).name}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: urgent ? '#E42939' : '#8B95A1', fontWeight: urgent ? 600 : 400 }}>{label}</span>
            </span>
            {Icon.chev}
          </a>
        )
      })}
      {items.length > 3 && (
        <button onClick={() => setAll(!all)} style={{ width: '100%', height: 40, border: 0, background: 'transparent', fontSize: 14, fontWeight: 600, color: '#4E5968', borderTop: '1px solid #F2F4F6' }}>
          {all ? '접기' : `${items.length - 3}개 더 보기`}
        </button>
      )}
    </div>
  )
}

export function Home({ ctx, axes }: { ctx: Ctx; axes: AxisKey[] }) {
  const [q, setQ] = useState('')
  const list = shown(ctx)
  const comboCount = optimizeCombos(list, ctx.data.relations).reduce((s, g) => s + g.dropped.length, 0)
  return (
    <div className="page">
      <div className="top" style={{ paddingLeft: 20 }}>
        <span className="title">청년 혜택 알리미</span>
        <a className="ib" href="#/me" aria-label="내 정보">{Icon.me}</a>
      </div>
      <div className="pad" style={{ padding: '12px 20px 20px' }}>
        <h1 className="h1">어떤 혜택을 볼까요?</h1>
        <div className="muted" style={{ fontSize: 15, marginTop: 4 }}>내 조건에 맞는 정보만 모아뒀어요</div>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" aria-label="정책 검색" placeholder="정책 이름, 기관, 혜택으로 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, textAlign: "left", fontSize: 16, fontWeight: 500 }} />
          {q && <button aria-label="검색어 지우기" onClick={() => setQ('')} style={{ border: 0, background: '#B0B8C1', color: '#fff', width: 20, height: 20, borderRadius: 10, fontSize: 12, lineHeight: '20px', padding: 0 }}>✕</button>}
        </div>
      </div>
      {q.trim() ? (
        <div style={{ flex: 1, padding: '0 16px 20px' }}><SearchResults ctx={ctx} q={q.trim()} /></div>
      ) : (
      <div style={{ flex: 1, padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <NowNext ctx={ctx} />
        {AXES.filter((a) => axes.includes(a.key)).map((a) => {
          const items = list.filter((p) => p.axis === a.key)
          const ok = items.filter((p) => ctx.judged[p.id].status === 'ok').length
          return (
            <a key={a.key} href={`#/axis/${a.key}`} className="card-axis" style={{ background: a.bg, flex: 1 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: '#4E5968' }}>{a.desc}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: a.color }}>해당 {ok} · 확인 {items.length - ok}</div>
              </div>
              <img src={a.img} alt="" width={64} height={64} style={{ flexShrink: 0 }} />
            </a>
          )
        })}
        {comboCount > 0 && (
          <a href="#/combo" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 20, background: '#191F28', color: '#fff' }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>겹치는 정책 {comboCount}건, 뭘 고를까요?</span>
              <span style={{ display: 'block', fontSize: 13, color: '#B0B8C1', marginTop: 2 }}>둘 중 하나만 되는 정책 중 더 많이 받는 쪽을 골라드려요</span>
            </span>
            {Icon.chev}
          </a>
        )}
        <a href="#/saved" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 20, background: '#F2F4F6' }}>
          <img src="/assets/bookmark.png" alt="" width={36} height={36} />
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>저장함</span>
          <span className="muted" style={{ fontSize: 14 }}>{ctx.saved.length}개</span>
          {Icon.chev}
        </a>
        {ctx.data.source === 'fallback' && <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>시트에 연결하지 못해 저장된 데이터로 보여주고 있어요</div>}
      </div>
      )}
    </div>
  )
}

/* ---------- 05 축 화면 ---------- */
export function AxisList({ ctx, axis }: { ctx: Ctx; axis: AxisKey }) {
  const a = axisOf(axis)
  const base = ctx.data.standards.baseDate
  const items = shown(ctx).filter((p) => p.axis === axis).sort(byDeadline(base))
  const ok = items.filter((p) => ctx.judged[p.id].status === 'ok').length
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="page">
      <TopBar onBack={() => go('/home')} />
      <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={a.img} alt="" width={48} height={48} />
        <div><div style={{ fontSize: 24, fontWeight: 700 }}>{a.name}</div><div className="muted" style={{ fontSize: 14 }}>해당 {ok} · 확인 {items.length - ok}</div></div>
      </div>
      <div style={{ margin: '16px 16px 0', background: '#F2F4F6', borderRadius: 14, padding: '12px 8px 12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 12 }}>이 조건으로 판정했어요</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2, color: '#4E5968' }}>{conditionText(ctx.profile, base).join(' · ')}</div>
        </div>
        <a href="#/me" style={{ flexShrink: 0, height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>수정</a>
      </div>
      <div style={{ padding: '20px 20px 0', fontSize: 14, fontWeight: 600, color: '#4E5968' }}>마감 빠른 순 · {items.length}개</div>
      <div style={{ flex: 1, padding: '0 16px 0 20px' }}>
        {items.length === 0 && <div className="muted" style={{ padding: '40px 0', textAlign: 'center', fontSize: 15 }}>이 분야에서 지금 받을 수 있는 정책이 없어요</div>}
        {items.map((p) => (
          <SwipeRow key={p.id} open={openId === p.id} setOpen={(o) => setOpenId(o ? p.id : null)} onHide={() => { setOpenId(null); ctx.hide(p.id) }}>
            <a href={`#/p/${p.id}`} draggable={false} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><DdayChip d={dday(p.deadline, base)} deadline={p.deadline} /><StatusChip j={ctx.judged[p.id]} axis={axis} /></div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.org} · {p.regionBasis === '희망 지역' ? complexText(ctx, p.id) : p.benefit}</div>
            </a>
            <button className="ib" aria-label={ctx.saved.includes(p.id) ? '저장 취소' : '저장하기'} aria-pressed={ctx.saved.includes(p.id)} onClick={() => ctx.toggleSave(p.id)}>{Icon.bookmark(ctx.saved.includes(p.id))}</button>
          </SwipeRow>
        ))}
        {items.length > 0 && <div className="muted" style={{ fontSize: 12, textAlign: 'center', padding: '14px 0 20px' }}>관심 없는 정책은 왼쪽으로 밀어서 숨길 수 있어요</div>}
      </div>
      <Tabs active="list" axis={axis} />
    </div>
  )
}

const complexText = (ctx: Ctx, id: string) => {
  const cs = matchComplexes(ctx.data, id, ctx.profile)
  const gus = [...new Set(cs.map((c) => c.sigungu))]
  return `${gus.slice(0, 2).join('·')}${gus.length > 2 ? ` 외 ${gus.length - 2}곳` : ''} 단지 ${cs.length}곳`
}

const ACT_W = 96

/** 오른쪽에서 왼쪽으로 밀면 '관심없음' 버튼이 나오는 줄 */
function SwipeRow({ children, open, setOpen, onHide }: { children: ReactNode; open: boolean; setOpen: (o: boolean) => void; onHide: () => void }) {
  const start = useRef<{ x: number; y: number; base: number; locked: null | 'x' | 'y' } | null>(null)
  const moved = useRef(false)
  const [dx, setDx] = useState<number | null>(null)
  const pos = dx ?? (open ? -ACT_W : 0)
  return (
    <div className="swipe">
      <button className="act" onClick={onHide} tabIndex={open ? 0 : -1} aria-hidden={!open}>관심없음</button>
      <div
        className={`front${dx != null ? ' dragging' : ''}`}
        style={{ transform: `translateX(${pos}px)` }}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, base: open ? -ACT_W : 0, locked: null }
          moved.current = false
        }}
        onPointerMove={(e) => {
          const st = start.current
          if (!st) return
          const mx = e.clientX - st.x
          const my = e.clientY - st.y
          if (!st.locked) {
            if (Math.abs(mx) < 6 && Math.abs(my) < 6) return
            st.locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
            if (st.locked === 'x') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          }
          if (st.locked !== 'x') return
          moved.current = true
          setDx(Math.max(-ACT_W - 24, Math.min(0, st.base + mx)))
        }}
        onPointerUp={() => {
          if (start.current?.locked === 'x' && dx != null) setOpen(dx < -ACT_W / 2)
          start.current = null
          setDx(null)
        }}
        onPointerCancel={() => {
          start.current = null
          setDx(null)
        }}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
          } else if (open) {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function Tabs({ active, axis }: { active: 'list' | 'saved'; axis?: AxisKey }) {
  return (
    <div className="tabs">
      <a href={`#/axis/${axis ?? 'h'}`} className={`tab${active === 'list' ? ' on' : ''}`}>{Icon.list}마감순</a>
      <a href={`#/saved${axis ? `?from=${axis}` : ''}`} className={`tab${active === 'saved' ? ' on' : ''}`}>{Icon.bookmark(active === 'saved', 'currentColor')}저장함</a>
    </div>
  )
}

/* ---------- 06 정책 상세 ---------- */
const REL_GROUPS: { type: string; title: string; color: string }[] = [
  { type: '같이 가능', title: '같이 받을 수 있어요', color: '#0F766E' },
  { type: '둘 중 하나', title: '둘 중 하나만 받을 수 있어요', color: '#E42939' },
  { type: '조건 변화', title: '조건이 바뀌면 달라져요', color: '#4E5968' },
  { type: '확인 필요', title: '함께 받을 수 있는지 확인이 필요해요', color: '#6B7684' },
]

export function Detail({ ctx, id }: { ctx: Ctx; id: string }) {
  const p = ctx.data.policies.find((x) => x.id === id)
  if (!p) return <div className="page"><TopBar onBack={() => back('/home')} /><div className="pad muted">정책을 찾지 못했어요</div></div>
  const a = axisOf(p.axis)
  const j = ctx.judged[p.id]
  const base = ctx.data.standards.baseDate
  const on = ctx.saved.includes(p.id)
  const isHidden = ctx.hidden.includes(p.id)
  const hasCompare = ctx.data.products.some((x) => x.policyId === p.id)
  const complexes = p.regionBasis === '희망 지역' ? matchComplexes(ctx.data, p.id, ctx.profile) : []
  const mine = new Set(visible(ctx).map((x) => x.id))
  const rels = ctx.data.relations
    .filter((r) => (r.a === p.id && mine.has(r.b)) || (r.b === p.id && mine.has(r.a)))
    .map((r) => ({ ...r, other: ctx.data.policies.find((x) => x.id === (r.a === p.id ? r.b : r.a))! }))
    .filter((r) => r.other)
  const applyHost = (() => { try { return new URL(p.url).hostname.replace(/^www\./, '') } catch { return '' } })()
  return (
    <div className="page">
      <TopBar onBack={() => back(`/axis/${p.axis}`)} />
      <div className="pad" style={{ paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}><DdayChip d={dday(p.deadline, base)} deadline={p.deadline} /><span className={`chip c-${p.axis}`}>{a.name}</span>{j.status === 'check' && <span className="chip c-check">{j.flags[0]}</span>}{j.status === 'fail' && <span className="chip c-gray">{j.flags[0] === '지금 공고 없음' ? '희망 지역에 지금 공고 없음' : '지금 조건으론 어려워요'}</span>}</div>
        <h1 className="h1">{p.name}</h1>
        <div className="muted" style={{ fontSize: 15 }}>{p.org}</div>
        <div style={{ marginTop: 14, background: a.bg, borderRadius: 20, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: a.color }}>예상 지원 금액</div>
          <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.45, marginTop: 6 }}>{p.amountFormula}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, fontSize: 15, lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 16 }}><span className="muted" style={{ width: 64, flexShrink: 0 }}>지원 내용</span><span>{p.benefit}</span></div>
          <div style={{ display: 'flex', gap: 16 }}><span className="muted" style={{ width: 64, flexShrink: 0 }}>접수 일정</span><span>{p.realSchedule}</span></div>
        </div>
        {isHidden ? (
          <button className="cta2" style={{ marginTop: 8, height: 48 }} onClick={() => ctx.unhide(p.id)}>관심없음 취소</button>
        ) : (
          <>
            <button className="cta2" style={{ marginTop: 8, height: 48 }} aria-pressed={on} onClick={() => ctx.toggleSave(p.id)}>{Icon.bookmark(on)}{on ? '저장됨' : '저장하기'}</button>
            <button style={{ height: 44, border: 0, background: 'transparent', fontSize: 15, fontWeight: 500, color: '#8B95A1' }} onClick={() => { ctx.hide(p.id); back(`/axis/${p.axis}`) }}>관심없음</button>
          </>
        )}
      </div>
      {p.regionBasis === '희망 지역' && (
        <>
          <div className="sep" />
          <div className="pad" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700 }}>희망 지역 공고</h2>
            <div className="muted" style={{ fontSize: 14, marginBottom: 6 }}>{ctx.profile.wishAny ? '서울 전체' : ctx.profile.wish.join(', ')}에 나온 단지예요</div>
            {complexes.map((c) => {
              const cd = dday(c.deadline, base)
              return (
                <a key={c.id} href={c.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #F2F4F6' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}><DdayChip d={cd} deadline={c.deadline || '상시'} /><span className="muted" style={{ fontSize: 13 }}>{c.sido} {c.sigungu}</span></div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{[c.supply, c.terms, c.start && c.deadline ? `접수 ${c.start.slice(5).replace('-', '/')} ~ ${c.deadline.slice(5).replace('-', '/')}` : ''].filter(Boolean).join(' · ')}</div>
                  </div>
                  {Icon.chev}
                </a>
              )
            })}
            {complexes.some((c) => c.note.includes('샘플')) && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>지금 보이는 단지는 화면 확인용 샘플이에요</div>}
          </div>
        </>
      )}
      <div className="sep" />
      <div className="pad" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>내 자격 판정</h2>
        {j.rows.length === 0 && <div className="muted" style={{ fontSize: 15, padding: '12px 0' }}>별도 자격 조건이 없어요</div>}
        {j.rows.map((r, i) => (
          <div key={i} style={{ padding: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: i < j.rows.length - 1 ? '1px solid #F2F4F6' : 0 }}>
            <div><div style={{ fontSize: 15, fontWeight: 600 }}>{r.label}</div><div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{r.mine}</div></div>
            {r.result === 'ok' ? <span className={`chip c-${p.axis}`}>충족</span> : r.result === 'check' ? <span className="chip c-check">확인 필요</span> : <span className="chip c-gray">참고</span>}
          </div>
        ))}
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{DISCLAIMER}</div>
      </div>
      <div className="sep" />
      <div className="pad" style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><h2 style={{ fontSize: 19, fontWeight: 700 }}>내가 받을 수 있는 다른 정책과 비교</h2><div className="muted" style={{ fontSize: 14, marginTop: 4 }}>받을 수 있는 {mine.size}개 중 이 정책과 관련 있는 것만 보여줘요</div></div>
        {rels.length === 0 && <div className="muted" style={{ fontSize: 15, background: '#F2F4F6', borderRadius: 16, padding: '16px 18px' }}>내가 받을 수 있는 정책 중에는 함께 따져볼 정책이 없어요</div>}
        {REL_GROUPS.map((g) => {
          const items = rels.filter((r) => r.type === g.type)
          if (!items.length) return null
          return (
            <div key={g.type} style={{ background: '#F2F4F6', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: g.color }}>{g.title}</div>
              {items.map((r, i) => (
                <a key={i} href={`#/p/${r.other.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600 }}><span style={{ flex: 1 }}>{r.other.name}</span><span className={`chip c-${r.other.axis}`}>{axisOf(r.other.axis).name}</span></div>
                  <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{r.desc}{r.basis.includes('추정') ? ' (추정)' : ''}</div>
                  {g.type === '둘 중 하나' && (p.total ?? 0) > 0 && (r.other.total ?? 0) > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: (p.total ?? 0) >= (r.other.total ?? 0) ? '#0F766E' : '#E42939' }}>
                      최대 지원 총액 · 이 정책 {(p.total ?? 0).toLocaleString()}만 원 vs {(r.other.total ?? 0).toLocaleString()}만 원 → {(p.total ?? 0) >= (r.other.total ?? 0) ? '이 정책이 더 커요' : '다른 쪽이 더 커요'}
                    </div>
                  )}
                </a>
              ))}
            </div>
          )
        })}
      </div>
      <div className="bottom">
        {p.id === 'T01' ? (
          <>
            <a className="cta" href="#/calc/T01">세액공제 vs 현금영수증 계산하기</a>
            <a href={p.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, fontSize: 14, color: '#6B7684' }}>{applyHost ? `${applyHost}에서 안내 보기` : '안내 보기'}{Icon.ext}</a>
          </>
        ) : hasCompare ? (
          <>
            <a className="cta" href={`#/compare/${p.id}`}>{ctx.data.products.some((x) => x.policyId === p.id && x.kind) ? "내 유형 찾고 비교하기" : "최적 선택지 찾기"}</a>
            <a href={p.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, fontSize: 14, color: '#6B7684' }}>{applyHost ? `${applyHost}에서 안내 보기` : '안내 보기'}{Icon.ext}</a>
          </>
        ) : (
          <a className="cta" href={p.url} target="_blank" rel="noreferrer">{applyHost ? `${applyHost}에서 신청하기` : '신청하러 가기'}{Icon.ext}</a>
        )}
      </div>
    </div>
  )
}

/* ---------- 07 저장함 ---------- */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseD = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : null)
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

export function Saved({ ctx, from }: { ctx: Ctx; from?: AxisKey }) {
  const base = ctx.data.standards.baseDate
  const [month, setMonth] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))
  const [sel, setSel] = useState<string | null>(null)
  const items = useMemo(() => ctx.saved.map((id) => ctx.data.policies.find((p) => p.id === id)).filter(Boolean) as Policy[], [ctx.saved, ctx.data.policies])

  const marks: Record<string, AxisKey[]> = {}
  for (const p of items) if (parseD(p.deadline)) (marks[p.deadline] ||= []).push(p.axis)

  const first = month.getDay()
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]

  // 일정표: 오늘부터 4주
  const W = 29
  const w0 = base.getTime()
  const dayIdx = (d: Date) => Math.round((d.getTime() - w0) / 86400000)
  const rows = items
    .filter((p) => { const e = parseD(p.deadline); return !e || e >= base })
    .sort(byDeadline(base))
  const ticks = [0, 7, 14, 21, 28].map((i) => ({ i, label: i === 0 ? '오늘' : md(new Date(w0 + i * 86400000)) }))
  const pct = (n: number) => `${(n / W) * 100}%`

  return (
    <div className="page">
      <TopBar onBack={() => go(from ? `/axis/${from}` : '/home')} title="저장함" />
      <div className="pad muted" style={{ fontSize: 14 }}>4개 분야에서 저장한 정책 {items.length}개</div>
      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, textAlign: 'center' }}>
          <img src="/assets/bookmark.png" alt="" width={72} height={72} />
          <div style={{ fontSize: 17, fontWeight: 600 }}>아직 저장한 정책이 없어요</div>
          <div className="muted" style={{ fontSize: 14 }}>정책 목록이나 상세에서 북마크를 누르면 여기에 모여요</div>
          <a className="cta2" href="#/home" style={{ width: 200, marginTop: 8 }}>정책 보러 가기</a>
        </div>
      ) : (
        <>
          <div style={{ padding: '8px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button className="ib" aria-label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>{Icon.back}</button>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{month.getFullYear()}년 {month.getMonth() + 1}월</div>
            <button className="ib" aria-label="다음 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>{Icon.next}</button>
          </div>
          <div style={{ padding: '0 24px 8px', display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#4E5968' }}>
            {AXES.map((a) => <span key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 6, height: 6, borderRadius: 3, background: a.color, display: 'block' }} />{a.name}</span>)}
            <span style={{ color: '#8B95A1' }}>점 = 마감일</span>
          </div>
          <div className="cal" style={{ padding: '0 12px', fontSize: 12, color: '#8B95A1', textAlign: 'center' }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => <div key={d} style={{ padding: '6px 0' }}>{d}</div>)}
          </div>
          <div className="cal" style={{ padding: '0 12px' }}>
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const k = ymd(d)
              const m = marks[k]
              const isSel = sel === k
              const isToday = k === ymd(base)
              return (
                <button key={i} aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${m ? ` 마감 ${m.length}건` : ''}`} onClick={() => setSel(isSel || !m ? null : k)}>
                  <span className="num" style={isSel ? { background: '#191F28', color: '#fff', fontWeight: 700 } : isToday ? { background: '#F2F4F6', fontWeight: 700 } : undefined}>{d.getDate()}</span>
                  <span className="dots">{(m || []).map((ax, n) => <i key={n} style={{ background: axisOf(ax).color }} />)}</span>
                </button>
              )
            })}
          </div>
          <div className="sep" style={{ marginTop: 12 }} />
          <div style={{ padding: '20px 24px 12px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 12 }}>
              <div style={{ fontSize: 19, fontWeight: 700 }}>접수 기간</div>
              <div className="muted" style={{ fontSize: 13 }}>{sel ? `${Number(sel.slice(5, 7))}월 ${Number(sel.slice(8))}일 마감 강조` : '오늘부터 4주 · 마감 빠른 순'}</div>
            </div>
            <div style={{ position: 'relative', height: 18, fontSize: 12, color: '#8B95A1' }}>
              {ticks.map((t) => (
                <span key={t.i} style={t.i === 28 ? { position: 'absolute', right: 0 } : { position: 'absolute', left: pct(t.i + 0.5), transform: t.i === 0 ? 'none' : 'translateX(-50%)', fontWeight: t.i === 0 ? 700 : 400, color: t.i === 0 ? '#191F28' : undefined }}>{t.label}</span>
              ))}
            </div>
            {rows.map((p) => {
              const a = axisOf(p.axis)
              const s = parseD(p.start)
              const e = parseD(p.deadline)
              const si = s ? Math.max(0, dayIdx(s)) : 0
              const ei = e ? Math.min(W - 1, dayIdx(e)) : W - 1
              const before = !!s && dayIdx(s) > 0
              const cutR = !e || dayIdx(e) > W - 1
              const dl = dday(p.deadline, base)
              const hit = sel != null && sel === p.deadline
              const dim = sel != null && !hit
              const show = si <= W - 1
              return (
                <div key={p.id} style={{ padding: hit ? 14 : '14px 0', margin: hit ? '0 -14px' : 0, borderRadius: hit ? 16 : 0, background: hit ? a.bg : undefined, borderBottom: hit ? 0 : '1px solid #F2F4F6', opacity: dim ? 0.35 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: a.color }}>{a.name}</span>
                        <span className="muted">{p.org}</span>
                        {before ? <span style={{ background: '#191F28', color: '#fff', borderRadius: 6, padding: '0 6px', lineHeight: '20px', fontWeight: 600 }}>{md(s!)} 시작</span> : <span style={{ background: '#F2F4F6', color: '#6B7684', borderRadius: 6, padding: '0 6px', lineHeight: '20px', fontWeight: 600 }}>{p.start === '상시' ? '상시' : '접수 중'}</span>}
                      </div>
                      <a href={`#/p/${p.id}`} style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</a>
                    </div>
                    <a href={p.url} target="_blank" rel="noreferrer" aria-label={`${p.name} 신청 페이지로 이동`} style={{ flexShrink: 0, height: 36, padding: '0 12px', background: '#191F28', color: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 3, fontSize: 14, fontWeight: 600 }}>신청{Icon.ext}</a>
                  </div>
                  <div style={{ position: 'relative', height: 12, marginTop: 10 }}>
                    {show && <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(si), width: pct(ei - si + 1), borderRadius: `${si === 0 && !before ? 0 : 6}px ${cutR ? 0 : 6}px ${cutR ? 0 : 6}px ${si === 0 && !before ? 0 : 6}px`, background: before ? a.bg : a.color, boxShadow: before ? `inset 0 0 0 2px ${a.color}` : undefined }} />}
                  </div>
                  <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 13 }}>
                    <span>{p.start === '상시' && p.deadline === '상시' ? '상시 접수' : `접수 ${s ? md(s) : ''} ~ ${e ? md(e) : '상시'}`}</span>
                    <span style={dl != null && dl <= 7 ? { fontWeight: 700, color: '#E42939' } : undefined}>{dl == null ? '' : dl === 0 ? '오늘 마감' : `마감 D-${dl}`}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      <Tabs active="saved" axis={from} />
    </div>
  )
}

/* ---------- 08 내 정보 ---------- */
export function Me({ ctx, onRebuild, onReset }: { ctx: Ctx; onRebuild: () => void; onReset: () => void }) {
  const p = ctx.profile
  const [confirm, setConfirm] = useState(false)
  const ins = (x: Profile['father']) => (x.type === '직장' || x.type === '지역' ? `${x.type} · 월 ${(x.premium ?? 0).toLocaleString()}원` : x.type ?? '-')
  const groups: { title: string; rows: [string, string, number][] }[] = [
    { title: '기본', rows: [['생년월일', `${p.birthYear}.${String(p.birthMonth).padStart(2, '0')} (만 ${ageOf(p, ctx.data.standards.baseDate)}세)`, 1], ['거주지', `${p.sido} ${p.sigungu}`, 2], ['혼인', p.married ? '기혼' : '미혼', 4]] },
    { title: '주거', rows: [['입주 희망 지역', p.wishAny ? '상관없음 (서울 전체)' : p.wish.join(', ') || '-', 3], ['주택 소유', p.homeless ? '무주택' : '주택 있음', 5], ['청약통장', p.subscription ? '있음' : '없음', 9]] },
    { title: '고용·소득', rows: [['상태', p.job === '재직' ? `재직 · ${p.company}` : '구직 중', 6], ['세전 총급여', `${(p.gross ?? 0).toLocaleString()}만 원`, 7]] },
    { title: '부모 소득', rows: [['원가구 인원', `${p.household}명`, 8], ['아버지', ins(p.father), 8], ['어머니', ins(p.mother), 8]] },
    { title: '해당 항목', rows: [['선택', p.vulnerable.join(', ') || '-', 10]] },
  ]
  return (
    <div className="page">
      <TopBar onBack={() => back('/home')} title="내 정보" right={false} />
      <div className="pad" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ background: '#F2F4F6', borderRadius: 14, padding: '14px 16px', fontSize: 14, lineHeight: 1.6, color: '#4E5968' }}>이 정보는 이 기기의 브라우저에만 저장돼요. 수정하면 바뀐 조건으로 대시보드를 다시 만들어요.</div>
        {groups.map((g) => (
          <div key={g.title}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#8B95A1', padding: '8px 0 2px' }}>{g.title}</div>
            {g.rows.map(([k, v, step]) => (
              <a key={k} href={`#/edit/${step}`} style={{ minHeight: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="muted" style={{ width: 96, flexShrink: 0, fontSize: 15 }}>{k}</span>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{v}</span>
                {Icon.chev}
              </a>
            ))}
          </div>
        ))}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#8B95A1', padding: '8px 0 2px' }}>관심없음으로 숨긴 정책 {ctx.hidden.length}개</div>
          {ctx.hidden.length === 0 && <div className="muted" style={{ fontSize: 14, padding: '12px 0' }}>목록에서 왼쪽으로 밀거나 상세에서 관심없음을 누르면 여기 모여요</div>}
          {ctx.hidden.map((id) => {
            const hp = ctx.data.policies.find((x) => x.id === id)
            if (!hp) return null
            return (
              <div key={id} style={{ minHeight: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`chip c-${hp.axis}`}>{axisOf(hp.axis).name}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{hp.name}</span>
                <button onClick={() => ctx.unhide(id)} style={{ height: 36, padding: '0 12px', border: 0, borderRadius: 10, background: '#F2F4F6', fontSize: 14, fontWeight: 600 }}>되돌리기</button>
              </div>
            )
          })}
        </div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>부모 소득을 '모름'으로 두면 해당 정책에 '부모 소득 확인 필요'가 표시돼요.</div>
      </div>
      <div className="bottom" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="cta" onClick={onRebuild}>대시보드 다시 만들기</button>
        <button style={{ height: 48, border: 0, background: 'transparent', fontSize: 15, color: confirm ? '#E42939' : '#8B95A1' }} onClick={() => (confirm ? onReset() : setConfirm(true))}>
          {confirm ? '한 번 더 누르면 모든 정보와 저장함이 지워져요' : '정보 초기화하고 처음부터 입력'}
        </button>
      </div>
    </div>
  )
}
