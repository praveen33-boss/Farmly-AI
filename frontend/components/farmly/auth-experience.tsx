"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FarmlyApp } from "./farmly-app"
import { LocationSelect } from "./location-select"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, Leaf, LoaderCircle, LockKeyhole, MapPin, ShieldCheck, Sprout, Sun, Volume2 } from "lucide-react"
import {
  clearOnboardingDraft,
  clearPendingSignup,
  getDemoSession,
  getOnboardingDraft,
  getPendingSignup,
  getResetContact,
  isResetVerified,
  saveDemoSession,
  saveOnboardingDraft,
  savePendingSignup,
  saveResetContact,
  setResetVerified,
  type DemoSession,
  type FarmerPreferences,
  type PendingSignup,
} from "@/lib/demo-auth"

type AuthMode = "login" | "signup" | "verify-otp" | "forgot-password" | "reset-password" | "onboarding" | "dashboard"
const languageOptions = ["English", "हिंदी", "తెలుగు", "मराठी", "தமிழ்", "ਪੰਜਾਬੀ"]
const cropOptions = ["Paddy", "Wheat", "Maize", "Tomato", "Potato", "Mustard", "Soybean", "Groundnut", "Cotton", "Pulses"]

function Brand() {
  return <Link href="/" className="auth-brand" aria-label="Farmly.AI home"><span className="auth-brand-mark"><Leaf size={20} strokeWidth={2.2} /></span><span><strong>Farmly<span>.AI</span></strong><small>Your farm. Your language. Smarter decisions.</small></span></Link>
}

function AuthField({ label, htmlFor, error, children, hint }: { label: string; htmlFor: string; error?: string; children: ReactNode; hint?: string }) {
  return <div className={`auth-field ${error ? "has-error" : ""}`}><label htmlFor={htmlFor}>{label}</label>{children}{error ? <span className="field-error" id={`${htmlFor}-error`}>{error}</span> : hint ? <span className="field-hint" id={`${htmlFor}-hint`}>{hint}</span> : null}</div>
}

function DemoNotice({ children = "Demo mode · no real account, SMS, email, or Google sign-in is connected." }: { children?: ReactNode }) {
  return <div className="demo-auth-note" role="note"><ShieldCheck size={15} /><span>{children}</span></div>
}

function AuthHero({ mode }: { mode: AuthMode }) {
  const content = mode === "signup"
    ? { eyebrow: "MADE FOR YOUR FARM", title: "Start your smarter farming journey.", body: "Create your Farmly.AI account and get personalized agricultural guidance in your preferred language.", bullets: ["Personal crop recommendations", "Government schemes and subsidies", "Support in your own language"] }
    : mode === "login"
      ? { eyebrow: "WELCOME TO FARMLY.AI", title: "Welcome back to smarter farming.", body: "Your farm insights, crop recommendations, market intelligence, and government benefits are just one conversation away.", bullets: ["Smart crop planning", "Regional voice assistance", "Government scheme discovery"] }
      : { eyebrow: "A LITTLE HELP, WHEN YOU NEED IT", title: mode === "verify-otp" ? "One quick check, then you’re in." : "Your farm journey is in good hands.", body: "A simple, friendly way to keep your Farmly.AI account moving forward.", bullets: ["Built around Indian farming", "Guidance in your language", "Your details stay in this browser demo"] }
  return <aside className="auth-hero"><Image src="/farmly-field.png" alt="An Indian farmer in a green agricultural field" fill priority sizes="(max-width: 900px) 100vw, 52vw" className="auth-hero-image" /><div className="auth-hero-shade" /><div className="auth-hero-content"><Brand /><div className="auth-hero-copy"><span className="auth-eyebrow"><i />{content.eyebrow}</span><h1>{content.title}</h1><p>{content.body}</p><ul>{content.bullets.map((item) => <li key={item}><span><Check size={14} /></span>{item}</li>)}</ul></div><div className="auth-hero-foot"><span className="auth-hero-leaf"><Sprout size={17} /></span><span>Rooted in your land. Ready for what’s next.</span></div></div></aside>
}

