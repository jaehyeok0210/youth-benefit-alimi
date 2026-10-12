import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AXES } from './lib/constants'
import type { AxisKey, Judgement } from './lib/types'

export const go = (path: string) => {
  window.location.hash = path
}
export const back = (fallback: string) => {
  if (window.history.length > 1) window.history.back()
  else go(fallback)
}

export const Icon = {
  back: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  next: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  chev: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  me: (
    <span className="me">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4E5968" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    </span>
  ),
  ext: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  ),
  check: (color = '#fff') => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  ),
  bookmark: (on: boolean, color = on ? '#191F28' : '#B0B8C1') => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? color : 'none'} stroke={color} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  ),
  list: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
}

export function TopBar({ onBack, title, right = true }: { onBack?: () => void; title?: string; right?: boolean }) {
  return (
    <div className="top">
      {onBack ? (
        <button className="ib" aria-label="뒤로" onClick={onBack}>
          {Icon.back}
        </button>
      ) : (
        <span style={{ width: 44 }} />
      )}
      <span className="title">{title}</span>
      {right ? (
        <a className="ib" href="#/me" aria-label="내 정보">
          {Icon.me}
        </a>
      ) : (
        <span style={{ width: 44 }} />
      )}
    </div>
  )
}

export function StatusChip({ j, axis }: { j: Judgement; axis: AxisKey }) {
  if (j.status === 'check') return <span className="chip c-check">{j.flags[0] ?? '확인 필요'}</span>
  return <span className={`chip c-${axis}`}>해당 가능</span>
}

export function DdayChip({ d, deadline }: { d: number | null; deadline: string }) {
  if (d == null) return <span className="chip c-gray">{deadline === '상시' ? '상시' : deadline}</span>
  if (d < 0) return <span className="chip c-gray">접수 마감</span>
  if (d === 0) return <span className="chip c-red">오늘 마감</span>
  return <span className={`chip ${d <= 7 ? 'c-red' : 'c-gray'}`}>D-{d}</span>
}

const MSGS_FIRST = ['공고에서 내 조건을 맞춰보는 중', '부모 소득 기준을 확인하는 중', '같이 받을 수 있는 정책을 정리하는 중']
const MSGS_REBUILD = ['바뀐 조건으로 다시 판정하는 중', '새로 받을 수 있는 정책을 찾는 중', '저장한 정책은 그대로 옮기는 중']

export function Loading({ rebuild, onDone }: { rebuild?: boolean; onDone: () => void }) {
  const [pct, setPct] = useState(0)
  const msgs = rebuild ? MSGS_REBUILD : MSGS_FIRST
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    const start = performance.now()
    const total = 3600
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total)
      // 단계마다 잠깐 멈췄다 채워지는 느낌
      const stepped = Math.min(1, Math.floor(t * 3) / 3 + ((t * 3) % 1) ** 2 / 3)
      setPct(stepped * 100)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setTimeout(() => doneRef.current(), 250)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const idx = Math.min(2, Math.floor(pct / 33.34))
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="tiles" aria-hidden="true">
        {AXES.map((a, i) => (
          <i key={a.key} style={{ background: a.color, animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <h1 className="h1">{rebuild ? <>바뀐 조건으로<br />대시보드를 다시 만들고 있어요</> : <>내 대시보드를<br />만들고 있어요</>}</h1>
        <div key={idx} className="lmsg">
          {msgs[idx]}
        </div>
      </div>
      <div className="lbar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="toast" role="status">
      {children}
    </div>
  )
}
