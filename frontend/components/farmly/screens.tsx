"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownWideNarrow, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown, CircleHelp, CloudDrizzle, CloudRain, CloudSun, Download, ExternalLink, FileText, Filter, Info, Leaf, MapPin, Mic, MicOff, Play, Plus, Search, Send, ShieldCheck, Sprout, Store, Sun, Volume2, VolumeX, Wind, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { FarmerProfile } from "./farmly-app"

type Mandi = { name: string; district: string; price: number; distance: number }
const markets: Mandi[] = [
  { name: "Ranchi APMC", district: "Ranchi", price: 2350, distance: 42 },
  { name: "Khunti Mandi", district: "Khunti", price: 2280, distance: 18 },
  { name: "Ramgarh Market", district: "Ramgarh", price: 2420, distance: 65 },
  { name: "Tamar Mandi", district: "Ranchi", price: 2310, distance: 31 },
]
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

export function VoiceScreen({ language, profile }: { language: string; profile: FarmerProfile }) {
  const [listening, setListening] = useState(false)
  const [query, setQuery] = useState("")
  const [answer, setAnswer] = useState("")
  const [answerTranslation, setAnswerTranslation] = useState("")
  const [recognized, setRecognized] = useState("")
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const languageKey = language === "తెలుగు" ? "Telugu"
    : language === "हिंदी" ? "Hindi"
    : language === "मराठी" ? "Marathi"
    : language === "தமிழ்" ? "Tamil"
    : language === "ਪੰਜਾਬੀ" ? "Punjabi"
    : language
  const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  const handleAsk = async (text = query) => {
    const question = text.trim()
    if (!question || loading) return
    setRecognized(question)
    setQuery("")
    setError("")
    setAnswer("")
    setAnswerTranslation("")
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          language: languageKey,
          crop: profile.crop,
          location: `${profile.village}, ${profile.district}, ${profile.state}`,
          soil: profile.soil,
          irrigation: profile.irrigation,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || "Could not get an answer from Farmly AI.")
      setAnswer(data.answer || "I couldn't prepare an answer. Please try again.")
      setAnswerTranslation(data.english_translation || data.answer || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to Farmly AI.")
    } finally {
      setLoading(false)
    }
  }

  const toggleListening = async () => {
    if (listening && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setListening(false)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser does not support microphone recording. Type your question instead.")
      return
    }
    try {
      setError("")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setError("Microphone recording failed. Please try again.")
        setListening(false)
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.onstop = async () => {
        setListening(false)
        setTranscribing(true)
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioChunksRef.current = []
        if (!audioBlob.size) {
          setTranscribing(false)
          setError("No audio was captured. Please try speaking again.")
          return
        }
        try {
          const formData = new FormData()
          formData.append("audio", audioBlob, "farmer-question.webm")
          const response = await fetch(
            `${API_URL}/voice/transcribe?language=${encodeURIComponent(languageKey)}`,
            { method: "POST", body: formData },
          )
          const data = await response.json()
          if (!response.ok) throw new Error(data.detail || "Speech transcription failed.")
          if (!data.transcript?.trim()) throw new Error("I couldn't understand the recording. Please try again.")
          await handleAsk(data.transcript)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to transcribe your voice.")
        } finally {
          setTranscribing(false)
          mediaRecorderRef.current = null
        }
      }
      recorder.start()
      setListening(true)
    } catch (err) {
      setError(err instanceof Error && err.name === "NotAllowedError"
        ? "Please allow microphone access in your browser."
        : "Could not start the microphone. Check that it is connected and try again.")
    }
  }

  const speak = async () => {
    if (!answer) return
    if (speaking) {
      audioRef.current?.pause()
      audioRef.current = null
      setSpeaking(false)
      return
    }
    setError("")
    try {
      const response = await fetch(`${API_URL}/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer, language: languageKey }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || "Could not generate audio.")
      }
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        setSpeaking(false)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        setSpeaking(false)
        setError("Audio playback failed. Please try again.")
      }
      await audio.play()
      setSpeaking(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to play the response.")
      setSpeaking(false)
    }
  }

  return <div className="module-layout voice-layout">
    <div className="voice-primary">
      <Card className="voice-stage-card">
        <div className="voice-stage-top">
          <span className="status-pill"><span className="status-dot" /> LIVE AI ASSISTANT</span>
          <span className="voice-language-pill">Speaking in <strong>{language}</strong></span>
        </div>
        <div className={`voice-orbit ${listening ? "is-listening" : ""}`}>
          <div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><div className="orbit-ring orbit-three" />
          <button className={`big-mic ${listening ? "mic-listening" : ""}`} onClick={toggleListening} aria-label={listening ? "Stop listening" : "Start voice input"} disabled={loading}>
            {listening ? <MicOff size={29} /> : <Mic size={29} />}
          </button>
          <div className="voice-wave"><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
        <p className="voice-state">{loading ? "Farmly is preparing your answer…" : transcribing ? "Converting your voice to text…" : listening ? "I’m listening… tap again when you’re done" : "Tap the mic and tell me what’s on your mind"}</p>
        <p className="voice-subtext">Ask in English, हिंदी, తెలుగు, मराठी, தமிழ், or ਪੰਜਾਬੀ</p>
        <div className="voice-compose">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) void handleAsk()
          }} placeholder="Or type your question here…" aria-label="Type your farming question" />
          <button onClick={() => void handleAsk()} aria-label="Send question" disabled={loading || transcribing || !query.trim()}><Send size={17} /></button>
        </div>
        {error && <p className="answer-caution" role="alert">{error}</p>}
      </Card>
      {(answer || loading) && <Card className="voice-answer">
        <div className="answer-heading">
          <div className="ai-avatar"><Leaf size={17} /></div>
          <div><strong>Farmly AI <span>GROQ POWERED</span></strong><small>Advice based on the farm details available in this demo</small></div>
          <button className="icon-button" onClick={() => void speak()} aria-label={speaking ? "Stop audio" : "Play response aloud"} disabled={!answer}>{speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
        </div>
        {recognized && <div className="question-echo"><span>YOU ASKED</span><p>{recognized}</p></div>}
        {loading ? <p className="answer-original">Thinking…</p> : <>
          <p className="answer-original">{answer}</p>
          <div className="answer-translation"><span>ENGLISH TRANSLATION</span><p>{answerTranslation}</p></div>
        </>}
        <div className="answer-caution"><Info size={14} /> Verify important crop-protection and fertilizer decisions with your local KVK or agriculture officer.</div>
      </Card>}
    </div>
    <aside className="voice-sidebar">
      <Card className="conversation-card">
        <div className="side-card-title"><div><span className="card-kicker">QUICK QUESTIONS</span><h3>Where shall we start?</h3></div><CircleHelp size={17} /></div>
        <div className="question-list">{["నా వరి పంటకు ఏ ఎరువు వాడాలి?", "Will it rain tomorrow?", "How should I prepare my field?", "Where can I check scheme eligibility?"].map((question) => <button key={question} onClick={() => void handleAsk(question)} disabled={loading || transcribing}><span>{question}</span><ArrowRight size={15} /></button>)}</div>
      </Card>
      <Card className="language-info-card"><div className="language-roundel">अ</div><div><strong>Your language, your choice.</strong><p>Change your language from the top of the screen. Voice input is transcribed by Sarvam AI.</p></div></Card>
      <SampleNotice>Live AI answers are generated with Groq. Spoken responses use Sarvam AI.</SampleNotice>
    </aside>
  </div>
}

const weatherRows = [
  { day: "Today", date: "Oct 30", icon: "sun", high: "29°", low: "21°", rain: "20%", label: "Partly cloudy" },
  { day: "Saturday", date: "Oct 31", icon: "showers", high: "28°", low: "20°", rain: "75%", label: "Showers likely" },
  { day: "Sunday", date: "Nov 1", icon: "rain", high: "27°", low: "20°", rain: "68%", label: "Light rain" },
  { day: "Monday", date: "Nov 2", icon: "cloudsun", high: "29°", low: "21°", rain: "42%", label: "Clouds & sun" },
  { day: "Tuesday", date: "Nov 3", icon: "sun", high: "31°", low: "21°", rain: "20%", label: "Mostly sunny" },
  { day: "Wednesday", date: "Nov 4", icon: "sun", high: "32°", low: "22°", rain: "14%", label: "Sunny" },
  { day: "Thursday", date: "Nov 5", icon: "cloudsun", high: "31°", low: "21°", rain: "12%", label: "Clouds & sun" },
]
export function WeatherScreen() {
  const [period, setPeriod] = useState("7 days")
  const visibleForecast = period === "3 days" ? weatherRows.slice(0, 3) : weatherRows
  return <div className="module-layout"><div className="module-main"><div className="weather-summary-grid"><div className="weather-now-card"><div className="weather-place"><MapPin size={14} /> KHUNTI, JHARKHAND <span>DEMO</span></div><div className="weather-now-main"><div><div className="weather-temp">29<span>°</span></div><div className="weather-description">Partly cloudy</div></div><Sun size={59} strokeWidth={1.2} /></div><div className="weather-feels">Feels like 32° <span>·</span> H: 30° L: 21°</div><div className="weather-bottom-stats"><div><DropletsIcon /><span>HUMIDITY</span><strong>78%</strong></div><div><CloudRain size={16} /><span>RAIN CHANCE</span><strong>75%</strong></div><div><Wind size={16} /><span>WIND</span><strong>12 km/h</strong></div></div></div><div className="weather-soil-card"><span className="card-kicker">ON YOUR FARM</span><div className="soil-water-icon"><DropletsIcon /></div><strong>42<small>%</small></strong><span>Soil moisture</span><div className="moisture-track"><i /></div><small className="moisture-note">Below your crop’s preferred range</small><span className="sample-chip">DEMO READING</span></div></div>
      <Card className="forecast-card"><div className="module-card-heading"><div><span className="card-kicker">LOCAL OUTLOOK · DEMO</span><h3>Coming up in Khunti</h3></div><div className="segmented-control">{["7 days", "3 days"].map((item) => <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><div className="forecast-list">{visibleForecast.map((row) => <div className="forecast-row" key={row.day}><div className="forecast-day"><strong>{row.day}</strong><small>{row.date}</small></div><span className="forecast-emoji" aria-hidden="true">{row.icon === "rain" ? <CloudRain size={18} /> : row.icon === "showers" ? <CloudDrizzle size={18} /> : row.icon === "cloudsun" ? <CloudSun size={18} /> : <Sun size={18} />}</span><span className="forecast-label">{row.label}</span><span className="forecast-rain"><DropletsIcon /> {row.rain}</span><div className="forecast-range"><strong>{row.high}</strong><i /><span>{row.low}</span></div></div>)}</div></Card>
      <Card className="risk-card"><div className="module-card-heading"><div><span className="card-kicker">CROP-SPECIFIC RISK</span><h3>What the weather means for your field</h3></div><span className="risk-badge">MODERATE RISK</span></div><div className="risk-item"><span className="risk-weather-icon"><CloudRain size={19} /></span><div><strong>Heavy rainfall</strong><p>Rain likely within 36 hours may leave water standing around young plants.</p></div><span className="risk-level">Watch</span></div><div className="risk-item"><span className="risk-weather-icon amber"><Wind size={19} /></span><div><strong>Pest-friendly humidity</strong><p>Warm, humid conditions can increase disease pressure. Monitor leaves regularly.</p></div><span className="risk-level risk-low">Low</span></div><div className="recommendation-box"><strong><Check size={15} /> A practical next step</strong><p>Clear drainage channels today. Avoid spraying before rain; follow local crop-protection guidance.</p></div></Card>
    </div><aside className="module-aside"><Card className="advisory-card"><span className="card-kicker">FARMLY’S FIELD NOTE</span><span className="advisory-icon"><CloudRain size={21} /></span><h3>Rainfall alert</h3><p>Showers are expected in the next 36 hours. A little preparation now can prevent waterlogging later.</p><div className="advisory-action"><Check size={15} /><span>Check field drains & bunds</span></div><div className="advisory-action"><Check size={15} /><span>Postpone fertilizer application</span></div><small>Demo forecast · not a live weather service</small></Card><SampleNotice>Forecast and risk values are illustrative. Check IMD or your local weather service before making time-sensitive decisions.</SampleNotice><Card className="weather-event-card"><span className="card-kicker">WEATHER TIMELINE</span><div className="weather-event"><i /><div><strong>Rain window opens</strong><small>Tomorrow afternoon · illustrative</small></div></div><div className="weather-event"><i /><div><strong>Field check reminder</strong><small>After rainfall · drainage</small></div></div><div className="weather-event"><i /><div><strong>Review crop health</strong><small>Following 2–3 days</small></div></div></Card></aside></div>
}
function DropletsIcon() { return <span className="drop-icon">◌</span> }

export function MandiScreen() {
  const [crop, setCrop] = useState("Paddy")
  const [quantity, setQuantity] = useState(20)
  const [distance, setDistance] = useState(70)
  const [district, setDistrict] = useState("All districts")
  const [sort, setSort] = useState<"price" | "distance">("price")
  const [search, setSearch] = useState("")
  const cropPriceAdjustments: Record<string, number> = { Paddy: 0, Maize: -450, Wheat: -180, Mustard: 340 }
  const marketPrices = useMemo(() => markets.map((market) => ({ ...market, price: market.price + (cropPriceAdjustments[crop] || 0) })), [crop])
  const sortedMarkets = useMemo(() => marketPrices.filter((market) => market.distance <= distance && (district === "All districts" || market.district === district) && `${market.name} ${market.district}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "price" ? b.price - a.price : a.distance - b.distance), [distance, district, marketPrices, search, sort])
  const best = sortedMarkets[0] || marketPrices[0]
  const chartData = marketPrices.map((market) => ({ name: market.name.split(" ")[0], mandi: market.price, local: market.distance * 9 }))
  return <div className="module-layout"><div className="module-main"><Card className="market-tools-card"><div className="market-tools-heading"><div><span className="card-kicker">MAKE THE NUMBERS WORK FOR YOU</span><h3>Compare your selling options</h3></div><span className="sample-chip">ILLUSTRATIVE PRICES</span></div><div className="market-filter-grid"><label><span>Crop</span><select value={crop} onChange={(event) => setCrop(event.target.value)}><option>Paddy</option><option>Maize</option><option>Wheat</option><option>Mustard</option></select><ChevronDown size={14} /></label><label><span>Harvest quantity</span><input type="number" min="1" max="500" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /><small>quintals</small></label><label><span>District</span><select value={district} onChange={(event) => setDistrict(event.target.value)}><option>All districts</option><option>Ranchi</option><option>Khunti</option><option>Ramgarh</option></select><ChevronDown size={14} /></label><label><span>Max travel distance</span><select value={distance} onChange={(event) => setDistance(Number(event.target.value))}><option value={30}>Within 30 km</option><option value={50}>Within 50 km</option><option value={70}>Within 70 km</option></select><ChevronDown size={14} /></label></div></Card>
      <Card className="market-table-card"><div className="module-card-heading"><div><span className="card-kicker">NEARBY MARKETS</span><h3>Where your {crop.toLowerCase()} could go</h3></div><div className="table-tools"><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a mandi" /></label><button className="sort-button" onClick={() => setSort(sort === "price" ? "distance" : "price")}><ArrowDownWideNarrow size={14} /> {sort === "price" ? "Best price" : "Nearest"}</button></div></div><div className="mandi-table-scroll"><table className="mandi-table"><thead><tr><th scope="col">MARKET</th><th scope="col">PRICE / Q</th><th scope="col">TRAVEL</th><th scope="col">EST. NET / Q</th><th scope="col">EST. TOTAL</th></tr></thead><tbody>{sortedMarkets.map((market, index) => { const transport = market.distance * 9; const net = market.price - transport; return <tr key={market.name} className={index === 0 ? "best-market-row" : ""}><td className="market-cell" data-label="Market"><div className="table-market-name"><span className="market-marker">{market.name[0]}</span><div><strong>{market.name}</strong><small>{market.district} district {index === 0 && <i>BEST ESTIMATE</i>}</small></div></div></td><td className="table-price" data-label="Price / quintal">₹{market.price.toLocaleString("en-IN")}</td><td data-label="Travel">{market.distance} km</td><td className="table-net" data-label="Est. net / q">₹{net.toLocaleString("en-IN")} <small className="transport-sub">−₹{transport} travel</small></td><td className="table-total" data-label="Est. total">₹{(net * quantity).toLocaleString("en-IN")}</td></tr> })}</tbody></table></div><SampleNotice>Market prices and transport cost estimates are demo values. Confirm current prices and actual costs locally.</SampleNotice></Card>
      <Card className="price-chart-card"><div className="module-card-heading"><div><span className="card-kicker">PRICE COMPARISON</span><h3>A quick look across markets</h3></div><span className="chart-legend"><i /> Price per quintal</span></div><div className="mandi-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: 6 }}><CartesianGrid stroke="#e9ede5" vertical={false} strokeDasharray="3 4" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#7d877b", fontSize: 11 }} dy={7} /><YAxis domain={[Math.min(...marketPrices.map((market) => market.price)) - 100, Math.max(...marketPrices.map((market) => market.price)) + 100]} tickLine={false} axisLine={false} tick={{ fill: "#929b8f", fontSize: 10 }} tickFormatter={(value) => `₹${value}`} /><Tooltip formatter={(value) => [`₹${value}`, "Price / quintal"]} contentStyle={{ border: "1px solid #e7ebe3", borderRadius: 12, fontSize: 12 }} /><Bar dataKey="mandi" fill="#4d8b52" radius={[5, 5, 0, 0]} maxBarSize={38} /></BarChart></ResponsiveContainer></div></Card>
    </div><aside className="module-aside mandi-aside"><Card className="recommendation-card"><span className="card-kicker">FARMLY’S SELLING RECOMMENDATION</span><div className="recommendation-medallion"><Store size={20} /></div><h3>{best.name} looks promising.</h3><p>At the sample price and estimated travel cost, it may offer the strongest net return from the markets shown.</p><div className="recommendation-stat"><span>Estimated net / quintal</span><strong>₹{(best.price - best.distance * 9).toLocaleString("en-IN")}</strong></div><div className="recommendation-stat"><span>Estimated total · {quantity} q</span><strong>₹{((best.price - best.distance * 9) * quantity).toLocaleString("en-IN")}</strong></div><SampleNotice>Estimate uses ₹9/km per quintal for demonstration only.</SampleNotice></Card><Card className="profit-card"><span className="card-kicker">YOUR PROFIT ESTIMATE</span><h3>Change the quantity to see your estimate.</h3><div className="quantity-control"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><strong>{quantity}<small> quintals</small></strong><button onClick={() => setQuantity(Math.min(500, quantity + 1))} aria-label="Increase quantity">+</button></div><p>Estimate based on {best.name} sample price, less illustrative transport costs.</p></Card></aside></div>
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
  return <div className="profile-layout"><div className="profile-main"><Card className="profile-card"><div className="profile-card-banner"><div className="profile-large-avatar">{form.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><span className="card-kicker">YOUR FARM PROFILE</span><h3>{form.name}</h3><span><MapPin size={13} /> {form.village}, {form.district}</span></div><span className="profile-data-badge"><ShieldCheck size={14} /> Saved in this browser</span></div><div className="profile-form-grid"><label>Farmer name<input value={form.name} onChange={(event) => set("name", event.target.value)} /></label><label>Village<input value={form.village} onChange={(event) => set("village", event.target.value)} /></label><label>District<input value={form.district} onChange={(event) => set("district", event.target.value)} /></label><label>State<select value={form.state} onChange={(event) => set("state", event.target.value)}>{["Jharkhand", "Bihar", "Odisha", "West Bengal", "Madhya Pradesh", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Preferred language<select value={form.language} onChange={(event) => set("language", event.target.value)}>{["English", "हिंदी", "తెలుగు", "मराठी", "தமிழ்", "ਪੰਜਾਬੀ"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Farm size<input type="number" min="0.1" step="0.1" value={form.acres} onChange={(event) => set("acres", event.target.value)} /><small>acres</small></label><label>Main crop<input value={form.crop} onChange={(event) => set("crop", event.target.value)} /></label><label>Soil type<select value={form.soil} onChange={(event) => set("soil", event.target.value)}>{["Clay loam", "Sandy loam", "Black soil", "Red soil", "Alluvial", "Not sure"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Irrigation access<select value={form.irrigation} onChange={(event) => set("irrigation", event.target.value)}>{["Rain-fed", "Canal", "Well / borewell", "Drip irrigation", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Farming experience<input value={form.experience} onChange={(event) => set("experience", event.target.value)} /></label></div><div className="profile-card-footer"><span><Info size={14} /> This demo saves profile details only to this browser.</span><button className="primary-action" onClick={() => onSave(form)}>Save farm profile <Check size={15} /></button></div></Card><Card className="profile-language-card"><div className="language-roundel">अ</div><div><span className="card-kicker">MADE FOR YOUR LANGUAGE</span><h3>Farm advice should sound familiar.</h3><p>Choose a preferred language above. Voice recognition is subject to your browser and device support.</p></div></Card></div><aside className="profile-aside"><Card className="profile-summary-card"><span className="card-kicker">YOUR FARM AT A GLANCE</span><div className="profile-summary-stat"><Sprout size={17} /><div><span>Main crop</span><strong>{form.crop}</strong></div></div><div className="profile-summary-stat"><MapPin size={17} /><div><span>Location</span><strong>{form.district}, {form.state}</strong></div></div><div className="profile-summary-stat"><Leaf size={17} /><div><span>Land area</span><strong>{form.acres} acres</strong></div></div><div className="profile-summary-stat"><DropletsIcon /><div><span>Irrigation</span><strong>{form.irrigation}</strong></div></div>{savedPlan && <div className="saved-plan-summary"><span className="card-kicker">SAVED CROP PLAN</span><strong>{savedPlan.crop} · {savedPlan.area} acres</strong><small>Illustrative budget · ₹{Math.round(savedPlan.total).toLocaleString("en-IN")}</small></div>}</Card><SampleNotice>Your farm profile is sample information and can be edited. No account or cloud storage is connected.</SampleNotice></aside></div>
}
