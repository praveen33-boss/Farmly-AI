"use client"

import { useEffect, useState } from "react"
import {
  Activity, ArrowDownRight, ArrowRight, Bell, BookOpen, ChevronDown, CloudRain, Compass, FlaskConical,
  House, Leaf, LogOut, MapPin, Menu, Mic2, Search, Settings2, Sprout, Store, Sun, UserRound, WalletCards, X,
} from "lucide-react"
import { clearDemoSession } from "@/lib/demo-auth"
import { LocationProvider, useLocation } from "@/lib/location-context"
import { DashboardScreen } from "./overview"
import { CropPlannerScreen, MandiScreen, ProfileScreen, SchemesScreen, SoilScreen, VoiceScreen, WeatherScreen } from "./screens"

export type Module = "overview" | "voice" | "weather" | "mandi" | "soil" | "planner" | "schemes" | "profile"
export type FarmerProfile = {
  name: string
  village: string
  district: string
  state: string
  language: string
  acres: string
  crop: string
  soil: string
  irrigation: string
  experience: string
}

const initialProfile: FarmerProfile = {
  name: "Ramesh Kumar", village: "Jilingsereng", district: "Khunti", state: "Jharkhand",
  language: "English", acres: "2.5", crop: "Paddy", soil: "Clay loam", irrigation: "Rain-fed", experience: "12 years",
}

const primaryNav: { id: Module; label: string; icon: typeof House }[] = [
  { id: "overview", label: "Overview", icon: House },
  { id: "voice", label: "Voice assistant", icon: Mic2 },
  { id: "weather", label: "Weather intelligence", icon: CloudRain },
  { id: "mandi", label: "Mandi prices", icon: Store },
]
const farmNav: { id: Module; label: string; icon: typeof House }[] = [
  { id: "soil", label: "Soil health", icon: FlaskConical },
  { id: "planner", label: "Crop planner", icon: Sprout },
  { id: "schemes", label: "Schemes & support", icon: WalletCards },
]
const titles: Record<Module, { title: string; eyebrow: string; description: string }> = {
  overview: { title: "Your farm, at a glance", eyebrow: "FARM OVERVIEW", description: "A clearer view of what matters today." },
  voice: { title: "Ask in your language", eyebrow: "FARMLY VOICE", description: "A friendly, voice-first demo for everyday farm questions." },
  weather: { title: "Weather that works for your crop", eyebrow: "WEATHER INTELLIGENCE", description: "Plan around the forecast, not just the clouds." },
  mandi: { title: "Sell with a little more certainty", eyebrow: "MANDI INTELLIGENCE", description: "Compare nearby markets and estimated returns." },
  soil: { title: "Get to know your soil", eyebrow: "SOIL HEALTH", description: "Understand your soil profile before making input decisions." },
  planner: { title: "Plan before you plant", eyebrow: "CROP PLANNER", description: "Build a practical season plan around your land." },
  schemes: { title: "Support for your farm journey", eyebrow: "SCHEMES & SUPPORT", description: "Explore government programmes and check what may fit." },
  profile: { title: "Your farm profile", eyebrow: "MY FARM", description: "Keep your farm details in one place." },
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="brand-mark"><span className="brand-icon"><Leaf size={20} strokeWidth={2.2} /></span><span className="brand-name">Farmly<span>.AI</span>{!compact && <small>GROW WITH CONFIDENCE</small>}</span></div>
}

