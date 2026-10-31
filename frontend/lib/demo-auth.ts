export type FarmerPreferences = {
  name: string
  mobile: string
  email: string
  language: string
  state: string
  district: string
  village: string
  acres: string
  landStatus: string
  soil: string
  irrigation: string
  crops: string[]
  interaction: "voice" | "text"
  weatherAlerts: boolean
  schemeUpdates: boolean
  cropAlerts: boolean
}

export type DemoSession = {
  name: string
  mobile: string
  email?: string
  language: string
  onboarding?: FarmerPreferences
  remember?: boolean
}

export type PendingSignup = Pick<DemoSession, "name" | "mobile" | "email" | "language">

const SESSION_KEY = "farmly-demo-session"
const SIGNUP_KEY = "farmly-demo-pending-signup"
const DRAFT_KEY = "farmly-demo-onboarding-draft"
const RESET_KEY = "farmly-demo-reset-contact"
const RESET_VERIFIED_KEY = "farmly-demo-reset-verified"

function readValue<T>(storage: Storage, key: string): T | null {
  try {
    const value = storage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null
  const remembered = readValue<DemoSession>(window.localStorage, SESSION_KEY)
  if (remembered) return { ...remembered, remember: true }
  const current = readValue<DemoSession>(window.sessionStorage, SESSION_KEY)
  return current ? { ...current, remember: false } : null
}

export function saveDemoSession(session: DemoSession, remember = false) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(SESSION_KEY)
    const storage = remember ? window.localStorage : window.sessionStorage
    storage.setItem(SESSION_KEY, JSON.stringify({ ...session, remember }))
  } catch {
    // Keep this demo usable if browser storage is unavailable.
  }
}

export function clearDemoSession() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(DRAFT_KEY)
    window.sessionStorage.removeItem(SIGNUP_KEY)
  } catch {
    // No credentials are stored by this demo service.
  }
}

export function savePendingSignup(signup: PendingSignup) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(SIGNUP_KEY, JSON.stringify(signup))
  } catch {
    // The registration can still continue for this browser session.
  }
}

export function getPendingSignup(): PendingSignup | null {
  if (typeof window === "undefined") return null
  return readValue<PendingSignup>(window.sessionStorage, SIGNUP_KEY)
}

export function clearPendingSignup() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(SIGNUP_KEY)
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function saveOnboardingDraft(draft: unknown) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // The wizard remains usable without draft persistence.
  }
}

export function getOnboardingDraft<T>(): T | null {
  if (typeof window === "undefined") return null
  return readValue<T>(window.sessionStorage, DRAFT_KEY)
}

export function clearOnboardingDraft() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function saveResetContact(contact: string) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(RESET_KEY, contact)
    window.sessionStorage.removeItem(RESET_VERIFIED_KEY)
  } catch {
    // Reset remains a clearly labeled demo flow.
  }
}

export function getResetContact() {
  if (typeof window === "undefined") return ""
  try {
    return window.sessionStorage.getItem(RESET_KEY) || ""
  } catch {
    return ""
  }
}

export function setResetVerified(verified: boolean) {
  if (typeof window === "undefined") return
  try {
    if (verified) window.sessionStorage.setItem(RESET_VERIFIED_KEY, "true")
    else window.sessionStorage.removeItem(RESET_VERIFIED_KEY)
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function isResetVerified() {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(RESET_VERIFIED_KEY) === "true"
  } catch {
    return false
  }
}
