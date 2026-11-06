"use client"

import { ArrowRight, ArrowUpRight, CloudDrizzle, CloudRain, Droplets, Info, Leaf, MapPin, Mic2, MoreHorizontal, Sprout, Store, Sun, Wind } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useLocation } from "@/lib/location-context"
import { useWeather } from "@/lib/use-weather"
import { usePrices } from "@/lib/use-prices"
import type { FarmerProfile, Module } from "./farmly-app"

function MetricCard({ label, value, unit, icon: Icon, tone, footnote }: { label: string; value: string; unit?: string; icon: typeof Sun; tone: string; footnote: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={17} strokeWidth={1.8} /></div><span className="metric-label">{label}</span><div className="metric-value">{value}<small>{unit}</small></div><span className="metric-footnote">{footnote}</span></div>
}

function MiniForecast({ daily }: { daily?: any[] }) {
  const chartData = (daily && daily.length > 0)
    ? daily.map((d: any) => ({
        day: d.day ? d.day.slice(0, 3) : "",
        rain: d.pop_max ?? 0,
        temp: d.temp_max_c ?? 0,
      }))
    : []

  const highestRain = chartData.reduce(
    (max, item) => (item.rain > max.rain ? item : max),
    { day: "", rain: 0, temp: 0 }
  )

  return (
    <div className="mini-forecast">
      <div className="forecast-head">
        <div>
          <span className="card-kicker">NEXT 7 DAYS</span>
          <h3>{highestRain.rain >= 50 ? "Rain ahead this week" : "Coming week outlook"}</h3>
        </div>
        <span className="chart-legend"><i /> Rain chance</span>
      </div>
      <div className="chart-wrap">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4d8b52" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#4d8b52" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e9ede5" vertical={false} strokeDasharray="3 4" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#929b8f", fontSize: 11 }} dy={8} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#929b8f", fontSize: 10 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip contentStyle={{ border: "1px solid #e7ebe3", borderRadius: 12, fontSize: 12 }} formatter={(value) => [`${value}%`, "Rain chance"]} />
              <Area type="monotone" dataKey="rain" stroke="#4d8b52" strokeWidth={3} fill="url(#rainFill)" dot={{ r: 2.5, fill: "#4d8b52", strokeWidth: 0 }} activeDot={{ r: 4, fill: "#164b35", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#929b8f", fontSize: "13px" }}>
            Loading live forecast chart…
          </div>
        )}
      </div>
      <div className="chart-caption">
        {highestRain.day ? (
          <>
            <span><CloudRain size={14} /> Highest chance {highestRain.day}</span>
            <strong>{highestRain.rain}% <ArrowUpRight size={13} /></strong>
          </>
        ) : (
          <span>Live 7-day rain probability</span>
        )}
      </div>
    </div>
  )
}

