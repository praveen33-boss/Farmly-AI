"use client"
import { useLocation } from "@/lib/location-context";
import { useWeather } from "@/lib/use-weather";
import { usePrices, usePriceTrend, type MandiRecord } from "@/lib/use-prices";
import { LocationSelect } from "./location-select";
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownWideNarrow, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown, CircleHelp, CloudDrizzle, CloudRain, CloudSun, Download, ExternalLink, FileText, Filter, Info, Leaf, LoaderCircle, MapPin, Mic, MicOff, Play, Plus, RefreshCw, Search, Send, ShieldCheck, Sprout, Store, Sun, Volume2, VolumeX, Wind, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { FarmerProfile } from "./farmly-app"

const schemeData = [
  { id: "pm-kisan", name: "PM-KISAN", full: "Pradhan Mantri Kisan Samman Nidhi", category: "Income support", type: "Central government", about: "Income support programme for eligible landholding farmer families, subject to scheme guidelines and exclusions.", benefit: "₹6,000 per year", fit: "More information needed", fitReason: "Land records and scheme exclusions need to be checked with the official portal.", url: "https://pmkisan.gov.in/", color: "scheme-green", mark: "₹" },
  { id: "pmfby", name: "PMFBY", full: "Pradhan Mantri Fasal Bima Yojana", category: "Crop insurance", type: "Central government", about: "Crop insurance support against specified non-preventable natural risks, under notified crops and areas.", benefit: "Premium subsidy varies", fit: "Potentially relevant", fitReason: "You grow a notified crop; check current district enrollment dates and crop notification.", url: "https://pmfby.gov.in/", color: "scheme-blue", mark: "✳" },
  { id: "kcc", name: "Kisan Credit Card", full: "Kisan Credit Card (KCC)", category: "Agricultural credit", type: "Central government", about: "Enables eligible farmers to access institutional credit for crop cultivation and allied activities.", benefit: "Credit limit set by bank", fit: "Potentially relevant", fitReason: "Smallholder farmers may apply through participating banks, subject to lender assessment.", url: "https://www.myscheme.gov.in/", color: "scheme-gold", mark: "⌁" },
  { id: "pmksy", name: "PMKSY", full: "Pradhan Mantri Krishi Sinchayee Yojana", category: "Irrigation subsidy", type: "Central government", about: "Supports improved irrigation access and water-use efficiency through applicable programme components.", benefit: "Component & state dependent", fit: "More information needed", fitReason: "Support depends on local implementation, land details, and the active component in your district.", url: "https://pmksy.gov.in/", color: "scheme-teal", mark: "≈" },
  { id: "soil-card", name: "Soil Health Card", full: "Soil Health Card programme", category: "Soil & inputs", type: "Central government", about: "Helps farmers access soil testing and nutrient recommendations through the relevant state process.", benefit: "Soil test & nutrient guidance", fit: "Potentially relevant", fitReason: "A recent soil test can help guide crop nutrient decisions; contact your local agriculture office.", url: "https://soilhealth.dac.gov.in/", color: "scheme-green", mark: "⌖" },
  { id: "jharkhand", name: "Jharkhand agriculture support", full: "State agriculture programmes", category: "State support", type: "State government", about: "State and district programmes may offer seasonal support; confirm current notifications and eligibility locally.", benefit: "Varies by active programme", fit: "More information needed", fitReason: "State programme windows and farmer registration requirements change. Verify with the district office.", url: "https://www.jharkhand.gov.in/", color: "scheme-orange", mark: "J" },
]
const crops = ["Paddy", "Wheat", "Maize", "Tomato", "Potato", "Mustard", "Soybean", "Groundnut", "Cotton", "Pulses"]
const timeline = ["Prepare land", "Choose seed", "Sow", "Establishment", "Vegetative growth", "Nutrient check", "Flowering", "Monitor crop", "Harvest"]

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`surface-card ${className}`}>{children}</section> }
function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) { return <div className="module-section-heading"><span className="card-kicker">{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div> }
function SampleNotice({ children = "Illustrative demo information · verify with official or local sources before acting." }: { children?: React.ReactNode }) { return <div className="sample-notice"><Info size={15} /><span>{children}</span></div> }
function MetricBar({ label, value, percent, tone }: { label: string; value: string; percent: number; tone: string }) { return <div className="soil-bar-row"><div><span>{label}</span><strong>{value}</strong></div><div className="soil-bar-track"><i className={tone} style={{ width: `${percent}%` }} /></div></div> }

const voiceResponses = {
  English: {
    crop: { original: "Your paddy is in the flowering stage. Check your soil test results and consult your local agriculture officer before deciding on fertilizer.", translation: "Illustrative response · follow locally verified agricultural guidance." },
    rain: { original: "The demo forecast shows a 75% chance of rain in the next 36 hours. Clear field drains and postpone fertilizer until conditions improve.", translation: "Sample weather guidance only. Check IMD or your local forecast before making decisions." },
    market: { original: "In this demo, Ramgarh shows ₹2,420 per quintal and Ranchi ₹2,350. Include travel and handling costs before choosing where to sell.", translation: "Prices are illustrative and are not current mandi quotes." },
    schemes: { original: "PM-KISAN, PMFBY, and Kisan Credit Card may be worth exploring. Final eligibility depends on official rules, current notifications, and your records.", translation: "Check each official portal or contact your district agriculture office." },
  },
  Hindi: {
    crop: { original: "आपकी धान की फसल में फूल आ रहे हैं। खाद का निर्णय लेने से पहले मिट्टी की जांच देखें और स्थानीय कृषि अधिकारी से सलाह लें।", translation: "उदाहरण के लिए उत्तर। स्थानीय कृषि सलाह का पालन करें।" },
    rain: { original: "डेमो पूर्वानुमान में अगले 36 घंटों में बारिश की 75% संभावना है। खेत की नालियां साफ रखें और मौसम सुधरने तक खाद न डालें।", translation: "यह केवल नमूना जानकारी है। निर्णय से पहले IMD या स्थानीय पूर्वानुमान देखें।" },
    market: { original: "इस डेमो में रामगढ़ का भाव ₹2,420 और रांची का ₹2,350 प्रति क्विंटल है। बिक्री से पहले यात्रा और अन्य खर्च जोड़ें।", translation: "ये कीमतें केवल उदाहरण हैं, आज के मंडी भाव नहीं।" },
    schemes: { original: "PM-KISAN, PMFBY और किसान क्रेडिट कार्ड के बारे में जानकारी लें। अंतिम पात्रता सरकारी नियमों और आपके दस्तावेज़ों पर निर्भर है।", translation: "आधिकारिक पोर्टल या जिला कृषि कार्यालय से पुष्टि करें।" },
  },
  Telugu: {
    crop: { original: "మీ వరి పంట పుష్పించే దశలో ఉంది. నేల పరీక్ష ఫలితాలను చూసి, స్థానిక వ్యవసాయ అధికారిని సంప్రదించి ఎరువుల నిర్ణయం తీసుకోండి.", translation: "Your paddy is flowering. Check your soil test and consult your local agriculture officer before deciding on fertilizer." },
    rain: { original: "డెమో వాతావరణ సూచన ప్రకారం వచ్చే 36 గంటల్లో వర్షానికి 75% అవకాశం ఉంది. పొలంలోని నీటి కాలువలను శుభ్రం చేసి, వర్షం తర్వాత ఎరువుల గురించి నిర్ణయించండి.", translation: "Demo forecast only. Check IMD or your local weather service before making a decision." },
    market: { original: "ఈ డెమోలో రామ్‌గఢ్ ధర క్వింటాల్‌కు ₹2,420, రాంచీ ధర ₹2,350. అమ్మే ముందు ప్రయాణ ఖర్చులను కూడా లెక్కించండి.", translation: "These are illustrative values, not current mandi prices." },
    schemes: { original: "PM-KISAN, PMFBY, కిసాన్ క్రెడిట్ కార్డ్ పథకాల గురించి తెలుసుకోండి. తుది అర్హత ప్రభుత్వ నిబంధనలు, తాజా ప్రకటనలు, మీ పత్రాలపై ఆధారపడి ఉంటుంది.", translation: "Check the official portal or ask your district agriculture office." },
  },
} as const

type VoiceLanguage = keyof typeof voiceResponses

export function VoiceScreen({ language }: { language: string }) {
  const [listening, setListening] = useState(false)
  const [query, setQuery] = useState("")
  const [answer, setAnswer] = useState("")
  const [answerTranslation, setAnswerTranslation] = useState("")
  const [recognized, setRecognized] = useState("")
  const [speaking, setSpeaking] = useState(false)
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null)
  const languageKey: VoiceLanguage = language === "తెలుగు" ? "Telugu" : language === "हिंदी" ? "Hindi" : "English"
  const handleAsk = (text = query) => {
    if (!text.trim()) return
    setRecognized(text)
    const normalized = text.toLowerCase()
    const category = /rain|weather|వర్ష|बारिश/.test(normalized) ? "rain" : /mandi|market|price|sell|ధర|మండి|बाज़ार|मंडी|भाव/.test(normalized) ? "market" : /scheme|subsid|support|కిసాన్|పథక|योजना|सब्सिडी/.test(normalized) ? "schemes" : "crop"
    const response = voiceResponses[languageKey][category]
    setAnswer(response.original)
    setAnswerTranslation(response.translation)
    setQuery("")
  }
  const toggleListening = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const SpeechRecognitionConstructor = (window as Window & { SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }; webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void } }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void } }).webkitSpeechRecognition
    if (!SpeechRecognitionConstructor) { setAnswer("Voice recognition is not supported in this browser. You can type your question below."); return }
    const recognition = new SpeechRecognitionConstructor()
    recognition.lang = languageKey === "Telugu" ? "te-IN" : languageKey === "Hindi" ? "hi-IN" : "en-IN"
    recognition.interimResults = false
    recognition.onresult = (event) => handleAsk(event.results[0][0].transcript)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }
  const speak = () => {
    if (!answer || !("speechSynthesis" in window)) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const utterance = new SpeechSynthesisUtterance(answer)
    utterance.lang = languageKey === "Telugu" ? "te-IN" : languageKey === "Hindi" ? "hi-IN" : "en-IN"
    utterance.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }
  return <div className="module-layout voice-layout">
    <div className="voice-primary"><Card className="voice-stage-card"><div className="voice-stage-top"><span className="status-pill"><span className="status-dot" /> DEMO ASSISTANT</span><span className="voice-language-pill">Speaking in <strong>{language}</strong></span></div><div className={`voice-orbit ${listening ? "is-listening" : ""}`}><div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><div className="orbit-ring orbit-three" /><button className={`big-mic ${listening ? "mic-listening" : ""}`} onClick={toggleListening} aria-label={listening ? "Stop listening" : "Start voice input"}>{listening ? <MicOff size={29} /> : <Mic size={29} />}</button><div className="voice-wave"><i /><i /><i /><i /><i /><i /><i /></div></div><p className="voice-state">{listening ? "I’m listening… go ahead" : "Tap the mic and tell me what’s on your mind"}</p><p className="voice-subtext">Try asking in English, हिंदी, or తెలుగు</p><div className="voice-compose"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) handleAsk() }} placeholder="Or type your question here…" aria-label="Type your farming question" /><button onClick={() => handleAsk()} aria-label="Send question"><Send size={17} /></button></div></Card>
      {answer && <Card className="voice-answer"><div className="answer-heading"><div className="ai-avatar"><Leaf size={17} /></div><div><strong>Farmly AI <span>DEMO RESPONSE</span></strong><small>Based on your paddy crop profile</small></div><button className="icon-button" onClick={speak} aria-label={speaking ? "Stop audio" : "Play response aloud"}>{speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div><div className="question-echo"><span>YOU ASKED</span><p>{recognized}</p></div><p className="answer-original">{answer}</p><div className="answer-translation"><span>ENGLISH TRANSLATION</span><p>{answerTranslation}</p></div><div className="answer-caution"><Info size={14} /> Illustrative response only. Confirm crop decisions with a local agriculture expert.</div></Card>}
    </div>
    <aside className="voice-sidebar"><Card className="conversation-card"><div className="side-card-title"><div><span className="card-kicker">QUICK QUESTIONS</span><h3>Where shall we start?</h3></div><CircleHelp size={17} /></div><div className="question-list">{["నా వరి పంటకు ఏ ఎరువు వాడాలి?", "Will it rain tomorrow?", "How should I prepare my field?", "Where can I check scheme eligibility?"].map((question) => <button key={question} onClick={() => handleAsk(question)}><span>{question}</span><ArrowRight size={15} /></button>)}</div></Card><Card className="language-info-card"><div className="language-roundel">अ</div><div><strong>Your language, your choice.</strong><p>Change your language from the top of the screen. Voice input depends on browser support.</p></div></Card><SampleNotice>Farmly AI uses preset demonstration responses. No live AI service is connected.</SampleNotice></aside>
  </div>
}

