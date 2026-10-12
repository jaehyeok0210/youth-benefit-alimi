import type { AxisKey, Profile } from './types'

const KEY = 'yba:v1'

export interface AppState {
  profile: Profile
  onboarded: boolean
  axes: AxisKey[]
  saved: string[]
  hidden: string[]
}

export const emptyProfile = (): Profile => ({
  birthYear: null,
  birthMonth: null,
  sido: '',
  sigungu: '',
  wish: [],
  wishAny: false,
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
  hidden: [],
})

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initialState()
    const s = JSON.parse(raw)
    // 희망 지역 문항이 생기기 전에 저장된 프로필은 '상관없음'으로 간주
    const migrated = s.profile && !('wish' in s.profile) ? { wishAny: true } : {}
    return { ...initialState(), ...s, profile: { ...emptyProfile(), ...s.profile, ...migrated } }
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