function AuthShell({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  return <main className="auth-page"><AuthHero mode={mode} /><section className="auth-panel"><div className="auth-panel-mobile-brand"><Brand /></div><div className="auth-card-wrap">{children}<p className="auth-copyright">© 2026 Farmly.AI · A smarter season starts here.</p></div></section></main>
}

function SubmitButton({ children, busy = false, disabled = false }: { children: ReactNode; busy?: boolean; disabled?: boolean }) {
  return <button className="auth-submit" type="submit" disabled={busy || disabled}>{busy ? <><LoaderCircle className="auth-spinner" size={17} />Please wait…</> : children}</button>
}

function CountryMobileField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  return <AuthField label="Mobile number" htmlFor="mobile" error={error}><div className="mobile-field"><label className="country-code" htmlFor="country-code"><span className="india-flag" aria-hidden="true">IN</span><select id="country-code" aria-label="Country calling code" defaultValue="+91"><option value="+91">+91</option><option value="+1">+1</option><option value="+44">+44</option></select><ChevronDown size={13} /></label><input id="mobile" autoComplete="tel-national" type="tel" inputMode="numeric" maxLength={10} value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" aria-invalid={Boolean(error)} aria-describedby={error ? "mobile-error" : undefined} /></div></AuthField>
}

function PasswordField({ id, label, value, onChange, error, hint, autoComplete = "new-password" }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; hint?: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false)
  return <AuthField label={label} htmlFor={id} error={error} hint={hint}><div className="password-field"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} /><button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></AuthField>
}

function PasswordStrength({ value }: { value: string }) {
  const checks = [value.length >= 8, /[A-Z]/.test(value), /\d/.test(value)]
  const score = checks.filter(Boolean).length
  const label = score < 2 ? "Add at least 8 characters and a number" : score === 2 ? "Getting there" : "Strong password"
  return <div className="password-strength" aria-live="polite"><div className="strength-bars" aria-hidden="true">{checks.map((check, index) => <i key={index} className={check ? `strength-${score}` : ""} />)}</div><span>{value ? label : "Use 8+ characters and at least one number"}</span></div>
}

function LoginForm() {
  const router = useRouter()
  const [mobile, setMobile] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({})
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "demo") setNotice("Demo reset complete. No account password was changed.")
  }, [])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = {
      mobile: /^\d{10}$/.test(mobile) ? undefined : "Enter a valid 10-digit Indian mobile number.",
      password: password.length ? undefined : "Enter your password to continue.",
    }
    setErrors(nextErrors)
    if (nextErrors.mobile || nextErrors.password) return
    setNotice("")
    setBusy(true)
    window.setTimeout(() => {
      const profile = getDemoSession()
      const demo: DemoSession = { name: profile?.name || "Farmly farmer", mobile, email: profile?.email || "", language: profile?.language || "English", onboarding: profile?.onboarding }
      saveDemoSession(demo, remember)
      router.push("/dashboard")
    }, 360)
  }
  return <AuthShell mode="login"><div className="auth-card"><div className="auth-card-heading"><span className="auth-card-icon"><Leaf size={18} /></span><span className="auth-eyebrow">YOUR FARM, RIGHT WHERE YOU LEFT IT</span><h2>Welcome back</h2><p>Log in to continue your farming journey.</p></div><DemoNotice /><form onSubmit={submit} noValidate className="auth-form"><CountryMobileField value={mobile} onChange={setMobile} error={errors.mobile} /><PasswordField id="login-password" label="Password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" /><div className="form-options"><label className="check-line"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span className="custom-check"><Check size={12} /></span>Remember me</label><Link href="/forgot-password" className="auth-text-link">Forgot password?</Link></div>{notice && <p className="auth-form-success" role="status">{notice}</p>}<SubmitButton busy={busy}>Log in <ArrowRight size={17} /></SubmitButton></form><p className="auth-switch">New to Farmly.AI? <Link href="/signup">Create an account</Link></p></div></AuthShell>
}

