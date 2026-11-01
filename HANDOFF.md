# Farmly.AI - Project Handoff Documentation

**Project**: Farmly.AI (Advisory App for Indian Farmers)  
**Hackathon Deadline**: 1 Nov 2026, 11:59 PM IST  
**Repo Root**: `forge-app`  
**Current Date**: 1 Nov 2026  

---

## 1. What Is Done

### Phase 1: Shared Location & Live Weather Intelligence
- **Single Source of Truth (`frontend/lib/location-context.tsx`)**: Reusable `LocationProvider` storing `{ state, district, label, lat, lon }`.
  - Hydration-safe initial state: SSR uses saved farmer profile props; `localStorage` reads run in `useEffect`.
  - Auto-synchronizes with farmer profile updates from `saveProfile()`.
- **Live Weather Screen (`frontend/components/farmly/screens.tsx`)**:
  - Connected to live backend `GET /api/weather?city={district}, {state}`.
  - Multi-source live data: OpenWeather (5-day / 3-hour slots) and Open-Meteo (7-day daily forecast and physical volumetric soil moisture).
  - Derived live rainfall advisories from real thresholds (precipitation probability $\ge 60\%$ or accumulation $\ge 15\text{ mm}$ in 36 hours).
  - Display times converted from numeric `timestamp` into viewer's local time.
  - All mock fixtures and hardcoded weather arrays completely removed.
- **Dependent Location Pickers (`frontend/components/farmly/location-select.tsx`)**:
  - Live backend endpoints `GET /api/locations/states` and `GET /api/locations/districts?state=...`.
  - Agmarknet live state feed with official Local Government Directory (LGD) reference fallback.
  - Replaced plain text inputs in `ProfileScreen` with searchable dropdowns.

### Phase 2: Live Mandi Intelligence (Mandi Screen & Dashboard Overview)
- **Backend Mandi Service (`backend/src/services/mandi_service.js` & `backend/src/routes/prices.js`)**:
  - Live endpoint: `GET /api/prices` powered strictly by data.gov.in Agmarknet daily feed (Resource `9ef84268-d588-465a-a308-a864a43d0070`).
  - **Commodity Mapping**: Verified against all 194 distinct commodities actively reported in today's live feed (`Paddy(Common)`, `Paddy(Fine/Superfine/Grade A)`, `Maize`, `Wheat`, `Mustard`, `Cotton`, `Soyabean`, etc.).
  - **Ambiguity & State Restriction**: Open-Meteo market geocoding strictly requires candidate `admin1` to match the market's state, preventing cross-state mismatches. Approximations (falling back to district/state center) are explicitly marked `uncertain: true`.
  - **Distance & Transport Net Calculation**: Computes haversine distance from farmer to market, applies backend default rate `TRANSPORT_RATE_PER_Q_KM` (₹8/q/km default, labeled as an assumed estimate in `transport_notice`), and computes net return per quintal and total return. Support optional override via query parameter.
  - **Fixed Bug (Parchur APMC Negative Net Bug)**:
    - Guaranteed: markets with negative estimated net return ($\text{price} - \text{transport} \le 0$) are **never** recommended.
    - Implemented `max_km` distance filter (default 100 km).
    - If no market qualifies with positive net return, `recommendation` returns `null` with a clear explanation (`recommendation_notice`).
  - **Price Trend (`GET /api/prices/trend`)**: Honestly returns `insufficient_data: true` when live feed contains single-date reporting without inventing trend lines.
  - **15-Minute Cache & Stale-While-Error**: Resilient against data.gov.in upstream 502/timeouts.
- **Frontend Live Mandi Hook (`frontend/lib/use-prices.ts`)**:
  - Subscribes to shared `LocationContext` and screen filter parameters (`crop`, `quantity`, `district`, `distance`, `transportRate`).
  - In-memory module cache prevents screen-flicker during navigation.
  - Ignores stale responses and provides manual `refetch`.
