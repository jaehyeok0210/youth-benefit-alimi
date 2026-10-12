import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadData } from './lib/data'
import { judgeAll } from './lib/judge'
import { clearState, initialState, loadState, saveState, type AppState } from './lib/store'
import type { AxisKey, Dataset } from './lib/types'
import Onboarding, { STEP_COUNT } from './screens/Onboarding'
import { AxisList, Detail, Home, Me, Saved, Summary } from './screens/Main'
import Intro, { Splash } from './screens/Intro'
import { Loading, Toast, go } from './ui'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash.slice(1) || '/')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const [data, setData] = useState<Dataset | null>(null)
  const [error, setError] = useState('')
  const [state, setState] = useState<AppState>(loadState)
  const [loading, setLoading] = useState<null | 'first' | 'rebuild'>(null)
  const [toast, setToast] = useState(0)
  const hash = useHash()

  useEffect(() => {
    loadData().then(setData).catch((e) => setError(String(e)))
  }, [])
  useEffect(() => saveState(state), [state])

  const judged = useMemo(() => (data && state.onboarded ? judgeAll(data, state.profile) : {}), [data, state.profile, state.onboarded])
  const toggleSave = useCallback(
    (id: string) => setState((s) => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
    [],
  )
  const finishLoading = useCallback(() => {
    const wasRebuild = loading === 'rebuild'
    setLoading(null)
    go('/home')
    if (wasRebuild) setToast((t) => t + 1)
  }, [loading])

  if (error) return <div className="app"><div className="pad" style={{ paddingTop: 80 }}><h1 className="h1">데이터를 불러오지 못했어요</h1><p className="desc">{error}</p></div></div>
  const [path, query] = hash.split('?')
  const parts = path.split('/').filter(Boolean)
  const route = parts[0] || ''

  // 첫 화면·질문은 데이터 없이도 바로 보여줌
  if (!state.onboarded && !['', 'start', 'summary'].includes(route)) {
    go('/')
    return null
  }
  if (route === '' && state.onboarded) {
    go('/home')
    return null
  }
  const step = Math.min(STEP_COUNT, Math.max(1, Number(parts[1]) || 1))
  const needsData = !['', 'start', 'edit'].includes(route)
  if (needsData && !data) return <div className="app"><Splash /></div>
  const ctx = data ? { data, profile: state.profile, judged, saved: state.saved, toggleSave } : null!

  let screen: ReactNode = null
  if (route === '') {
    screen = <Intro onStart={() => go('/start/1')} />
  } else if (route === 'start' || route === 'edit') {
    const edit = route === 'edit'
    screen = (
      <Onboarding
        profile={state.profile}
        step={step}
        edit={edit}
        onChange={(profile) => setState((s) => ({ ...s, profile }))}
        onBack={() => (edit ? go('/me') : step > 1 ? go(`/start/${step - 1}`) : go('/'))}
        onNext={() => {
          if (edit) return go('/me')
          if (step < STEP_COUNT) return go(`/start/${step + 1}`)
          setState((s) => ({ ...s, onboarded: true }))
          go('/summary')
        }}
      />
    )
  } else if (route === 'summary') {
    if (!state.onboarded) { go('/start/1'); return null }
    screen = <Summary ctx={ctx} axes={state.axes} setAxes={(axes) => setState((s) => ({ ...s, axes }))} onBuild={() => setLoading('first')} />
  } else if (route === 'home') {
    screen = <Home ctx={ctx} axes={state.axes} />
  } else if (route === 'axis') {
    const k = (['h', 'f', 'j', 't'].includes(parts[1]) ? parts[1] : 'h') as AxisKey
    screen = <AxisList ctx={ctx} axis={k} />
  } else if (route === 'p') {
    screen = <Detail ctx={ctx} id={parts[1]} />
  } else if (route === 'saved') {
    const from = new URLSearchParams(query || '').get('from') as AxisKey | null
    screen = <Saved ctx={ctx} from={from ?? undefined} />
  } else if (route === 'me') {
    screen = (
      <Me
        ctx={ctx}
        onRebuild={() => setLoading('rebuild')}
        onReset={() => {
          clearState()
          setState(initialState())
          go('/')
        }}
      />
    )
  } else {
    go('/home')
    return null
  }

  return (
    <div className="app">
      {screen}
      {loading && <Loading rebuild={loading === 'rebuild'} onDone={finishLoading} />}
      {toast > 0 && <Toast key={toast}>바뀐 조건으로 대시보드를 다시 만들었어요</Toast>}
    </div>
  )
}