function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [language, setLanguage] = useState("English")
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const saved = getPendingSignup()
    if (!saved) return
    setName(saved.name)
    setMobile(saved.mobile)
    setEmail(saved.email || "")
    setLanguage(saved.language || "English")
  }, [])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = "Enter your full name."
    if (!/^\d{10}$/.test(mobile)) next.mobile = "Enter a valid 10-digit Indian mobile number."
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address."
    if (password.length < 8 || !/\d/.test(password)) next.password = "Use at least 8 characters and include a number."
    if (confirm !== password) next.confirm = "Your passwords don’t match."
    if (!terms) next.terms = "Please accept the terms to create a demo account."
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    const registration: PendingSignup = { name: name.trim(), mobile, email: email.trim(), language }
    savePendingSignup(registration)
    window.setTimeout(() => router.push("/verify-otp"), 320)
  }
  return <AuthShell mode="signup"><div className="auth-card signup-card"><div className="auth-card-heading"><span className="auth-card-icon"><Sprout size={18} /></span><span className="auth-eyebrow">A BETTER SEASON STARTS HERE</span><h2>Create your account</h2><p>Personalized guidance, grounded in your farm.</p></div><DemoNotice /><form onSubmit={submit} noValidate className="auth-form signup-form"><AuthField label="Full name" htmlFor="signup-name" error={errors.name}><input id="signup-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ramesh Kumar" aria-invalid={Boolean(errors.name)} /></AuthField><CountryMobileField value={mobile} onChange={setMobile} error={errors.mobile} /><AuthField label="Email address" htmlFor="signup-email" error={errors.email} hint="Optional — no email will be sent in demo mode."><input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com (optional)" aria-invalid={Boolean(errors.email)} /></AuthField><PasswordField id="signup-password" label="Create password" value={password} onChange={setPassword} error={errors.password} hint="Minimum 8 characters, including one number." /><PasswordStrength value={password} /><PasswordField id="signup-confirm" label="Confirm password" value={confirm} onChange={setConfirm} error={errors.confirm} /><AuthField label="Preferred language" htmlFor="signup-language"><div className="select-field"><select id="signup-language" value={language} onChange={(event) => setLanguage(event.target.value)}>{languageOptions.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></div></AuthField><div className="terms-wrap"><label className="check-line"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span className="custom-check"><Check size={12} /></span><span>I agree to the <a href="#farmly-demo-terms">Terms</a> and <a href="#farmly-demo-privacy">Privacy Policy</a>.</span></label>{errors.terms && <span className="field-error" role="alert">{errors.terms}</span>}</div><div className="demo-legal" id="farmly-demo-terms"><strong>Demo account terms</strong><span>This local prototype does not create a real account or send messages. Passwords are used only for this form and are never saved.</span><span id="farmly-demo-privacy">Privacy: demo profile and onboarding details are kept in this browser only.</span></div><SubmitButton busy={busy}>Create account <ArrowRight size={17} /></SubmitButton></form><p className="auth-switch">Already have an account? <Link href="/login">Log in</Link></p></div></AuthShell>
}