export function DashboardScreen({ profile, onNavigate }: { profile: FarmerProfile; onNavigate: (module: Module) => void }) {
  const { data: wx } = useWeather()
  const { location } = useLocation()
  const { data: mandiData, loading: mandiLoading } = usePrices({ crop: profile.crop || "Paddy", quantity: 20 })

  const alert = wx?.alerts?.[0]
  const currentTemp = wx?.current?.temp_c !== undefined ? `${wx.current.temp_c}°` : "--"
  const feelsLike = wx?.current?.feels_like_c !== undefined ? `Feels like ${wx.current.feels_like_c}°` : "Live temperature"
  const rainChance = wx?.current?.rain_chance !== undefined ? `${wx.current.rain_chance}%` : "--"
  const rainFootnote = wx?.daily_7day?.[0]?.pop_max !== undefined ? `Today: ${wx.daily_7day[0].pop_max}% max` : "Live rain probability"
  const humidityVal = wx?.current?.humidity !== undefined ? `${wx.current.humidity}%` : "--"
  const humidityFootnote = wx?.current?.humidity !== undefined ? "Relative air humidity" : "Live humidity reading"

  const placeLabel = wx?.location?.name
    ? `${wx.location.name}, ${wx.location.state || location.state}`
    : location.label

  const formattedFetchedAt = wx?.fetched_at
    ? new Date(wx.fetched_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })
    : "Recently"

  return (
    <div className="dashboard-content">
      <section className="dashboard-top-grid">
        <div className="field-hero">
          <img src="/farmly-field.png" alt="Farmer standing in a green paddy field in Jharkhand" />
          <div className="field-overlay" />
          <div className="field-copy">
            <span className="field-caption"><span className="live-dot" /> YOUR FARM, THIS SEASON</span>
            <h2>Good things<br />are growing.</h2>
            <p suppressHydrationWarning>Your {profile.crop.toLowerCase()} crop ({profile.acres} acres in {placeLabel}). Check live weather and field conditions before operations.</p>
            <button className="field-link" onClick={() => onNavigate("planner")}>View crop plan <ArrowRight size={15} /></button>
          </div>
          <div className="field-location" suppressHydrationWarning><MapPin size={13} /> {placeLabel}</div>
          <div className="crop-stage-card" onClick={() => onNavigate("profile")} style={{ cursor: "pointer" }}>
            <div className="crop-stage-icon"><Sprout size={18} /></div>
            <div>
              <span>YOUR PROFILE · {profile.acres} ACRES</span>
              <strong>{profile.crop} <i>(Farmer input)</i></strong>
            </div>
            <ArrowRight size={15} />
          </div>
        </div>

        {alert ? (
          <aside className="rain-alert-card">
            <div className="alert-top">
              <div className="alert-icon"><CloudDrizzle size={20} /></div>
              <span className="alert-severity">
                <i /> {alert.severity === "action_needed" ? "ACTION NEEDED" : "WATCH"}
              </span>
            </div>
            <span className="card-kicker">WEATHER ADVISORY</span>
            <h3>{alert.title}</h3>
            <p>{alert.message}</p>
            <div className="rain-stat">
              <div>
                <strong>{alert.observed_value}<small>{alert.unit || "%"}</small></strong>
                <span>observed</span>
              </div>
              <div className="rain-stat-divider" />
              <div>
                <strong>{alert.window_hours || 36}<small>h</small></strong>
                <span>forecast window</span>
              </div>
            </div>
            <div className="alert-action">
              <span><span className="action-check">✓</span> Threshold: {alert.threshold}{alert.unit || "%"}</span>
              <button onClick={() => onNavigate("weather")} aria-label="View weather details"><ArrowRight size={16} /></button>
            </div>
            <small className="updated-time">
              {wx?.stale ? "Earlier cached data · " : "Live advisory · "}
              {formattedFetchedAt}
            </small>
          </aside>
        ) : (
          <aside className="rain-alert-card">
            <div className="alert-top">
              <div className="alert-icon"><Sun size={20} /></div>
              <span className="alert-severity" style={{ color: "#2d6a4f" }}>
                <i style={{ background: "#2d6a4f" }} /> ALL CLEAR
              </span>
            </div>
            <span className="card-kicker">WEATHER ADVISORY</span>
            <h3>No weather alerts right now</h3>
            <p>Favorable weather conditions for farm operations in {placeLabel}.</p>
            <div className="rain-stat">
              <div>
                <strong>{wx?.current?.rain_chance ?? 0}<small>%</small></strong>
                <span>rain chance</span>
              </div>
              <div className="rain-stat-divider" />
              <div>
                <strong>{wx?.current?.temp_c ?? 0}<small>°C</small></strong>
                <span>current temp</span>
              </div>
            </div>
            <div className="alert-action">
              <span><span className="action-check">✓</span> Conditions normal</span>
              <button onClick={() => onNavigate("weather")} aria-label="View weather details"><ArrowRight size={16} /></button>
            </div>
            <small className="updated-time">
              {wx?.stale ? "Earlier cached data · " : "Live conditions · "}
              {formattedFetchedAt}
            </small>
          </aside>
        )}
      </section>

      <section className="metric-grid" aria-label="Farm conditions">
        <MetricCard label="Temperature" value={currentTemp} unit="C" icon={Sun} tone="gold" footnote={feelsLike} />
        <MetricCard label="Rain probability" value={rainChance} icon={CloudRain} tone="blue" footnote={rainFootnote} />
        <MetricCard label="Humidity" value={humidityVal} icon={Droplets} tone="mint" footnote={humidityFootnote} />
        <MetricCard label="Farm size" value={profile.acres} unit="acres" icon={Leaf} tone="sage" footnote={`${profile.crop} · ${location.district}`} />
      </section>

      <section className="dashboard-middle-grid">
        <MiniForecast daily={wx?.daily_7day} />
        <div className="ask-card">
          <div className="ask-card-header">
            <div>
              <span className="card-kicker">FARMLY VOICE</span>
              <h3>Questions grow here.</h3>
              <p>Ask anything about your farm—in the language you love.</p>
            </div>
            <div className="ai-spark"><Leaf size={20} /></div>
          </div>
          <button className="voice-launch" onClick={() => onNavigate("voice")}>
            <span className="voice-launch-mic"><Mic2 size={20} /></span>
            <span><strong>Talk to Farmly AI</strong><small>English · हिंदी · తెలుగు · more</small></span>
            <ArrowRight size={17} />
          </button>
          <div className="prompt-label">A few things you could ask</div>
          <div className="prompt-chips">
            <button onClick={() => onNavigate("voice")}>Will it rain tomorrow?</button>
            <button onClick={() => onNavigate("voice")}>Help me plan paddy</button>
          </div>
          <span className="demo-note">Voice assistant connected to Farmly advisory</span>
        </div>
      </section>

      <section className="quick-section">
        <div className="section-title-row">
          <div><span className="card-kicker">YOUR NEXT STEP</span><h3>Good farming starts with a good question.</h3></div>
          <button className="text-action" onClick={() => onNavigate("planner")}>Explore all tools <ArrowRight size={14} /></button>
        </div>
        <div className="quick-grid">
          <button className="quick-card" onClick={() => onNavigate("planner")}><span className="quick-icon quick-green"><Sprout size={19} /></span><span className="quick-card-copy"><strong>Plan a new crop</strong><small>Inputs, costs & a growing timeline</small></span><ArrowRight className="quick-arrow" size={16} /></button>
          <button className="quick-card" onClick={() => onNavigate("schemes")}><span className="quick-icon quick-yellow"><Leaf size={19} /></span><span className="quick-card-copy"><strong>Find farm support</strong><small>Explore schemes that may fit</small></span><ArrowRight className="quick-arrow" size={16} /></button>
          <button className="quick-card" onClick={() => onNavigate("weather")}><span className="quick-icon quick-blue"><Droplets size={19} /></span><span className="quick-card-copy"><strong>Check weather forecast</strong><small>Live forecast for your district</small></span><ArrowRight className="quick-arrow" size={16} /></button>
          <button className="quick-card" onClick={() => onNavigate("mandi")}><span className="quick-icon quick-pink"><Store size={19} /></span><span className="quick-card-copy"><strong>Compare mandi prices</strong><small>Estimate your net returns</small></span><ArrowRight className="quick-arrow" size={16} /></button>
        </div>
      </section>

      <section className="bottom-insight-grid">
        <div className="market-preview">
          <div className="section-title-row compact">
            <div>
              <span className="card-kicker">MANDI INTELLIGENCE</span>
              <h3>Live Mandi Prices</h3>
            </div>
            <button className="icon-button" onClick={() => onNavigate("mandi")} aria-label="More mandi prices">
              <MoreHorizontal size={18} />
            </button>
          </div>
          {mandiData?.records && mandiData.records.length > 0 ? (
            <div className="preview-market-list" style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {mandiData.records.slice(0, 2).map((m, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: idx === 0 ? "1px solid #eef2ec" : undefined, paddingBottom: idx === 0 ? "8px" : undefined }}>
                  <div>
                    <strong style={{ display: "block", fontSize: "14px", color: "#164b35" }}>{m.market}</strong>
                    <small style={{ color: "#7a8577", fontSize: "11px" }}>
                      {m.district} district {m.distance_km !== null ? `· ${m.distance_km} km` : ""}
                    </small>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ display: "block", fontSize: "14px", color: "#2d6a4f" }}>
                      ₹{m.modal_price.toLocaleString("en-IN")}<small style={{ fontSize: "10px", fontWeight: "normal", color: "#7a8577" }}>/q</small>
                    </strong>
                    <small style={{ color: "#5a6854", fontSize: "11px" }}>
                      {m.est_net_per_q !== null ? `Net: ₹${m.est_net_per_q}/q` : m.arrival_date}
                    </small>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: "11px", color: "#7a8577", marginTop: "2px", display: "flex", justifyContent: "space-between" }}>
                <span>Crop: {profile.crop || "Paddy"}</span>
                <span>{mandiData.source.includes("Agmarknet") ? "Agmarknet Live" : "Live Feed"}</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 14px", textAlign: "center" }}>
              <Store size={32} style={{ margin: "0 auto 10px", color: "#4d8b52" }} />
              <p style={{ fontWeight: 600, fontSize: "15px", color: "#164b35", marginBottom: "6px" }}>
                Live mandi prices are on the Mandi screen
              </p>
              <p style={{ fontSize: "13px", color: "#5a6854", marginBottom: "16px", lineHeight: "1.4" }}>
                {mandiLoading
                  ? "Fetching latest Agmarknet quotes for your location…"
                  : `Live Agmarknet prices, distance calculations, and net return estimates are available for ${placeLabel} and nearby mandis.`}
              </p>
              <button className="primary-action" onClick={() => onNavigate("mandi")} style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: "0 auto" }}>
                Open Mandi Screen <ArrowRight size={14} />
              </button>
            </div>
          )}
          <button className="market-footer" onClick={() => onNavigate("mandi")}>
            Compare all nearby markets <ArrowRight size={14} />
          </button>
        </div>

        <div className="today-tip">
          <div className="tip-top">
            <span className="tip-icon"><Sun size={17} /></span>
            <span className="card-kicker">A LITTLE FIELD NOTE</span>
          </div>
          <h3>Weather-aware field advice</h3>
          <p>
            {wx?.current?.rain_chance !== undefined && wx.current.rain_chance > 40
              ? `Rain chance is ${wx.current.rain_chance}% in ${placeLabel}. Clear field drains and postpone sensitive foliar sprays.`
              : `Current rain chance is ${wx?.current?.rain_chance ?? 0}% in ${placeLabel}. Conditions are favorable for routine weeding and field maintenance.`}
          </p>
          <button onClick={() => onNavigate("weather")}>See full weather outlook <ArrowRight size={14} /></button>
          <div className="tip-decoration"><Wind size={50} strokeWidth={0.9} /></div>
        </div>
      </section>

      {/* Honest source line and stale notice */}
      {wx && (
        <div
          className="sample-notice"
          style={{
            marginTop: "16px",
            background: wx.stale ? "#fff9e6" : undefined,
            borderColor: wx.stale ? "#f0c36d" : undefined,
          }}
        >
          <Info size={15} />
          <span>
            Source: {wx.source || "OpenWeather / Open-Meteo"} · Fetched at {formattedFetchedAt}.
            {wx.stale ? " (Earlier cached data is being shown)" : " (Live weather data)"}
          </span>
        </div>
      )}
    </div>
  )
}
