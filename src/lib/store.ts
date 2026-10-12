import type { AxisKey, Profile } from './types'

const KEY = 'yba:v1'

export interface AppState {
  profile: Profile
  onboarded: boolean
  axes: AxisKey[]
  saved: string[]
}

export const emptyProfile = (): Profile => ({
  birthYear: null,
  birthMonth: null,
  sido: '',
  sigungu: '',
  married: null,
  homeless: null,
  job: null,
  company: null,
  gross: null,
  household: 4,
  father: { type: null, premium: null },
  mother: { type: null, premium: null },
  subscription: null,
  vulnerable: [],
})

export const initialState = (): AppState => ({
  profile: emptyProfile(),
  onboarded: false,
  axes: ['h', 'f', 'j', 't'],
  saved: [],
})

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initialState()
    const s = JSON.parse(raw)
    return { ...initialState(), ...s, profile: { ...emptyProfile(), ...s.profile } }
  } catch {
    return initialState()
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