- **Mandi Screen (`frontend/components/farmly/screens.tsx`)**:
  - Replaced all mock markets (`Ranchi APMC 2350`, `Khunti 2280`), static price adjustments, and fixed ₹9/km rates with live backend data.
  - Live comparison table: Market, Price/Q, Arrival Date, Travel (with `uncertain` distance badge), Est. Net/Q, and Est. Total.
  - Live BarChart of modal prices and net returns for top markets.
  - Dynamic district filter populated from live reporting mandis in the state.
  - 4 clean filters evenly spaced in one row: Crop, Harvest quantity, District, Max travel distance (clumsy transport card removed).
  - Clears legacy `farmly-transport-rate` from `localStorage` on mount. Rate is provided directly by backend response (`transport_rate_applied`).
  - Handled loading (with first-request slow warning), error with Retry button, and empty states.
- **Dashboard Overview Mandi Preview (`frontend/components/farmly/overview.tsx`)**:
  - Connected to `usePrices` using shared location and profile crop.
  - Displays top live mandis or honest fallback card without static mock prices.

---

## 2. What Is In Progress & Left To Do

1. **Voice Screen Live Integration (`frontend/components/farmly/screens.tsx`)**:
   - Currently uses a static regex dictionary (`voiceResponses` in English, Hindi, Telugu).
   - Needs connection to the live backend AI Advisor agent (`POST /api/advice` via Groq `llama-3.3-70b-versatile`). Transcribe speech using browser `SpeechRecognition` and vocalize answer using `speechSynthesis`.
2. **Supabase Auth & Profile Persistence (`POST /api/auth/*` & `GET /api/profile`)**:
   - Backend routes already exist in `backend/src/routes/auth.js` and `backend/src/routes/profile.js`.
   - Frontend currently stores session and profile in `localStorage`.
3. **Hide Mock Screens per Hackathon Scope**:
   - `CropPlannerScreen`: Static 6-step plan and hardcoded cost dictionary; hide from navigation or redirect prompt to Voice Assistant.
   - `SchemesScreen`: Static 6 schemes without public API; hide from navigation.
   - `SoilScreen`: Static NPK chemistry bars should be hidden; keep physical soil moisture and soil temperature from Open-Meteo.

---

## 3. How to Run Both Servers

### Backend (Node.js 20 Express)
```powershell
cd forge-app/backend
npm run dev
```
- **Port**: `8000` (Health check: `http://localhost:8000/`)
- **Required Environment Variables in `backend/.env` (Names only, no secrets)**:
  - `PORT`
  - `TRANSPORT_RATE_PER_Q_KM`
  - `DATA_GOV_API_KEY`
  - `OPENWEATHER_API_KEY`
  - `GROQ_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`

### Frontend (Next.js 16 + React 19 + Turbopack)
```powershell
cd forge-app/frontend
pnpm run dev
```
- **Port**: `3000` (`http://localhost:3000/`)
- **Required Environment Variables in `frontend/.env.local`**:
  - `NEXT_PUBLIC_API_URL` (typically `http://localhost:8000`)

---

## 4. Known Issues & Upstream Quirks

1. **Agmarknet Live Reporting**:
   - Jharkhand mandis do not report every day to Agmarknet daily feed (Resource `9ef84268-d588-465a-a308-a864a43d0070`). When a state has 0 reporting mandis for a crop on a given day, the backend honestly returns `total_records: 0` and `records: []`. Never fall back to the 2006 archive resource as it violates the live data hackathon rule.
2. **Open-Meteo Geocoding**:
   - Searches with comma-separated inputs (e.g. `Ranchi, Jharkhand`) can return empty results in Open-Meteo's `/search` API. Clean the query to individual place names and filter results by `admin1 === stateName`.
3. **Agmarknet Single-Day Reporting**:
   - Agmarknet daily resource contains quotes for a single arrival date (today). Thus, `/api/prices/trend` legitimately returns `insufficient_data: true`. The UI honestly communicates this to the farmer rather than inventing a mock trend line.