function OtpForm() {
  const router = useRouter()
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const [digits, setDigits] = useState(["", "", "", "", "", ""])
  const [seconds, setSeconds] = useState(30)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [resetFlow, setResetFlow] = useState(false)
  const [contact, setContact] = useState("your registered mobile number")
  useEffect(() => {
    const isReset = new URLSearchParams(window.location.search).get("flow") === "reset"
    const signup = getPendingSignup()
    setResetFlow(isReset)
    setContact(isReset ? getResetContact() || "your registered mobile number" : signup?.mobile ? `+91 ${signup.mobile}` : "your registered mobile number")
  }, [])
  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((remaining) => Math.max(0, remaining - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [seconds])
  function changeDigit(index: number, raw: string) {
    const value = raw.replace(/\D/g, "")
    setError("")
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split("")
      setDigits(Array.from({ length: 6 }, (_, position) => pasted[position] || ""))
      inputs.current[Math.min(pasted.length, 5)]?.focus()
      return
    }
    const next = [...digits]
    next[index] = value
    setDigits(next)
    setError("")
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = digits.join("")
    if (code.length !== 6) { setError("Enter all six digits to continue."); return }
    if (code !== "123456") { setError("That code doesn’t match. Use the demo code shown above."); return }
    setBusy(true)
    if (resetFlow) {
      setResetVerified(true)
      window.setTimeout(() => router.push("/reset-password"), 300)
      return
    }
    const registration = getPendingSignup()
    if (!registration) { setError("Your signup details have expired. Please start again."); setBusy(false); return }
    saveDemoSession({ ...registration })
    clearPendingSignup()
    window.setTimeout(() => router.push("/onboarding"), 300)
  }
  return <AuthShell mode="verify-otp"><div className="auth-card otp-card"><Link href={resetFlow ? "/forgot-password" : "/signup"} className="auth-back-link"><ArrowLeft size={15} /> Back</Link><div className="auth-card-heading"><span className="auth-card-icon"><LockKeyhole size={18} /></span><span className="auth-eyebrow">A QUICK DEMO CHECK</span><h2>{resetFlow ? "Verify your recovery request" : "Verify your mobile number"}</h2><p>{resetFlow ? "No verification message was sent. Enter the demo code to continue from " : "We haven’t sent an SMS. Enter the demo code to continue from "}<strong>{contact}</strong>.</p></div><div className="demo-code-banner"><span>DEMO VERIFICATION CODE</span><strong>123456</strong></div><form className="auth-form" onSubmit={submit} noValidate><fieldset className="otp-fieldset"><legend className="sr-only">Six-digit verification code</legend><div className="otp-inputs">{digits.map((digit, index) => <input key={index} ref={(element) => { inputs.current[index] = element }} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1} value={digit} onChange={(event) => changeDigit(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus() }} onPaste={(event) => { event.preventDefault(); changeDigit(index, event.clipboardData.getData("text")) }} aria-label={`Digit ${index + 1} of 6`} aria-invalid={Boolean(error)} autoComplete={index === 0 ? "one-time-code" : "off"} />)}</div></fieldset>{error && <p className="auth-form-error" role="alert">{error}</p>}<SubmitButton busy={busy}>Verify code <ArrowRight size={17} /></SubmitButton></form><div className="otp-resend"><span>{seconds > 0 ? `Resend available in 0:${String(seconds).padStart(2, "0")}` : "Didn’t get a code?"}</span><button type="button" disabled={seconds > 0} onClick={() => { setSeconds(30); setDigits(["", "", "", "", "", ""]); setNotice("Demo code is still 123456; no SMS was sent."); inputs.current[0]?.focus() }}>Resend code</button></div>{notice && <p className="otp-notice" role="status">{notice}</p>}<Link href={resetFlow ? "/forgot-password" : "/signup"} className="auth-change-link">Change mobile number</Link></div></AuthShell>
}

function ForgotPasswordForm() {
  const router = useRouter()
  const [contact, setContact] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = contact.trim()
    const valid = /^\d{10}$/.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    if (!valid) { setError("Enter a valid 10-digit mobile number or email address."); return }
    setError("")
    setBusy(true)
    saveResetContact(value)
    window.setTimeout(() => router.push("/verify-otp?flow=reset"), 320)
  }
  return <AuthShell mode="forgot-password"><div className="auth-card"><Link href="/login" className="auth-back-link"><ArrowLeft size={15} /> Back to login</Link><div className="auth-card-heading"><span className="auth-card-icon"><LockKeyhole size={18} /></span><span className="auth-eyebrow">IT HAPPENS TO EVERYONE</span><h2>Forgot your password?</h2><p>Don’t worry. We’ll help you get back to your farm dashboard.</p></div><DemoNotice>Demo mode · a verification code is shown on the next screen. No message will be sent.</DemoNotice><form className="auth-form" onSubmit={submit} noValidate><AuthField label="Mobile number or email" htmlFor="reset-contact" error={error}><input id="reset-contact" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="10-digit mobile or email address" autoComplete="username" aria-invalid={Boolean(error)} /></AuthField><SubmitButton busy={busy}>Continue to verification <ArrowRight size={17} /></SubmitButton></form><p className="auth-switch auth-help">Need a hand? <Link href="/login">Back to login</Link></p></div></AuthShell>
}