export function WeatherScreen() {
  const [period, setPeriod] = useState("7 days")
  const { data: wx, error: wxError, loading: wxLoading } = useWeather()
  const { location, updateLocationFromInput } = useLocation()
  const [searchInput, setSearchInput] = useState(location.district)

  useEffect(() => {
    setSearchInput(location.district)
  }, [location.district])

  if (wxLoading && !wx) {
    return (
      <div className="module-layout">
        <div className="module-main" style={{ padding: "40px 20px" }}>
          <p>Loading live weather for {location.label}… (first request can take a few seconds)</p>
        </div>
      </div>
    )
  }

  if (!wx && wxError) {
    return (
      <div className="module-layout">
        <div className="module-main" style={{ padding: "20px" }}>
          <div className="weather-location-bar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "16px", padding: "12px", background: "#f8faf7", border: "1px solid #e2e8df", borderRadius: "10px" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (searchInput.trim()) updateLocationFromInput(searchInput.trim())
              }}
              style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 260px" }}
            >
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", color: "#6b7280" }} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search city or district..."
                  style={{ width: "100%", padding: "7px 10px 7px 32px", fontSize: "14px", border: "1px solid #c7d2c3", borderRadius: "8px", background: "#fff" }}
                  aria-label="Location search"
                />
              </div>
              <button type="submit" className="primary-action" style={{ padding: "7px 14px", fontSize: "13px" }}>Search</button>
            </form>
          </div>
          <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #f87171", borderRadius: "8px", color: "#991b1b", fontSize: "14px" }}>
            Couldn't find that place. Try the district name
          </div>
        </div>
      </div>
    )
  }

  // Build forecast rows dynamically from live wx.daily_7day
  const weatherRows = (wx?.daily_7day || []).map((d: any, idx: number) => {
    let formattedDate = d.date;
    try {
      const parsed = new Date(d.date + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        formattedDate = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    } catch {}

    const lbl = (d.label || "").toLowerCase();
    let icon = "sun";
    if (lbl.includes("thunder") || lbl.includes("heavy rain") || (d.pop_max !== undefined && d.pop_max >= 60)) {
      icon = "rain";
    } else if (lbl.includes("shower") || lbl.includes("rain") || lbl.includes("drizzle") || (d.pop_max !== undefined && d.pop_max >= 30)) {
      icon = "showers";
    } else if (lbl.includes("cloud") || lbl.includes("overcast")) {
      icon = "cloudsun";
    }

    return {
      day: idx === 0 ? "Today" : d.day,
      date: formattedDate,
      icon,
      high: `${d.temp_max_c}°`,
      low: `${d.temp_min_c}°`,
      rain: `${d.pop_max}%`,
      label: d.label || "Clear",
    };
  });
  const visibleForecast = period === "3 days" ? weatherRows.slice(0, 3) : weatherRows;

  const alert = wx?.alerts?.[0];
  const formattedFetchedAt = wx?.fetched_at
    ? new Date(wx.fetched_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })
    : "Recently";

  const placeName = wx?.location?.name
    ? `${wx.location.name.toUpperCase()}, ${wx.location.state?.toUpperCase() || "INDIA"}`
    : `${location.district.toUpperCase()}, ${location.state.toUpperCase()}`;

  return (
    <div className="module-layout">
      <div className="module-main">
        {/* Location Picker Header */}
        <div className="weather-location-bar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px", padding: "10px 14px", background: "#f8faf7", border: "1px solid #e2e8df", borderRadius: "10px" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchInput.trim()) updateLocationFromInput(searchInput.trim());
            }}
            style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 260px" }}
          >
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", color: "#6b7280" }} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search city or district (e.g. Khunti, Ranchi)..."
                style={{ width: "100%", padding: "7px 10px 7px 32px", fontSize: "14px", border: "1px solid #c7d2c3", borderRadius: "8px", background: "#fff" }}
                aria-label="Search location"
              />
            </div>
            <button type="submit" className="primary-action" style={{ padding: "7px 14px", fontSize: "13px" }}>
              Search
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>Quick switch:</span>
            {["Khunti", "Ranchi", "Hazaribagh", "Ramgarh"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSearchInput(d);
                  updateLocationFromInput(d);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "14px",
                  border: location.district.toLowerCase() === d.toLowerCase() ? "1px solid #2d6a4f" : "1px solid #d1d5db",
                  background: location.district.toLowerCase() === d.toLowerCase() ? "#e8f5e9" : "#fff",
                  color: location.district.toLowerCase() === d.toLowerCase() ? "#164b35" : "#374151",
                  fontWeight: location.district.toLowerCase() === d.toLowerCase() ? 600 : 400,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Not found error banner with retention of previous forecast */}
        {wxError && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #f87171", borderRadius: "8px", color: "#991b1b", fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Info size={16} />
            <span>Couldn't find that place. Try the district name</span>
          </div>
        )}

        <div className="weather-summary-grid">
          <div className="weather-now-card">
            <div className="weather-place">
              <MapPin size={14} /> {placeName} {wx.stale ? <span className="sample-chip">EARLIER DATA</span> : null}
            </div>
            <div className="weather-now-main">
              <div>
                <div className="weather-temp">{wx.current?.temp_c ?? "--"}<span>°</span></div>
                <div className="weather-description">{wx.current?.description || "Conditions update"}</div>
              </div>
              <Sun size={59} strokeWidth={1.2} />
            </div>
            <div className="weather-feels">
              Feels like {wx.current?.feels_like_c ?? "--"}°
              {wx.daily_7day?.[0] ? ` · H: ${wx.daily_7day[0].temp_max_c}° L: ${wx.daily_7day[0].temp_min_c}°` : ""}
            </div>
            <div className="weather-bottom-stats">
              <div><DropletsIcon /><span>HUMIDITY</span><strong>{wx.current?.humidity ?? "--"}%</strong></div>
              <div><CloudRain size={16} /><span>RAIN CHANCE</span><strong>{wx.current?.rain_chance ?? "--"}%</strong></div>
              <div><Wind size={16} /><span>WIND</span><strong>{wx.current?.wind_kmh ?? "--"} km/h</strong></div>
            </div>
          </div>
          <div className="weather-soil-card">
            <span className="card-kicker">ON YOUR FARM</span>
            <div className="soil-water-icon"><DropletsIcon /></div>
            <strong>{wx.soil?.soil_moisture_pct ?? wx.current?.soil_moisture_pct ?? 0}<small>%</small></strong>
            <span>volumetric soil moisture</span>
            <div className="moisture-track">
              <i style={{ width: `${Math.min(100, Math.max(0, wx.soil?.soil_moisture_pct ?? wx.current?.soil_moisture_pct ?? 0))}%` }} />
            </div>
            <small className="moisture-note">
              {wx.soil?.soil_temperature_c !== undefined && wx.soil?.soil_temperature_c !== null
                ? `Soil temp: ${wx.soil.soil_temperature_c}°C`
                : "Live soil reading"}
            </small>
            <span className="sample-chip">LIVE READING</span>
          </div>
        </div>

        <Card className="forecast-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">LOCAL OUTLOOK</span>
              <h3>Coming up in {wx.location?.name || location.district}</h3>
            </div>
            <div className="segmented-control">
              {["7 days", "3 days"].map((item) => (
                <button
                  key={item}
                  className={period === item ? "selected" : ""}
                  onClick={() => setPeriod(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="forecast-list">
            {visibleForecast.map((row: any) => (
              <div className="forecast-row" key={row.day}>
                <div className="forecast-day">
                  <strong>{row.day}</strong>
                  <small>{row.date}</small>
                </div>
                <span className="forecast-emoji" aria-hidden="true">
                  {row.icon === "rain" ? (
                    <CloudRain size={18} />
                  ) : row.icon === "showers" ? (
                    <CloudDrizzle size={18} />
                  ) : row.icon === "cloudsun" ? (
                    <CloudSun size={18} />
                  ) : (
                    <Sun size={18} />
                  )}
                </span>
                <span className="forecast-label">{row.label}</span>
                <span className="forecast-rain"><DropletsIcon /> {row.rain}</span>
                <div className="forecast-range">
                  <strong>{row.high}</strong>
                  <i />
                  <span>{row.low}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="risk-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">CROP-SPECIFIC ALERTS</span>
              <h3>What the weather means for your field</h3>
            </div>
            <span className="risk-badge">
              {wx.alerts && wx.alerts.length > 0
                ? `${wx.alerts.length} ACTIVE`
                : "ALL CLEAR"}
            </span>
          </div>
          {wx.alerts && wx.alerts.length > 0 ? (
            wx.alerts.map((alt: any, idx: number) => (
              <div className="risk-item" key={idx}>
                <span className="risk-weather-icon"><CloudRain size={19} /></span>
                <div>
                  <strong>{alt.title}</strong>
                  <p>{alt.message}</p>
                  <small style={{ color: "#5a6854" }}>
                    Observed: {alt.observed_value}{alt.unit || "%"} (Threshold: {alt.threshold}{alt.unit || "%"})
                    {alt.observed_accumulation_mm ? ` · Rain: ${alt.observed_accumulation_mm} mm` : ""}
                    {alt.window_hours ? ` · Next ${alt.window_hours}h` : ""}
                  </small>
                </div>
                <span className="risk-level">
                  {alt.severity === "action_needed" ? "Action Needed" : "Watch"}
                </span>
              </div>
            ))
          ) : (
            <div className="recommendation-box">
              <strong><Check size={15} /> No weather alerts right now</strong>
              <p>Temperature, rainfall chance, and wind speed are within normal operating ranges for your crops.</p>
            </div>
          )}
        </Card>
      </div>

      <aside className="module-aside">
        <Card className="advisory-card">
          <span className="card-kicker">FARMLY'S FIELD NOTE</span>
          <span className="advisory-icon"><CloudRain size={21} /></span>
          {alert ? (
            <>
              <h3>{alert.title}</h3>
              <p>{alert.message}</p>
              <div className="advisory-action">
                <Check size={15} />
                <span>Observed: {alert.observed_value}{alert.unit || "%"} (Threshold: {alert.threshold}{alert.unit || "%"})</span>
              </div>
              {alert.observed_accumulation_mm !== undefined && alert.observed_accumulation_mm !== null && (
                <div className="advisory-action">
                  <Check size={15} />
                  <span>Accumulation: {alert.observed_accumulation_mm} mm in {alert.window_hours || 36}h window</span>
                </div>
              )}
            </>
          ) : (
            <>
              <h3>No weather alerts right now</h3>
              <p>Conditions are favorable for normal farm operations.</p>
            </>
          )}
          <small>
            {wx.stale ? "Earlier cached data is being shown" : "Live alert calculated from current forecast"}
          </small>
        </Card>

        <div className="sample-notice" style={{ background: wx.stale ? "#fff9e6" : undefined, borderColor: wx.stale ? "#f0c36d" : undefined }}>
          <Info size={15} />
          <span>
            Source: {wx.source || "OpenWeather / Open-Meteo"} · Fetched at {formattedFetchedAt}.
            {wx.stale ? " (Earlier cached data is being shown)" : ""}
          </span>
        </div>

        <Card className="weather-event-card">
          <span className="card-kicker">WEATHER TIMELINE</span>
          {wx.forecast_5day && wx.forecast_5day.length > 0 ? (
            wx.forecast_5day.slice(0, 3).map((slot: any, idx: number) => {
              const localTime = slot.timestamp
                ? new Date(slot.timestamp * 1000).toLocaleTimeString([], {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : slot.time;
              return (
                <div className="weather-event" key={idx}>
                  <i />
                  <div>
                    <strong>{localTime} · {slot.temp_c}°C</strong>
                    <small>{slot.description} · Rain: {slot.pop}% ({slot.rain_mm} mm)</small>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="weather-event">
              <i />
              <div>
                <strong>Timeline</strong>
                <small>Upcoming forecast slots unavailable</small>
              </div>
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}
function DropletsIcon() { return <span className="drop-icon">◌</span> }

export function MandiScreen() {
  const { location } = useLocation();
  const [crop, setCrop] = useState("Paddy");
  const [quantity, setQuantity] = useState(20);
  const [distance, setDistance] = useState(70);
  const [district, setDistrict] = useState("All districts");
  const [sort, setSort] = useState<"price" | "distance">("price");
  const [search, setSearch] = useState("");

  // Clear old transport rate from localStorage on load so existing browsers do not keep stale state
  useEffect(() => {
    try {
      localStorage.removeItem("farmly-transport-rate");
    } catch {}
  }, []);

  // Live mandi prices from backend
  const { data, loading, error, refetch } = usePrices({
    crop,
    quantity,
    district,
    distance,
  });

  const appliedRate = data?.transport_rate_applied ?? 8;

  // Price trend from live backend
  const { data: trendData } = usePriceTrend(crop, location.state, district);

  // Extract distinct districts available in live results plus profile district
  const availableDistricts = useMemo(() => {
    const set = new Set<string>();
    if (location.district) set.add(location.district);
    (data?.records || []).forEach((r) => {
      if (r.district) set.add(r.district);
    });
    return Array.from(set).sort();
  }, [data?.records, location.district]);

  // Filter records by search keyword and sort by net price or distance
  const filteredRecords = useMemo(() => {
    if (!data?.records) return [];
    return data.records
      .filter((r) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (
          r.market.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q) ||
          r.variety.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sort === "price") {
          const netA = a.est_net_per_q ?? a.modal_price;
          const netB = b.est_net_per_q ?? b.modal_price;
          return netB - netA;
        }
        const distA = a.distance_km ?? 99999;
        const distB = b.distance_km ?? 99999;
        return distA - distB;
      });
  }, [data?.records, search, sort]);

  const best = data?.recommendation;

  const chartData = useMemo(() => {
    if (!filteredRecords.length) return [];
    return filteredRecords.slice(0, 7).map((m) => ({
      name: m.market.replace(/\b(APMC|Mandi|Market|Yard)\b/gi, "").trim().slice(0, 10),
      mandi: m.modal_price,
      local: m.transport_cost_per_q || (m.distance_km ? Math.round(m.distance_km * appliedRate) : 0),
    }));
  }, [filteredRecords, appliedRate]);

  const formattedFetchedAt = data?.fetched_at
    ? new Date(data.fetched_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    : "Recently";

  return (
    <div className="module-layout">
      <div className="module-main">
        <Card className="market-tools-card">
          <div className="market-tools-heading">
            <div>
              <span className="card-kicker">LIVE MANDI INTELLIGENCE</span>
              <h3>Compare your selling options</h3>
            </div>
            <span
              className="sample-chip"
              style={{ background: "#e8f4ec", color: "#164b35", borderColor: "#a3cbb1" }}
            >
              LIVE AGMARKNET
            </span>
          </div>

          <div className="market-filter-grid">
            <label>
              <span>Crop</span>
              <select value={crop} onChange={(event) => setCrop(event.target.value)}>
                {crops.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>

            <label>
              <span>Harvest quantity</span>
              <input
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
              />
              <small>quintals</small>
            </label>

            <label>
              <span>District</span>
              <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                <option value="All districts">All districts ({location.state || "Statewide"})</option>
                {availableDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>

            <label>
              <span>Max travel distance</span>
              <select value={distance} onChange={(event) => setDistance(Number(event.target.value))}>
                <option value={30}>Within 30 km</option>
                <option value={50}>Within 50 km</option>
                <option value={70}>Within 70 km</option>
                <option value={100}>Within 100 km</option>
                <option value={200}>Within 200 km</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </Card>

        <Card className="market-table-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">NEARBY MARKETS</span>
              <h3>Where your {crop.toLowerCase()} could go</h3>
            </div>
            <div className="table-tools">
              <label className="search-field">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a mandi or variety"
                />
              </label>
              <button
                className="sort-button"
                onClick={() => setSort(sort === "price" ? "distance" : "price")}
              >
                <ArrowDownWideNarrow size={14} /> {sort === "price" ? "Best net return" : "Nearest"}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <LoaderCircle className="auth-spinner" size={26} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontWeight: 600, color: "#164b35" }}>Loading live mandi prices from Agmarknet…</p>
              <small style={{ color: "#7a8577" }}>
                Connecting to data.gov.in daily feed. First request can take up to a minute.
              </small>
            </div>
          ) : error ? (
            <div style={{ padding: "30px 16px", textAlign: "center" }}>
              <p style={{ color: "#b91c1c", fontWeight: 600, marginBottom: "10px" }}>{error}</p>
              <button
                className="primary-action"
                onClick={refetch}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: "0 auto" }}
              >
                <RefreshCw size={14} /> Retry Live Feed
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: "36px 16px", textAlign: "center" }}>
              <Store size={32} style={{ margin: "0 auto 10px", color: "#8a9485" }} />
              <p style={{ fontWeight: 600, color: "#164b35", fontSize: "15px" }}>
                No mandi reported {crop} in {district !== "All districts" ? district : (location.state || "this region")} today.
              </p>
              <p style={{ color: "#7a8577", fontSize: "13px", marginTop: "6px" }}>
                Try selecting "All districts", widening your travel distance, or switching to another crop.
              </p>
            </div>
          ) : (
            <div className="mandi-table-scroll">
              <table className="mandi-table">
                <thead>
                  <tr>
                    <th scope="col">MARKET</th>
                    <th scope="col">PRICE / Q</th>
                    <th scope="col">TRAVEL</th>
                    <th scope="col">EST. NET / Q</th>
                    <th scope="col">EST. TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((m, index) => {
                    const isBest = best && best.market === m.market && best.district === m.district;
                    return (
                      <tr key={`${m.market}-${m.district}-${index}`} className={isBest ? "best-market-row" : ""}>
                        <td className="market-cell" data-label="Market">
                          <div className="table-market-name">
                            <span className="market-marker">{m.market[0]}</span>
                            <div>
                              <strong>{m.market}</strong>
                              <small>
                                {m.district} district · {m.variety} {isBest && <i>BEST NET RETURN</i>}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="table-price" data-label="Price / quintal">
                          ₹{m.modal_price.toLocaleString("en-IN")}
                          <small style={{ display: "block", fontSize: "10px", color: "#7a8577" }}>
                            {m.arrival_date}
                          </small>
                        </td>
                        <td data-label="Travel">
                          {m.distance_km !== null ? (
                            <>
                              {m.distance_km} km
                              {m.uncertain && (
                                <small style={{ display: "block", fontSize: "10px", color: "#b45309" }}>
                                  (approx)
                                </small>
                              )}
                            </>
                          ) : (
                            <span style={{ color: "#8a9485", fontSize: "12px" }}>Distance unavailable</span>
                          )}
                        </td>
                        <td className="table-net" data-label="Est. net / q">
                          ₹{(m.est_net_per_q ?? m.modal_price).toLocaleString("en-IN")}{" "}
                          {m.transport_cost_per_q !== null && (
                            <small className="transport-sub">−₹{m.transport_cost_per_q} travel</small>
                          )}
                        </td>
                        <td className="table-total" data-label="Est. total">
                          ₹{(m.est_total ?? (m.modal_price * quantity)).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div
            className="sample-notice"
            style={{
              background: data?.stale ? "#fff9e6" : undefined,
              borderColor: data?.stale ? "#f0c36d" : undefined,
              marginTop: "12px",
            }}
          >
            <Info size={15} />
            <span>
              Source: {data?.source || "data.gov.in Agmarknet Daily Feed"} · Fetched at {formattedFetchedAt}.
              {data?.stale ? " (Showing earlier live data)" : ""}
            </span>
          </div>
        </Card>

        <Card className="price-chart-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">PRICE COMPARISON</span>
              <h3>A quick look across markets</h3>
            </div>
            <span className="chart-legend">
              <i /> Price per quintal (₹)
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="mandi-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: 6 }}>
                  <CartesianGrid stroke="#e9ede5" vertical={false} strokeDasharray="3 4" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#7d877b", fontSize: 11 }}
                    dy={7}
                  />
                  <YAxis
                    domain={[
                      Math.max(0, Math.min(...chartData.map((d) => d.mandi)) - 200),
                      Math.max(...chartData.map((d) => d.mandi)) + 200,
                    ]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#929b8f", fontSize: 10 }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${value}`, "Price / quintal"]}
                    contentStyle={{ border: "1px solid #e7ebe3", borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="mandi" fill="#4d8b52" radius={[5, 5, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "#7a8577", fontSize: "13px" }}>
              No price comparison chart available for current filters.
            </div>
          )}

          {trendData && trendData.insufficient_data && (
            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid #e9ede5",
                fontSize: "12px",
                color: "#5a6854",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Info size={14} style={{ color: "#7a8577", flexShrink: 0 }} />
              <span>
                Price trend: Live mandi feed reports single-day arrival data for {crop}. Insufficient historical arrival dates to compute a trend line.
              </span>
            </div>
          )}
        </Card>
      </div>

      <aside className="module-aside mandi-aside">
        <Card className="recommendation-card">
          <span className="card-kicker">FARMLY’S SELLING RECOMMENDATION</span>
          <div className="recommendation-medallion">
            <Store size={20} />
          </div>
          {best ? (
            <>
              <h3>{best.market} looks promising.</h3>
              <p>
                Reported modal price of ₹{best.modal_price.toLocaleString("en-IN")}/q in {best.district}.{" "}
                {best.transport_cost_per_q !== null
                  ? `After estimated travel (₹${best.transport_cost_per_q}/q over ${best.distance_km} km at assumed ₹${appliedRate}/km/q), `
                  : ""}
                {best.basis.toLowerCase()}.
              </p>
              <div className="recommendation-stat">
                <span>Estimated net / quintal</span>
                <strong>
                  ₹{(best.est_net_per_q ?? best.modal_price).toLocaleString("en-IN")}
                </strong>
              </div>
              <div className="recommendation-stat">
                <span>Estimated total · {quantity} q</span>
                <strong>
                  ₹{(best.est_total ?? (best.modal_price * quantity)).toLocaleString("en-IN")}
                </strong>
              </div>
              <div className="sample-notice" style={{ marginTop: "12px" }}>
                <Info size={14} />
                <span>
                  {data?.transport_notice || `Travel cost uses an assumed rate of ₹${appliedRate}/quintal/km (estimate, not an official figure).`}
                </span>
              </div>
            </>
          ) : (
            <>
              <h3>No market qualifies within {distance} km</h3>
              <p>
                {data?.recommendation_notice ||
                  `No market qualifies with a positive estimated net return for ${crop} within ${distance} km. Try increasing distance or trying another crop.`}
              </p>
            </>
          )}
        </Card>

        <Card className="profit-card">
          <span className="card-kicker">YOUR HARVEST ESTIMATE</span>
          <h3>Change the quantity to see your estimate.</h3>
          <div className="quantity-control">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">
              −
            </button>
            <strong>
              {quantity}
              <small> quintals</small>
            </strong>
            <button onClick={() => setQuantity(Math.min(500, quantity + 1))} aria-label="Increase quantity">
              +
            </button>
          </div>
          <p>
            {best
              ? `Estimate based on ${best.market} modal price of ₹${best.modal_price}/q${best.transport_cost_per_q !== null ? ` less ₹${best.transport_cost_per_q} estimated travel per quintal.` : "."}`
              : `Select a crop and location reporting live prices to calculate your net proceeds.`}
          </p>
        </Card>
      </aside>
    </div>
  );
}

export function SoilScreen() {
  const [crop, setCrop] = useState("Paddy")
  const [stage, setStage] = useState("Flowering")
  const [soilPh, setSoilPh] = useState(6.2)
  const [showResult, setShowResult] = useState(false)
  const [uploadedFile, setUploadedFile] = useState("")
  return <div className="module-layout"><div className="module-main"><div className="soil-overview-grid"><Card className="soil-summary-card"><div className="soil-summary-head"><div><span className="card-kicker">FIELD 01 · DEMO TEST DATA</span><h3>Your soil snapshot</h3></div><span className="sample-chip">SAMPLE</span></div><div className="ph-display"><div className="ph-gauge"><span><strong>6.2</strong><small>pH</small></span><i /></div><div className="ph-copy"><strong>Slightly acidic</strong><p>Many crops grow in this range, but local recommendations depend on the crop and soil test.</p><span className="ph-scale-label">Illustrative reading · lab test recommended</span></div></div><div className="soil-metrics-list"><MetricBar label="Nitrogen (N)" value="Low" percent={34} tone="bar-amber" /><MetricBar label="Phosphorus (P)" value="Medium" percent={61} tone="bar-green" /><MetricBar label="Potassium (K)" value="Good" percent={78} tone="bar-deep" /><MetricBar label="Organic carbon" value="0.62%" percent={56} tone="bar-blue" /></div><div className="soil-moisture-row"><span><DropletsIcon /> Soil moisture</span><strong>42%</strong><div className="soil-moisture-bar"><i /></div><small>Sample reading</small></div></Card><Card className="soil-health-card"><span className="card-kicker">A FRIENDLY REMINDER</span><div className="soil-health-illustration"><div><Leaf size={29} /></div><span /><i /></div><h3>Start with a soil test.</h3><p>Nitrogen may need attention in this sample profile. A laboratory test is the right first step before choosing any fertilizer.</p><a href="https://soilhealth.dac.gov.in/" target="_blank" rel="noreferrer">Learn about Soil Health Cards <ExternalLink size={13} /></a></Card></div>
      <Card className="soil-recommend-form"><div className="module-card-heading"><div><span className="card-kicker">ILLUSTRATIVE TOOL</span><h3>Explore a soil-aware recommendation</h3><p>Use test results where available; this tool does not prescribe fertilizer amounts.</p></div><span className="form-leaf"><Leaf size={18} /></span></div><div className="soil-form-grid"><label>Crop<select value={crop} onChange={(event) => setCrop(event.target.value)}>{crops.slice(0, 6).map((item) => <option key={item}>{item}</option>)}</select></label><label>Growth stage<select value={stage} onChange={(event) => setStage(event.target.value)}>{["Sowing", "Vegetative", "Flowering", "Harvest"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Soil pH<input type="number" min="3" max="10" step="0.1" value={soilPh} onChange={(event) => setSoilPh(Number(event.target.value))} /></label><label>Farm area (acres)<input type="number" defaultValue="2.5" min="0.1" /></label></div><button className="primary-action" onClick={() => setShowResult(true)}>View soil guidance <ArrowRight size={15} /></button>{showResult && <div className="soil-result" role="status"><Check size={17} /><div><strong>For {crop.toLowerCase()} at {stage.toLowerCase()}</strong><p>Your entered pH is {soilPh}. Compare this with a recent lab report and ask your local agriculture officer to interpret nutrient levels before applying inputs.</p></div></div>}</Card>
    </div><aside className="module-aside"><Card className="soil-upload-card"><span className="card-kicker">HAVE A SOIL HEALTH CARD?</span><div className="upload-illustration"><FileText size={25} /></div><h3>Keep your soil report close.</h3><p>Upload your Soil Health Card to keep it handy. Demo uploads are not stored or sent anywhere.</p><label className="upload-button"><Plus size={15} /> Choose a file<input type="file" accept=".pdf,image/*" onChange={(event) => setUploadedFile(event.currentTarget.files?.[0]?.name || "")} /></label>{uploadedFile ? <small className="selected-file">{uploadedFile} · demo only</small> : <small>PDF or image · Not uploaded to a server</small>}</Card><SampleNotice>All soil values shown are demonstration values. For real recommendations, use a current laboratory soil test and local agricultural guidance.</SampleNotice><Card className="soil-info-card"><span className="card-kicker">READING YOUR REPORT</span>{[["pH", "Acidity or alkalinity"], ["N · P · K", "Key crop nutrients"], ["Organic carbon", "Soil organic matter indicator"]].map(([label, detail]) => <div key={label}><strong>{label}</strong><span>{detail}</span></div>)}</Card></aside></div>
}

export function CropPlannerScreen({ profile }: { profile: FarmerProfile }) {
  const [selectedCrop, setSelectedCrop] = useState(profile.crop || "Paddy")
  const [query, setQuery] = useState("")
  const [area, setArea] = useState(Number(profile.acres) || 2.5)
  const [season, setSeason] = useState("Kharif")
  const [soil, setSoil] = useState(profile.soil || "Clay loam")
  const [irrigation, setIrrigation] = useState(profile.irrigation || "Rain-fed")
  const [saved, setSaved] = useState(false)
  const cropCost: Record<string, number> = { Paddy: 9000, Wheat: 8200, Maize: 7600, Tomato: 18000, Potato: 20000, Mustard: 7800, Soybean: 7900, Groundnut: 11500, Cotton: 14500, Pulses: 7200 }
  const baseCost = cropCost[selectedCrop] || 9000
  const costs = [{ label: "Seeds", amount: Math.round(baseCost * 0.17) }, { label: "Nutrients & manure", amount: Math.round(baseCost * 0.31) }, { label: "Labour", amount: Math.round(baseCost * 0.28) }, { label: "Water & field prep", amount: Math.round(baseCost * 0.15) }, { label: "Other expenses", amount: Math.round(baseCost * 0.09) }]
  const [costValues, setCostValues] = useState<Record<string, number>>({})
  const editableCosts = costs.map((item) => ({ ...item, amount: costValues[item.label] ?? item.amount }))
  const total = editableCosts.reduce((sum, item) => sum + item.amount, 0) * area
  const filteredCrops = crops.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  const savePlan = () => {
    try {
      window.localStorage.setItem("farmly-saved-crop-plan", JSON.stringify({ crop: selectedCrop, area, soil, irrigation, season, budgetPerAcre: editableCosts, total, timeline }))
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }
  const downloadPlan = () => {
    const plan = [`Farmly.AI · Illustrative crop plan`, `Crop: ${selectedCrop}`, `Location: ${profile.village}, ${profile.district}, ${profile.state}`, `Area: ${area} acres · ${soil} · ${irrigation} · ${season}`, `Estimated sample budget: ₹${Math.round(total).toLocaleString("en-IN")}`, `Budget per acre:`, ...editableCosts.map((item) => `${item.label}: ₹${item.amount.toLocaleString("en-IN")}`), ``, `Seed: Choose a certified, locally suitable variety with your agriculture extension office.`, `Nutrients: Use a current soil test and official crop guidance; no quantities are prescribed here.`, `Water: Check local rainfall, irrigation access, and crop growth stage.`, `Protection: Monitor regularly and use integrated pest management.`, ``, `Timeline: ${timeline.join(" → ")}`, ``, `DEMO ONLY. Costs and crop guidance are illustrative, not verified local recommendations.`].join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([plan], { type: "text/plain" }))
    link.download = `farmly-${selectedCrop.toLowerCase()}-plan.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return <div className="planner-page"><div className="planner-intro"><div className="planner-intro-icon"><Sprout size={22} /></div><div><strong>A better season starts before the first seed.</strong><p>Choose a crop, tell us a little about your land, and make a plan you can discuss with your local agriculture advisor.</p></div><span>PLAN BUILDER</span></div>
    <div className="module-layout"><div className="module-main"><Card className="crop-picker-card"><div className="module-card-heading"><div><span className="card-kicker">01 · CHOOSE YOUR CROP</span><h3>What are you thinking of growing?</h3></div><label className="search-field crop-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search crops" /></label></div><div className="crop-choice-grid">{filteredCrops.map((item, index) => <button key={item} className={`crop-choice ${item === selectedCrop ? "planner-crop-selected" : ""}`} onClick={() => { setSelectedCrop(item); setSaved(false) }}><span className={`crop-emoji crop-tone-${index % 5}`}><Sprout size={14} /></span><strong>{item}</strong>{item === selectedCrop && <Check size={14} />}</button>)}</div></Card>
      <Card className="farm-input-card"><div className="module-card-heading"><div><span className="card-kicker">02 · TELL US ABOUT YOUR FIELD</span><h3>Make this plan yours</h3></div><span className="location-mini"><MapPin size={13} /> {profile.district}, {profile.state}</span></div><div className="soil-form-grid planner-fields"><label>Farm area<input type="number" value={area} min="0.1" step="0.1" onChange={(event) => setArea(Math.max(0.1, Number(event.target.value)))} /><small>acres</small></label><label>Soil type<select value={soil} onChange={(event) => setSoil(event.target.value)}>{["Clay loam", "Sandy loam", "Black soil", "Red soil", "Alluvial", "Not sure"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Water access<select value={irrigation} onChange={(event) => setIrrigation(event.target.value)}>{["Rain-fed", "Canal", "Well / borewell", "Drip irrigation", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Growing season<select value={season} onChange={(event) => setSeason(event.target.value)}>{["Kharif", "Rabi", "Zaid"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Expected planting date<input type="date" defaultValue="2026-11-10" /></label></div></Card>
      <Card className="crop-plan-card"><div className="module-card-heading"><div><span className="card-kicker">03 · YOUR {selectedCrop.toUpperCase()} PLAN</span><h3>A practical starting point</h3><p>For {area} acres · {soil} · {season} season · {irrigation}</p></div><span className="sample-chip">DEMO PLAN</span></div><div className="plan-grid">{[["01", "Seed selection", "Choose certified seed suited to your district and planting window. Confirm variety and seed rate with your local extension office."], ["02", "Nutrients & manure", "Use your latest soil test to decide nutrient needs. Avoid applying fertilizer without crop- and soil-specific advice."], ["03", "Land preparation", "Prepare a level field with drainage appropriate to local rainfall and your crop’s needs."], ["04", "Water plan", "Match irrigation to rainfall and crop stage. Paddy needs reliable water, with field drainage between heavy showers."], ["05", "Tools & equipment", "Plan access to a seed drill or transplanting tools, hand tools, and safe protective equipment."], ["06", "Crop protection", "Scout fields regularly; use prevention and integrated pest management. Seek local diagnosis before any treatment."]].map(([num, title, detail]) => <div className="plan-item" key={num}><span>{num}</span><div><strong>{title}</strong><p>{selectedCrop === "Paddy" && num === "04" ? "For paddy, coordinate water availability with growth stage. Keep drains clear during intense monsoon rain." : detail}</p></div></div>)}</div><SampleNotice>Varieties, seed rates, nutrient rates, and crop timing vary by district and season. Confirm with KVK or your state agriculture department.</SampleNotice></Card>
      <Card className="crop-timeline-card"><div className="module-card-heading"><div><span className="card-kicker">04 · THE SEASON AHEAD</span><h3>Your growing timeline</h3></div><span className="timeline-season">{season} · illustrative</span></div><div className="timeline-track" role="list" aria-label="Growing season stages. Scroll horizontally to view all nine stages." tabIndex={0}>{timeline.map((step, index) => <div className={`timeline-step ${index === 0 ? "timeline-current" : ""}`} key={step} role="listitem"><span>{index + 1}</span><strong>{step}</strong><small>{index === 0 ? "Start here" : `Stage ${index + 1}`}</small></div>)}</div></Card>
    </div><aside className="module-aside"><Card className="crop-budget-card"><span className="card-kicker">05 · ESTIMATED BUDGET</span><h3>Plan your spending, too.</h3><p>Editable sample costs scaled to your farm area.</p><div className="budget-list">{editableCosts.map((item) => <div key={item.label}><span>{item.label}</span><label>₹<input type="number" aria-label={`${item.label} cost per acre`} value={item.amount} min="0" onChange={(event) => setCostValues((current) => ({ ...current, [item.label]: Math.max(0, Number(event.target.value)) }))} /></label></div>)}</div><div className="budget-total"><span>Estimated total</span><strong>₹{Math.round(total).toLocaleString("en-IN")}</strong></div><small>₹{baseCost.toLocaleString("en-IN")} / acre · demo estimate</small><button className="primary-action full-action" onClick={downloadPlan}><Download size={15} /> Download crop plan</button><button className="outline-action full-action" onClick={() => window.print()}><FileText size={15} /> Print this plan</button>{saved && <div className="saved-inline"><Check size={14} /> Saved to this browser</div>}<button className="text-action save-plan" onClick={savePlan}><Plus size={14} /> Save plan to My Farm</button></Card><Card className="crop-fit-card"><span className="card-kicker">FARMLY SUGGESTS</span><div className="fit-icon"><Leaf size={18} /></div><h3>{selectedCrop} can be one option.</h3><p>Compare water access, soil test results, planting window, and likely market access before deciding.</p><span className="fit-footnote"><Info size={13} /> Not a yield or profit guarantee.</span></Card><SampleNotice>Budget values are editable and illustrative, not quotations or verified local input costs.</SampleNotice></aside></div>
  </div>
}

export function SchemesScreen({ profile }: { profile: FarmerProfile }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All schemes")
  const [selected, setSelected] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [landSize, setLandSize] = useState("Small farmer (up to 2 ha)")
  const categories = ["All schemes", "Income support", "Crop insurance", "Agricultural credit", "Irrigation subsidy", "Soil & inputs", "State support"]
  const visible = schemeData.filter((scheme) => (filter === "All schemes" || scheme.category.toLowerCase() === filter.toLowerCase()) && `${scheme.name} ${scheme.full} ${scheme.category}`.toLowerCase().includes(search.toLowerCase()))
  const detail = schemeData.find((scheme) => scheme.id === selected)
  return <div className="schemes-page"><div className="scheme-hero"><div className="scheme-hero-copy"><span className="card-kicker">A LITTLE SUPPORT GOES A LONG WAY</span><h2>There may be a scheme<br />for your next step.</h2><p>Explore support programmes for income, crop insurance, credit, irrigation, and more.</p><button onClick={() => { setProfileOpen(true); document.getElementById("scheme-matcher")?.scrollIntoView({ behavior: "smooth", block: "start" }) }}>Find schemes for my farm <ArrowRight size={15} /></button></div><div className="scheme-hero-art"><div className="scheme-sun" /><div className="scheme-leaf leaf-one"><Leaf size={59} /></div><div className="scheme-leaf leaf-two"><Leaf size={40} /></div><span>FARMER<br />SUPPORT</span></div><span className="scheme-hero-mark">₹</span></div>
    <div className="scheme-stat-strip"><div><strong>6</strong><span>PROGRAMMES TO EXPLORE</span></div><div><strong>3</strong><span>COULD BE RELEVANT</span></div><div><strong>0</strong><span>OFFICIAL APPROVALS CLAIMED</span></div><span>PRELIMINARY GUIDANCE ONLY</span></div>
    <div className="scheme-layout"><div className="scheme-results"><div className="scheme-results-heading"><div><span className="card-kicker">EXPLORE SUPPORT</span><h3>Programmes worth knowing about</h3></div><span className="sample-chip">VERIFY WITH OFFICIAL PORTALS</span></div><label className="scheme-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search schemes by name or benefit" /><Filter size={15} /></label><div className="scheme-categories">{categories.map((category) => <button key={category} className={filter === category ? "category-selected" : ""} onClick={() => setFilter(category)}>{category}</button>)}</div><div className="scheme-card-list">{visible.map((scheme) => <article className="scheme-card" key={scheme.id}><div className={`scheme-symbol ${scheme.color}`}>{scheme.mark}</div><div className="scheme-card-body"><div className="scheme-card-meta"><span>{scheme.category}</span><span className="scheme-type">{scheme.type}</span></div><h4>{scheme.name}</h4><p className="scheme-full-name">{scheme.full}</p><p className="scheme-card-description">{scheme.about}</p><div className="scheme-benefit-row"><span><strong>Potential benefit</strong>{scheme.benefit}</span><span><strong>Location</strong>{scheme.id === "jharkhand" ? "Jharkhand" : "India · eligibility varies"}</span><span><strong>Farmly match</strong><i className={scheme.fit === "Potentially relevant" ? "match-positive" : "match-caution"}>{scheme.fit}</i></span></div><div className="scheme-card-footer"><span><Info size={13} /> Information is illustrative · verify latest details</span><div><button onClick={() => setSelected(scheme.id)}>Scheme details <ArrowRight size={14} /></button><a href={scheme.url} target="_blank" rel="noreferrer">Official source <ExternalLink size={12} /></a></div></div></div></article>)}</div>{visible.length === 0 && <div className="empty-schemes">No schemes match those filters. Try a different search.</div>}</div>
      <aside className="scheme-aside"><Card className="matcher-card" ><div id="scheme-matcher" /><span className="card-kicker">PERSONALIZED DISCOVERY</span><h3>Find schemes for my farm</h3><p>A few details help show potentially relevant programmes. Skip anything you don’t know.</p><label>State<select defaultValue={profile.state}><option>Jharkhand</option><option>Bihar</option><option>Odisha</option><option>West Bengal</option></select></label><label>Landholding<select value={landSize} onChange={(event) => setLandSize(event.target.value)}><option>Small farmer (up to 2 ha)</option><option>Marginal farmer (up to 1 ha)</option><option>More than 2 ha</option><option>Not sure</option></select></label><label>Land status<select defaultValue="Owner / co-owner"><option>Owner / co-owner</option><option>Tenant farmer</option><option>Not sure</option></select></label><label>Main crop<select defaultValue={profile.crop}><option>{profile.crop}</option><option>Maize</option><option>Wheat</option><option>Vegetables</option><option>Other</option></select></label><button className="primary-action full-action" onClick={() => setProfileOpen(!profileOpen)}>{profileOpen ? "Hide match summary" : "See potential matches"} <ArrowRight size={15} /></button>{profileOpen && <div className="match-summary"><strong><BadgeCheck size={15} /> Potentially relevant</strong><p>PMFBY and KCC may be worth exploring for your farm profile. Requirements depend on notified crops, district, lender, and current enrollment windows.</p><strong className="needs-check"><CircleHelp size={15} /> More information needed</strong><p>PM-KISAN and irrigation support require official checks of land records, exclusions, and state programme availability.</p></div>}<div className="privacy-note"><ShieldCheck size={14} /> These details stay in this demo experience.</div></Card><div className="eligibility-disclaimer"><Info size={16} /><p>Eligibility shown by Farmly.AI is preliminary guidance. Final eligibility and approval are determined by the relevant government department.</p></div><Card className="official-links-card"><span className="card-kicker">TRUSTED STARTING POINTS</span>{[["myScheme", "https://www.myscheme.gov.in/"], ["PM-KISAN", "https://pmkisan.gov.in/"], ["PMFBY", "https://pmfby.gov.in/"], ["Jharkhand Govt.", "https://www.jharkhand.gov.in/"]].map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><span>{name}</span><ExternalLink size={13} /></a>)}</Card></aside></div>
    {detail && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="scheme-modal" role="dialog" aria-modal="true" aria-labelledby="scheme-modal-title"><button className="icon-button modal-close" onClick={() => setSelected(null)} aria-label="Close scheme details"><X size={19} /></button><span className="card-kicker">{detail.type} · PRELIMINARY INFORMATION</span><div className={`scheme-symbol ${detail.color}`}>{detail.mark}</div><h2 id="scheme-modal-title">{detail.full}</h2><p>{detail.about}</p><div className="modal-detail-grid"><div><strong>Potential benefit</strong><span>{detail.benefit}</span></div><div><strong>Common documents to ask about</strong><span>Requirements vary; check scheme-specific portal, bank, and state guidance. Do not assume a universal checklist.</span></div><div><strong>About eligibility</strong><span>{detail.fitReason}</span></div><div><strong>Next step</strong><span>Check the current official notification or contact your district agriculture office.</span></div></div><div className="modal-disclaimer"><Info size={15} /> Demo information, not official or current eligibility confirmation.</div><a className="primary-action modal-official-link" href={detail.url} target="_blank" rel="noreferrer">Visit official information source <ExternalLink size={14} /></a></section></div>}
  </div>
}

export function ProfileScreen({ profile, onSave }: { profile: FarmerProfile; onSave: (profile: FarmerProfile) => void }) {
  const [form, setForm] = useState(profile)
  const [savedPlan, setSavedPlan] = useState<{ crop: string; area: number; total: number } | null>(null)
  const { setLocation } = useLocation()
  useEffect(() => {
    setForm(profile)
  }, [profile])
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("farmly-saved-crop-plan")
      if (stored) {
        const plan = JSON.parse(stored) as { crop?: string; area?: number; total?: number }
        if (plan.crop) setSavedPlan({ crop: plan.crop, area: plan.area || 0, total: plan.total || 0 })
      }
    } catch { /* Keep the profile usable if browser storage is unavailable. */ }
  }, [])
  const set = (key: keyof FarmerProfile, value: string) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="profile-layout"><div className="profile-main"><Card className="profile-card"><div className="profile-card-banner"><div className="profile-large-avatar">{form.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><span className="card-kicker">YOUR FARM PROFILE</span><h3>{form.name}</h3><span><MapPin size={13} /> {form.village}, {form.district}</span></div><span className="profile-data-badge"><ShieldCheck size={14} /> Saved in this browser</span></div><div className="profile-form-grid"><label>Farmer name<input value={form.name} onChange={(event) => set("name", event.target.value)} /></label><label>Village<input value={form.village} onChange={(event) => set("village", event.target.value)} /></label><LocationSelect state={form.state} district={form.district} onStateChange={(s) => set("state", s)} onDistrictChange={(d) => set("district", d)} variant="profile" /><label>Preferred language<select value={form.language} onChange={(event) => set("language", event.target.value)}>{["English", "हिंदी", "తెలుగు", "मराठी", "தமிழ்", "ਪੰਜਾਬੀ"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Farm size<input type="number" min="0.1" step="0.1" value={form.acres} onChange={(event) => set("acres", event.target.value)} /><small>acres</small></label><label>Main crop<input value={form.crop} onChange={(event) => set("crop", event.target.value)} /></label><label>Soil type<select value={form.soil} onChange={(event) => set("soil", event.target.value)}>{["Clay loam", "Sandy loam", "Black soil", "Red soil", "Alluvial", "Not sure"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Irrigation access<select value={form.irrigation} onChange={(event) => set("irrigation", event.target.value)}>{["Rain-fed", "Canal", "Well / borewell", "Drip irrigation", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Farming experience<input value={form.experience} onChange={(event) => set("experience", event.target.value)} /></label></div><div className="profile-card-footer"><span><Info size={14} /> This demo saves profile details only to this browser.</span><button className="primary-action" onClick={() => {
              onSave(form)
              if (form.district) {
                setLocation({
                  district: form.district,
                  state: form.state,
                  label: `${form.district}, ${form.state}`,
                })
              }
            }}>Save farm profile <Check size={15} /></button></div></Card><Card className="profile-language-card"><div className="language-roundel">अ</div><div><span className="card-kicker">MADE FOR YOUR LANGUAGE</span><h3>Farm advice should sound familiar.</h3><p>Choose a preferred language above. Voice recognition is subject to your browser and device support.</p></div></Card></div><aside className="profile-aside"><Card className="profile-summary-card"><span className="card-kicker">YOUR FARM AT A GLANCE</span><div className="profile-summary-stat"><Sprout size={17} /><div><span>Main crop</span><strong>{form.crop}</strong></div></div><div className="profile-summary-stat"><MapPin size={17} /><div><span>Location</span><strong>{form.district}, {form.state}</strong></div></div><div className="profile-summary-stat"><Leaf size={17} /><div><span>Land area</span><strong>{form.acres} acres</strong></div></div><div className="profile-summary-stat"><DropletsIcon /><div><span>Irrigation</span><strong>{form.irrigation}</strong></div></div>{savedPlan && <div className="saved-plan-summary"><span className="card-kicker">SAVED CROP PLAN</span><strong>{savedPlan.crop} · {savedPlan.area} acres</strong><small>Illustrative budget · ₹{Math.round(savedPlan.total).toLocaleString("en-IN")}</small></div>}</Card><SampleNotice>Your farm profile is sample information and can be edited. No account or cloud storage is connected.</SampleNotice></aside></div>
}