function Sidebar({ active, onChange, profile, open, onClose }: { active: Module; onChange: (value: Module) => void; profile: FarmerProfile; open: boolean; onClose: () => void }) {
  const navGroup = (items: typeof primaryNav) => items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { onChange(id); onClose() }} className={`nav-item ${active === id ? "is-active" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === "weather" && <i className="nav-dot" />}</button>)
  return <>
    {open && <button className="mobile-scrim" onClick={onClose} aria-label="Close menu" />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><BrandMark /><button className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="farm-switcher"><div className="farm-switch-icon"><Sprout size={17} /></div><div><span>YOUR FARM</span><strong>{profile.village} farm</strong></div><ChevronDown size={15} /></div>
      <nav className="side-navigation" aria-label="Main navigation">
        <span className="nav-section-label">YOUR DAY</span>{navGroup(primaryNav)}
        <span className="nav-section-label nav-section-spaced">FARM TOOLS</span>{navGroup(farmNav)}
      </nav>
      <div className="sidebar-bottom">
        <div className="season-card"><div className="season-icon"><Sun size={16} /></div><div><span>KHARIF SEASON</span><strong>Monsoon is here</strong><small>Make every rain count.</small></div></div>
        <button className={`nav-item ${active === "profile" ? "is-active" : ""}`} onClick={() => { onChange("profile"); onClose() }}><Settings2 size={17} /><span>My profile & settings</span></button>
        <div className="profile-mini"><div className="avatar">{profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="profile-mini-text"><strong>{profile.name}</strong><span>{profile.district}, {profile.state}</span></div><ChevronDown size={15} /></div>
      </div>
    </aside>
  </>
}

function Header({ active, profile, onLanguage, onMenu, onNavigate, onLogout }: { active: Module; profile: FarmerProfile; onLanguage: (value: string) => void; onMenu: () => void; onNavigate: (module: Module) => void; onLogout: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const current = titles[active]
  return <header className="topbar">
    <button className="icon-button menu-toggle" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
    <div className="breadcrumb"><span>My farm</span><ArrowRight size={13} /><strong>{current.title}</strong></div>
    <div className="topbar-actions">
      <label className="language-select"><span className="language-globe">अ</span><select aria-label="Preferred language" value={profile.language} onChange={(event) => onLanguage(event.target.value)}><option>English</option><option>हिंदी</option><option>తెలుగు</option><option>मराठी</option><option>தமிழ்</option><option>ਪੰਜਾਬੀ</option></select><ChevronDown size={13} /></label>
      <span className="topbar-divider" />
      <button className="icon-button logout-button" onClick={onLogout} aria-label="Log out"><LogOut size={17} /></button>
      <div className="notification-wrap"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /><i /></button>{notificationsOpen && <div className="notification-popover"><span>1 FARM ADVISORY</span><strong>Rainfall expected soon</strong><p>Check field drainage before the next rain window. Demo forecast for Khunti.</p><button onClick={() => { setNotificationsOpen(false); onNavigate("weather") }}>Open weather intelligence <ArrowRight size={13} /></button></div>}</div>
      <div className="topbar-avatar">RK</div>
    </div>
  </header>
}

function Screen({ active, profile, onNavigate, onSaveProfile }: { active: Module; profile: FarmerProfile; onNavigate: (module: Module) => void; onSaveProfile: (profile: FarmerProfile) => void }) {
  const current = titles[active]
  const { location } = useLocation()
  return <>
    <div className="page-heading"><div><span className="eyebrow">{current.eyebrow}</span><h1>{active === "overview" ? `Namaste, ${profile.name.split(" ")[0]}` : current.title}</h1><p>{active === "overview" ? "Here’s what’s happening on your farm today." : current.description}</p></div><div className="heading-location"><MapPin size={15} /><span suppressHydrationWarning>{location.label}</span></div></div>
    {active === "overview" && <DashboardScreen profile={profile} onNavigate={onNavigate} />}
    {active === "voice" && <VoiceScreen language={profile.language} />}
    {active === "weather" && <WeatherScreen />}
    {active === "mandi" && <MandiScreen />}
    {active === "soil" && <SoilScreen />}
    {active === "planner" && <CropPlannerScreen profile={profile} />}
    {active === "schemes" && <SchemesScreen profile={profile} />}
    {active === "profile" && <ProfileScreen profile={profile} onSave={onSaveProfile} />}
  </>
}

export function FarmlyApp() {
  const [active, setActive] = useState<Module>("overview")
  const [profile, setProfile] = useState<FarmerProfile>(initialProfile)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState("")
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("farmly-profile")
      if (saved) setProfile({ ...initialProfile, ...JSON.parse(saved) as Partial<FarmerProfile> })
    } catch { /* Keep the sample profile when browser storage is unavailable. */ }
  }, [])
  const saveProfile = (next: FarmerProfile) => {
    setProfile(next)
    try {
      window.localStorage.setItem("farmly-profile", JSON.stringify(next))
      window.localStorage.setItem("farmly-selected-location", JSON.stringify({
        district: next.district,
        state: next.state,
        label: `${next.district}, ${next.state}`,
      }))
    } catch { /* Profile remains available for this session. */ }
    setToast("Your farm profile has been saved")
    window.setTimeout(() => setToast(""), 2800)
  }
  const updateLanguage = (language: string) => saveProfile({ ...profile, language })
  const logout = () => { clearDemoSession(); window.location.assign("/login") }
  const mobileItems: { id: Module; label: string; icon: typeof House }[] = [
    { id: "overview", label: "Home", icon: House }, { id: "weather", label: "Weather", icon: CloudRain }, { id: "voice", label: "Ask AI", icon: Mic2 }, { id: "planner", label: "Plan", icon: Sprout }, { id: "mandi", label: "Markets", icon: Store },
  ]
  return (
    <LocationProvider profileDistrict={profile.district} profileState={profile.state}>
      <div className="farmly-app">
        <Sidebar active={active} onChange={setActive} profile={profile} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="app-main"><Header active={active} profile={profile} onLanguage={updateLanguage} onMenu={() => setMenuOpen(true)} onNavigate={setActive} onLogout={logout} /><main className="content-area"><Screen active={active} profile={profile} onNavigate={setActive} onSaveProfile={saveProfile} /><footer className="app-footer"><span>Farmly.AI · Your farm. Your language. Smarter decisions.</span><span>Live agricultural intelligence for Indian farmers</span></footer></main></div>
        <nav className="mobile-nav" aria-label="Mobile navigation">{mobileItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "mobile-active" : ""} onClick={() => setActive(id)}><Icon size={19} strokeWidth={active === id ? 2.2 : 1.8} /><span>{label}</span>{id === "voice" && <i className="mobile-ai-dot" />}</button>)}</nav>
        {toast && <div className="toast-message" role="status"><Activity size={16} />{toast}</div>}
      </div>
    </LocationProvider>
  )
}