function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = { password: password.length >= 8 && /\d/.test(password) ? undefined : "Use at least 8 characters and include a number.", confirm: confirm === password ? undefined : "Your passwords don’t match." }
    setErrors(next)
    if (next.password || next.confirm) return
    setBusy(true)
    setResetVerified(false)
    window.setTimeout(() => router.push("/login?reset=demo"), 350)
  }
  return <AuthShell mode="reset-password"><div className="auth-card"><Link href="/login" className="auth-back-link"><ArrowLeft size={15} /> Back to login</Link><div className="auth-card-heading"><span className="auth-card-icon"><LockKeyhole size={18} /></span><span className="auth-eyebrow">MAKE IT A GOOD ONE</span><h2>Set a new password</h2><p>Choose a password that’s easy for you to remember and hard to guess.</p></div><DemoNotice>A simulated reset only · no password is saved and no account is changed.</DemoNotice><form className="auth-form" onSubmit={submit} noValidate><PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} error={errors.password} /><PasswordStrength value={password} /><PasswordField id="reset-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} error={errors.confirm} /><SubmitButton busy={busy}>Reset password <ArrowRight size={17} /></SubmitButton></form></div></AuthShell>
}

type OnboardingForm = FarmerPreferences
const emptyOnboarding: OnboardingForm = { name: "", mobile: "", email: "", language: "English", state: "Jharkhand", district: "", village: "", acres: "", landStatus: "Owner", soil: "Not sure", irrigation: "Rain-fed", crops: [], interaction: "voice", weatherAlerts: true, schemeUpdates: true, cropAlerts: true }

function OnboardingFlow({ session }: { session: DemoSession }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<OnboardingForm>({ ...emptyOnboarding, name: session.name, mobile: session.mobile, email: session.email || "", language: session.language || "English" })
  const [error, setError] = useState("")
  const [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const draft = getOnboardingDraft<OnboardingForm>()
    const saved = session.onboarding
    if (draft) setForm({ ...emptyOnboarding, ...draft })
    else if (saved) setForm({ ...emptyOnboarding, ...saved })
  }, [session])
  useEffect(() => { saveOnboardingDraft(form) }, [form])
  function update<K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }
  function advance() {
    if (step === 0 && (!form.name.trim() || !form.state || !form.district.trim() || !form.village.trim())) { setError("Please add your name, state, district, and village."); return }
    if (step === 1 && (!Number.isFinite(Number(form.acres)) || Number(form.acres) <= 0)) { setError("Enter a farm area greater than zero acres."); return }
    setError("")
    setStep((current) => Math.min(3, current + 1))
  }
  function finish() {
    setBusy(true)
    const updated = { ...session, name: form.name.trim(), mobile: form.mobile, email: form.email, language: form.language, onboarding: form }
    saveDemoSession(updated, Boolean(session.remember))
    try {
      window.localStorage.setItem("farmly-profile", JSON.stringify({ name: form.name.trim(), village: form.village, district: form.district, state: form.state, language: form.language, acres: form.acres, crop: form.crops[0] || "Paddy", soil: form.soil, irrigation: form.irrigation, experience: "New to farming" }))
      window.localStorage.setItem("farmly-selected-location", JSON.stringify({ district: form.district, state: form.state, label: `${form.district}, ${form.state}` }))
    } catch {
      // The onboarding still completes for this browser session.
    }
    clearOnboardingDraft()
    setComplete(true)
    setBusy(false)
  }
  const stepTitles = ["Basic information", "Farm details", "Your crops", "Make it yours"]
  return <main className="onboarding-page"><header className="onboarding-topbar"><Brand /><span className="onboarding-save"><ShieldCheck size={15} /> Saved in this browser</span></header><section className="onboarding-shell"><div className="onboarding-welcome"><span className="auth-eyebrow">YOUR FARM, YOUR WAY</span><h1>{complete ? "Your farm journey starts here!" : "Let’s get to know your farm."}</h1><p>{complete ? "Farmly.AI is ready to help you make smarter farming decisions." : "A few little details help us make every recommendation feel closer to home."}</p></div>{!complete && <div className="onboarding-progress" aria-label={`Step ${step + 1} of 4`}><div className="progress-track"><span style={{ width: `${((step + 1) / 4) * 100}%` }} /></div><div className="progress-labels">{stepTitles.map((title, index) => <span key={title} className={index <= step ? "active" : ""}><i>{index < step ? <Check size={12} /> : index + 1}</i>{title}</span>)}</div></div>}<section className="onboarding-card" aria-live="polite">{complete ? <div className="onboarding-success"><div className="success-orbit"><span><Check size={37} /></span></div><span className="auth-eyebrow">READY TO GROW</span><h2>Your farm journey starts here!</h2><p>Farmly.AI is ready to help you make smarter farming decisions, in {form.language}.</p><div className="welcome-summary"><span><MapPin size={16} />{form.village}, {form.district}</span><span><Sprout size={16} />{form.crops.length ? form.crops.slice(0, 3).join(", ") : "Your crops, your pace"}</span></div><button className="auth-submit" type="button" onClick={() => router.push("/dashboard")}>Go to My Dashboard <ArrowRight size={17} /></button></div> : <><div className="onboarding-step-heading"><span className="step-count">STEP 0{step + 1} <i>/ 04</i></span><h2>{["Let’s get to know you.", "Tell us about your farm.", "What do you grow?", "Customize your Farmly experience."][step]}</h2><p>{["We’ll use these details to keep your guidance local and relevant.", "Every field is different. Help us understand yours.", "Choose as many as you like. You can always update this later.", "Choose how and when you’d like Farmly.AI to reach out."][step]}</p></div>{step === 0 && <div className="onboarding-fields"><AuthField label="Farmer name" htmlFor="onboard-name"><input id="onboard-name" autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your full name" /></AuthField><LocationSelect variant="onboarding" state={form.state} district={form.district} onStateChange={(state) => update("state", state)} onDistrictChange={(district) => update("district", district)} stateId="onboard-state" districtId="onboard-district" /><AuthField label="Village" htmlFor="onboard-village"><input id="onboard-village" value={form.village} onChange={(event) => update("village", event.target.value)} placeholder="Your village" /></AuthField><AuthField label="Preferred language" htmlFor="onboard-language"><div className="select-field"><select id="onboard-language" value={form.language} onChange={(event) => update("language", event.target.value)}>{languageOptions.map((language) => <option key={language}>{language}</option>)}</select><ChevronDown size={15} /></div></AuthField></div>}{step === 1 && <div className="onboarding-fields"><AuthField label="Total farm area (acres)" htmlFor="onboard-acres" hint="You can use decimals, for example 2.5 acres."><input id="onboard-acres" type="number" min="0.1" step="0.1" inputMode="decimal" value={form.acres} onChange={(event) => update("acres", event.target.value)} placeholder="e.g. 2.5" /></AuthField><AuthField label="Land status" htmlFor="onboard-land"><div className="select-field"><select id="onboard-land" value={form.landStatus} onChange={(event) => update("landStatus", event.target.value)}><option>Owner</option><option>Tenant</option><option>Shared / leased</option><option>Other</option></select><ChevronDown size={15} /></div></AuthField><AuthField label="Soil type" htmlFor="onboard-soil"><div className="select-field"><select id="onboard-soil" value={form.soil} onChange={(event) => update("soil", event.target.value)}>{["Not sure", "Clay loam", "Sandy loam", "Black soil", "Red soil", "Alluvial", "Other"].map((soil) => <option key={soil}>{soil}</option>)}</select><ChevronDown size={15} /></div></AuthField><AuthField label="Irrigation availability" htmlFor="onboard-water"><div className="select-field"><select id="onboard-water" value={form.irrigation} onChange={(event) => update("irrigation", event.target.value)}>{["Rain-fed", "Canal", "Well / borewell", "Drip", "Multiple sources", "Not available"].map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></div></AuthField></div>}{step === 2 && <><div className="crop-card-grid">{cropOptions.map((crop, index) => { const selected = form.crops.includes(crop); return <button key={crop} type="button" className={`onboard-crop-card ${selected ? "selected" : ""}`} onClick={() => update("crops", selected ? form.crops.filter((item) => item !== crop) : [...form.crops, crop])} aria-pressed={selected}><span className="crop-photo" style={{ backgroundPosition: `${(index % 5) * 25}% ${Math.floor(index / 5) * 100}%` }} /><span className="crop-card-name">{crop}</span><i className="crop-selected"><Check size={12} /></i></button> })}</div><p className="crop-selection-count">{form.crops.length ? `${form.crops.length} selected` : "No crops selected yet — that’s okay."}</p></>}{step === 3 && <div className="onboarding-preferences"><AuthField label="Preferred language" htmlFor="onboard-language-final"><div className="select-field"><select id="onboard-language-final" value={form.language} onChange={(event) => update("language", event.target.value)}>{languageOptions.map((language) => <option key={language}>{language}</option>)}</select><ChevronDown size={15} /></div></AuthField><fieldset className="preference-group"><legend>How do you like to interact?</legend><div className="preference-choices"><button type="button" className={form.interaction === "voice" ? "selected" : ""} onClick={() => update("interaction", "voice")} aria-pressed={form.interaction === "voice"}><Volume2 size={17} /><span>Voice</span></button><button type="button" className={form.interaction === "text" ? "selected" : ""} onClick={() => update("interaction", "text")} aria-pressed={form.interaction === "text"}><span className="text-choice-icon">Aa</span><span>Text</span></button></div></fieldset><div className="preference-toggles"><label><span className="toggle-copy"><Sun size={17} /><span><strong>Weather alerts</strong><small>Know when conditions may change.</small></span></span><input type="checkbox" checked={form.weatherAlerts} onChange={(event) => update("weatherAlerts", event.target.checked)} /></label><label><span className="toggle-copy"><ShieldCheck size={17} /><span><strong>Government scheme updates</strong><small>Hear about relevant support programmes.</small></span></span><input type="checkbox" checked={form.schemeUpdates} onChange={(event) => update("schemeUpdates", event.target.checked)} /></label><label><span className="toggle-copy"><Sprout size={17} /><span><strong>Crop advisory notifications</strong><small>Seasonal tips for the crops you grow.</small></span></span><input type="checkbox" checked={form.cropAlerts} onChange={(event) => update("cropAlerts", event.target.checked)} /></label></div></div>}{error && <p className="auth-form-error onboarding-error" role="alert">{error}</p>}<div className="onboarding-actions">{step > 0 ? <button type="button" className="auth-secondary" onClick={() => { setError(""); setStep((current) => current - 1) }}><ArrowLeft size={15} /> Back</button> : <span className="onboarding-step-note">Your details stay in this browser demo.</span>}{step === 2 && <button type="button" className="auth-skip" onClick={() => { setError(""); setStep(3) }}>Skip for now</button>}<button type="button" className="auth-submit" onClick={step === 3 ? finish : advance} disabled={busy}>{busy ? <><LoaderCircle className="auth-spinner" size={16} />Saving…</> : <>{step === 3 ? "Finish setup" : "Continue"}<ArrowRight size={16} /></>}</button></div></>}</section><p className="onboarding-footnote"><LockKeyhole size={13} /> Your onboarding details are saved locally in this demo. No account data leaves this browser.</p></section></main>
}

export function FarmlyAuthExperience({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [session, setSession] = useState<DemoSession | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { setSession(getDemoSession()); setReady(true) }, [])
  useEffect(() => {
    if (!ready) return
    if ((mode === "login" || mode === "signup") && session) router.replace("/dashboard")
    if ((mode === "onboarding" || mode === "dashboard") && !session) router.replace("/login")
    if (mode === "reset-password" && !isResetVerified()) router.replace("/forgot-password")
  }, [mode, ready, router, session])
  if (!ready || ((mode === "login" || mode === "signup") && session) || ((mode === "onboarding" || mode === "dashboard") && !session) || (mode === "reset-password" && !isResetVerified())) return <main className="auth-loading" aria-label="Loading Farmly.AI"><span className="auth-brand-mark"><Leaf size={20} /></span><LoaderCircle className="auth-spinner" size={20} /></main>
  if (mode === "dashboard") return <FarmlyApp />
  if (mode === "login") return <LoginForm />
  if (mode === "signup") return <SignupForm />
  if (mode === "verify-otp") return <OtpForm />
  if (mode === "forgot-password") return <ForgotPasswordForm />
  if (mode === "reset-password") return <ResetPasswordForm />
  return <OnboardingFlow session={session!} />
}
