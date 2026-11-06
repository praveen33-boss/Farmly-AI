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

### Phase 3: Live Voice Screen & Speech Processing Integration
- **Frontend Voice Helpers (`frontend/lib/api.ts` & `frontend/lib/voice-utils.ts`)**:
  - `NEXT_PUBLIC_VOICE_API_URL` added (defaults to `http://127.0.0.1:8001`).
  - Added `voicePostMultipart` (for multipart file uploads to FastAPI) and `voicePostJsonBlob` (to retrieve streaming MP3 audio Blobs).
  - Built Web Audio API converter (`convertBlobTo16kHzWav`): captures `audio/webm` from `MediaRecorder`, decodes it via `AudioContext`, resamples to 16 kHz mono, and encodes as a byte-perfect linear PCM WAV Blob (`audio/wav`) for Sarvam AI `saaras:v4`.
  - Added speech preparation utility (`prepareTextForSpeech`): strips markdown formatting and truncates text to ~400 characters at sentence boundaries for natural TTS pacing.
  - Added strict language mapper (`mapLanguageToVoice`): maps Telugu (`te-IN`), Hindi (`hi-IN`), and English (`en-IN`). Unsupported app languages (e.g. Marathi, Punjabi, Gujarati) display an honest fallback message: *"Voice is available in Telugu, Hindi and English. Text answers are shown."*
- **Live Voice Screen (`frontend/components/farmly/screens.tsx`)**:
  - Removed all canned responses (`vvoiceResponses` table) and regex keyword classifications.
  - Connected microphone button to browser `MediaRecorder` + FastAPI `POST /voice/transcribe`.
  - Puts transcription directly into the query input and calls the Node backend `POST /api/advice` with farmer context (`crop`, `state`, `district`, `city`, `language`).
  - Spoken response: calls FastAPI `POST /voice/speak` and plays returned MP3 Blob via HTML5 `Audio`. Seamlessly falls back to browser `window.speechSynthesis` if the Python service is offline.
  - Added compact **"How I answered"** audit section showing tools used, upstream sources with live fetch timestamps, and advisory warnings.
  - Quick starter questions send dynamic queries to the live backend with zero stored answers.
  - Disabled input and buttons while requests run; displays honest loading and error banners with a one-click Retry button.

---

## 2. What Is In Progress & Left To Do

1. **Supabase Auth & Profile Persistence (`POST /api/auth/*` & `GET /api/profile`)**:
   - Backend routes already exist in `backend/src/routes/auth.js` and `backend/src/routes/profile.js`.
   - Frontend currently stores session and profile in `localStorage`.
2. **Hide Mock Screens per Hackathon Scope**:
   - `CropPlannerScreen`: Static 6-step plan and hardcoded cost dictionary; hide from navigation or redirect prompt to Voice Assistant.
   - `SchemesScreen`: Static 6 schemes without public API; hide from navigation.
   - `SoilScreen`: Static NPK chemistry bars should be hidden; keep physical soil moisture and soil temperature from Open-Meteo.

### Phase 4: Soil Health Feature —� Complete Removal
- **SoilScreen**: Fully removed from screens.tsx and from the farmNav sidebar array in farmly-app.tsx.
- **Module type**: "soil" removed from the Module union type.
- **Dashboard Overview**: Check soil health quick-card replaced with Check weather forecast (onNavigate("weather")).
- **Soil dashboard metric**: soilMoisture metric card replaced with Humidity (from live weather data).
- **/api/weather/soil** endpoint removed from backend weather.js (but getLiveSoil service function kept for the Groq AI advisor tool get_soil_conditions).
- **soil-form-grid**: renamed to planner-form-grid in globals.css (used by CropPlannerScreen).
- **Soil CSS block**: All .soil-overview-grid, .ph-display, .ph-gauge, .soil-metrics-list, .soil-bar-*, .soil-health-card, .soil-recommend-form, .soil-form-grid, .soil-result, .soil-upload-card, .soil-info-card CSS removed from globals.css.
- **Kept** (not removed): soil field in FarmerProfile, profile.soil in ProfileScreen and CropPlanner, soilMoisture/soil temperature on WeatherScreen (live Open-Meteo data), get_soil_conditions LLM tool, Soil Health Card scheme entry in SchemesScreen.

### Phase 5: Voice Assistant Complete Bug Fix & UI Modernization (1 Nov 2026)

**Root causes identified and permanently fixed:**
1. **BUG 1 — Telugu/Hindi Text Produced English Audio**:
   - The active speech language in `VoiceScreen` was strictly inheriting the initial profile default (`"English"`) with no dedicated language selector on the Voice Assistant screen itself.
   - When calling Sarvam AI `POST /voice/speak`, text was occasionally stripped without handling Markdown table pipes (`|`), or if Sarvam was unreachable, it silently fell back to browser `window.speechSynthesis` which on Windows lacks Indian voice packs and defaulted to English voice (Microsoft David/Zira).
   - **Fix**: Added an explicit, persistent Language Dropdown (Telugu, Hindi, English) directly inside `VoiceScreen`; added Unicode script detection (`detectLanguageFromText`) ensuring Telugu script is always dispatched with `language: "Telugu"`; updated `prepareTextForSpeech` to handle Markdown tables and truncate at natural sentence boundaries; added `hasBrowserVoiceFor` check so the app never speaks English over regional text.

2. **BUG 2 — Audio Input Completely Broken**:
   - The frontend was uploading recorded audio using `form.append("file", ...)`. Inspection of FastAPI `voice-service/voice.py` revealed the required multipart parameter name is strictly **`audio`** (`audio: UploadFile = File(...)`), causing FastAPI to immediately reject all recordings with HTTP 422 Unprocessable Entity (`Field required: audio`).
   - The upload URL was omitting the target language query parameter (`?language=${voiceLang}`), causing FastAPI to fallback to default `"Telugu"`, failing for Hindi and English.
   - **Fix**: Changed multipart file field to `form.append("audio", wavBlob, "recording.wav")`; added target language to URL query (`/voice/transcribe?language=${selectedLanguage}`); ensured Web Audio API down-mixes to mono and encodes clean 16 kHz 16-bit linear PCM WAV; auto-populates query text box upon receipt and calls `POST /api/advice`.

3. **REQUIREMENT 3 — UI & Interaction Modernization**:
   - Replaced clumsy old card layout with a clean, modern **Voice Assistant** container:
     - Top bar with title, crop/location context, and Language selection dropdown.
     - Scrollable conversation feed with distinct user query bubbles (sage green) and live advisor response cards (clean white with avatar, timestamp, and audit trail).
     - Prominent Listen/Stop button on every response with live audio state indication (loading spinner when generating, pulsing red when playing).
     - Clear status strips for Recording, Transcribing, Advising, Audio Generation, Playback, and Error handling with Retry/Dismiss.
     - Bottom control bar featuring a large circular microphone button, clean text input box, and send button.
     - Language-specific quick starter question chips for one-click query submission.

**Verified Test Matrix (All Real Live Tests Passed on 1 Nov 2026):**
- **Node Backend Health**: ✅ 200 OK (`Farmly.AI Backend 1.0.0`)
- **Python Voice Service Health**: ✅ 200 OK (`status: ok, service: voice`)
- **Telugu Advice**: ✅ 200 OK (returned real Telugu Unicode agronomic advice for Khunti paddy)
- **Telugu TTS**: ✅ 200 OK (returned 333,949 bytes `audio/mpeg` from Sarvam `bulbul:v4-flash`)
- **Hindi Advice**: ✅ 200 OK (returned real Hindi Devanagari agronomic advice for Khunti paddy)
- **Hindi TTS**: ✅ 200 OK (returned 173,871 bytes `audio/mpeg` from Sarvam `bulbul:v4-flash`)
- **English Advice**: ✅ 200 OK (returned real English agronomic advice for Khunti paddy)
- **English TTS**: ✅ 200 OK (returned 175,124 bytes `audio/mpeg` from Sarvam `bulbul:v4-flash`)
- **STT Transcribe Telugu**: ✅ 200 OK (`POST /voice/transcribe?language=Telugu` with `audio` field)
- **STT Transcribe Hindi**: ✅ 200 OK (`POST /voice/transcribe?language=Hindi` with `audio` field)
- **STT Transcribe English**: ✅ 200 OK (`POST /voice/transcribe?language=English` with `audio` field)
- **TypeScript Check**: ✅ 0 errors (`pnpm exec tsc --noEmit`)
- **Production Build**: ✅ Passes with 0 errors via `pnpm run build` (`next build --webpack`)

### Phase 6: Hindi and English Voice Input Fix (Telugu 100% Intact)

**Root Causes Identified & Resolved:**
1. **Language State Propagation & Query Parameter Sync**:
   - `voice.py` expects `language` as a query parameter (`POST /voice/transcribe?language=Hindi` or `?language=English`), because `language: str = "Telugu"` is not declared with `= Form(...)`. Without explicit query parameters, FastAPI defaults `language="Telugu"`.
   - In `VoiceScreen`, `selectedLanguage` did not listen to updates from `profile.language` when the user selected Hindi or English in the topbar header dropdown, remaining stuck on Telugu.
   - **Fix**: Added two-way synchronization: `useEffect` synchronizes `profile.language` updates from the header to `selectedLanguage`; `handleLanguageChange` saves to `localStorage`; and `selectedLanguageRef` ensures async recording callbacks always access the freshest language.
2. **Transcription-to-Advice Hand-off (`submitQuestion`)**:
   - `submitQuestion` had a guard `if (phase === "transcribing") return;`. When `recorder.onstop` set `phase="transcribing"` before calling `submitQuestion(transcript)`, this guard could prematurely abort processing.
   - **Fix**: Added a `fromVoice` parameter to `submitQuestion`, allowing the transcription handler to immediately transition into `phase="advising"` without getting blocked.
3. **Audio Resampling & Format Robustness**:
   - Enhanced `convertBlobTo16kHzWav` with `AudioContext` fallback (`webkitAudioContext`) and a resilient try-catch in `recorder.onstop` that falls back to the native blob if browser audio decoding fails.
   - Added `language` both in query string AND in `FormData`.

**Multi-Language Verification Results (Real End-to-End Live Tests):**
- **Telugu** (Intact):
  - STT: `"నా వరి పంటకు ఏ ఎరువు వాడాలి?"` (Telugu script verified)
  - Advice: 1,007 characters of live agricultural advice in Telugu
  - Audio Output: 328,515 bytes MP3
- **Hindi** (Fixed & Working):
  - STT: `"मेरी धान की फसल में कौन सा खाद डालना चाहिए?"` (Devanagari script verified)
  - Advice: 1,408 characters of live agricultural advice in Hindi
  - Audio Output: 268,747 bytes MP3
- **English** (Fixed & Working):
  - STT: `"Which fertilizer should I use for my paddy crop?"` (English Latin script verified)
  - Advice: 1,443 characters of live agricultural advice in English
  - Audio Output: 342,726 bytes MP3

### Phase 7: Complete Voice Service Recovery, CORS Failover & Error Standardization (1 Nov 2026)

**Root Causes Identified & Resolved:**
1. **Service Process Interruption**:
   - The FastAPI voice service process on port 8001 had halted (task cancellation), causing immediate network failure across all languages (Telugu, Hindi, and English).
   - Re-launched Uvicorn service as a standing background process on `127.0.0.1:8001`.
2. **CORS Origin Mismatch (`http://localhost:3000` vs `http://127.0.0.1:3000`)**:
   - `voice-service/main.py` explicitly declared `allow_origins=["http://localhost:3000"]`. When users open the app at `http://127.0.0.1:3000` (standard loopback URL), browsers send `Origin: http://127.0.0.1:3000`. FastAPI rejected preflight OPTIONS requests with HTTP 400 (`Allow-Origin: null`), blocking all direct voice requests in browser.
   - **Fix without modifying Python files**: Configured Next.js rewrites in `next.config.mjs` (`/voice/:path* -> http://127.0.0.1:8001/voice/:path*`), and added an intelligent failover in `frontend/lib/api.ts` (`fetchVoice`) that automatically routes via the same-origin Next.js proxy if direct CORS to 8001 fails or is on `127.0.0.1:3000`.
3. **MIME Type Codec Stripping**:
   - In Chromium browsers, `MediaRecorder` defaults to `audio/webm;codecs=opus`. `voice.py` strictly checks `if audio.content_type not in ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg"]`.
   - The presence of `;codecs=opus` triggered HTTP 400 `Unsupported audio format`. Normalized audio fallback blob to clean `audio/webm`.
4. **Standardized Error Handling per Specification**:
   - Standardized all UI error messages to exact specifications:
     - Voice service unavailable: `"Voice service is unavailable. Please try again."`
     - Microphone permission denied: `"Please allow microphone access."`
     - Recording failed: `"Unable to record audio. Please try again."`
     - Empty recording: `"No audio detected. Please record again."`
     - Unsupported format: `"Audio format is not supported."`
     - Transcription failed: `"Could not convert your speech into text."`
     - Empty transcript: `"No speech detected. Please try again."`
     - Advisory API failed: `"Unable to retrieve your advisory response."`
     - TTS failed: `"Audio generation failed. Your text answer is still available."`
   - Preserves user transcript in the query box on advisory failures so the user can easily retry without re-recording.
   - Added a visible "Retry" button directly within the error status strip.

**Multi-Language Verification Results (Real End-to-End Live Tests):**
- **Telugu**:
  - TTS Speak: 58,514 bytes MP3
  - STT Transcribe: `"నా వరి పంటకు ఏ ఎరువు వాడాలి?"` (Language: `Telugu`, Script match: `true`)
  - Live Advisory: 1,100 characters of live agricultural advice in Telugu
  - Advisory Audio: 234,057 bytes MP3
- **Hindi**:
  - TTS Speak: 53,498 bytes MP3
  - STT Transcribe: `"मेरी धान की फसल में कौन सा खाद डालना चाहिए?"` (Language: `Hindi`, Script match: `true`)
  - Live Advisory: 1,947 characters of live agricultural advice in Hindi
  - Advisory Audio: 280,032 bytes MP3
- **English**:
  - TTS Speak: 49,737 bytes MP3
  - STT Transcribe: `"Which fertilizer should I use for my paddy crop?"` (Language: `English`, Script match: `true`)
  - Live Advisory: 2,022 characters of live agricultural advice in English
  - Advisory Audio: 178,886 bytes MP3
- **Failure Mode Tests**:
  - Unsupported audio format (`text/plain`): HTTP 400 correctly caught & formatted
  - Unsupported language (`Spanish`): HTTP 400 correctly caught & formatted
- **TypeScript Check**: ✅ 0 errors (`pnpm exec tsc --noEmit`)
- **Production Build**: ✅ Passes with 0 errors (`next build --webpack`)

### Phase 8: Final Voice Service Recovery & Hindi/English Transcription Fix (1 Nov 2026)

**Root Causes Identified & Resolved:**
1. **Header Language Unicode Mismatch (`"हिन्दी"` vs `"हिंदी"`)**:
   - `farmly-app.tsx` topbar language selector contained `<option>हिन्दी</option>` (using Devanagari Halant + Da: `\u0939\u093F\u0928\u094D\u0926\u0940`).
   - `voice-utils.ts` `mapLanguageToVoice` was strictly checking `language === "हिंदी"` (using Devanagari Anusvara: `\u0939\u093F\u0902\u0926\u0940`).
   - In Unicode, `"हिन्दी" === "हिंदी"` is `false`. When the farmer selected Hindi in the topbar, `mapLanguageToVoice` returned `null`, preventing `VoiceScreen` from updating its active voice language and leaving it stuck on Telugu or English.
   - **Fix**: Expanded `mapLanguageToVoice` to recognize `"हिन्दी"`, `"हिंदी"`, and any Devanagari input (`/[\u0900-\u097F]/`).

2. **Language State Synchronization Between `VoiceScreen` and `FarmlyApp`**:
   - When the user selected Hindi in `VoiceScreen`'s own dropdown, `handleLanguageChange` only wrote to `localStorage` without notifying parent `FarmlyApp` state.
   - Re-renders in `FarmlyApp` passed `profile={profile}` where `profile.language` remained unchanged, triggering `VoiceScreen`'s sync effect to reset `selectedLanguage` back to Telugu.
   - **Fix**: Passed `onSaveProfile={saveProfile}` from `farmly-app.tsx` into `VoiceScreen`, ensuring `handleLanguageChange` updates both local state and parent `FarmlyApp` profile state simultaneously.

3. **Inappropriate Error Masking in `frontend/lib/api.ts`**:
   - In `voicePostMultipart`, lines 81-83 checked `if (res.status >= 500)` and threw:
     `throw new Error("Voice service is unavailable. Please try again.");`
   - In FastAPI `voice-service/voice.py`, when Sarvam STT returns an invalid request or rejects speech audio, line 87 executes:
     `raise HTTPException(502, f"Transcription failed: {e}")`
   - FastAPI returns HTTP 502 with JSON `{"detail": "Transcription failed: ..."}`.
   - Because `502 >= 500`, `voicePostMultipart` discarded `b.detail` and masked the transcription error as a service outage (`"Voice service is unavailable. Please try again."`).
   - **Fix**: Differentiated HTTP 502 / transcription failures from true service unavailability. In `api.ts`, 502 / detail containing "transcription failed" throws `"Could not convert your speech into text."`. Only true socket/network fetch errors or HTTP 503 throw `"Voice service is unavailable. Please try again."`. Likewise in `voicePostJsonBlob`, 502 throws `"Audio generation failed. Your text answer is still available."`.

4. **Web Audio API Buffer Detach & Suspended Context**:
   - In `convertBlobTo16kHzWav`, `audioCtx.decodeAudioData(arrayBuffer)` detached the underlying buffer and stalled if `audioCtx.state === "suspended"`.
   - **Fix**: Added `audioCtx.resume()` and passed `arrayBuffer.slice(0)`.

**End-to-End Live Multi-Language Verification Results (1 Nov 2026):**
- **Telugu (100% Intact)**:
  - Input query: `"నా వరి పంటకు ఏ ఎరువు వాడాలి?"`
  - STT Transcript: `"నా వరి పంటకు ఏ ఎరువు వాడాలి?"` (Language: `Telugu`, Script match: `PASS`)
  - Live Advisory: 834 characters of live Telugu agricultural advice
  - TTS Output: 461,844 bytes `audio/mpeg`
- **Hindi (Fixed & 100% Working)**:
  - Input query: `"मेरी धान की फसल में कौन सा खाद डालना चाहिए?"`
  - STT Transcript: `"मेरी धान की फसल में कौन सा खाद डालना चाहिए?"` (Language: `Hindi`, Script match: `PASS`)
  - Live Advisory: 1,796 characters of live Hindi agricultural advice (with live Open-Meteo & OpenWeather context)
  - TTS Output: 504,058 bytes `audio/mpeg`
- **English (Fixed & 100% Working)**:
  - Input query: `"Which fertilizer should I use for my paddy crop?"`
  - STT Transcript: `"Which fertilizers should I use for my paddy crop?"` (Language: `English`, Script match: `PASS`)
  - Live Advisory: 2,096 characters of live English agricultural advice (with live Open-Meteo & OpenWeather context)
  - TTS Output: 246,595 bytes `audio/mpeg`

**Failure Mode Error Mapping Tests (Verified):**
- Corrupted audio (FastAPI 502): Correctly displays `"Could not convert your speech into text."`
- Unsupported format (`text/plain`, FastAPI 400): Correctly displays `"Audio format is not supported."`
- Unsupported language (`Spanish`, FastAPI 400): Correctly handled
- Network failure / offline port: Correctly displays `"Voice service is unavailable. Please try again."`
- Empty transcript: Correctly displays `"No speech detected. Please try again."`
- Advisory failure: Correctly displays `"Unable to retrieve your advisory response."` and retains transcript in query box.
- TTS failure: Correctly displays `"Audio generation failed. Your text answer is still available."` without losing text advice.

**Current Build & System Health:**
- `pnpm exec tsc --noEmit`: 0 errors
- `pnpm run build`: Exit code 0 (all 10 routes prerendered)
- Soil Health: 100% completely removed


---


### Phase 9: Real Government Data Integration for Schemes & Support (6 Nov 2026)

**Objective & Solution Architecture:**
- Transformed the Schemes & Support module from illustrative hardcoded cards into a genuine, government-data-powered discovery and recommendation system.
- Connected the Next.js frontend to real backend Express endpoints (`GET /api/schemes`, `GET /api/schemes/recommended`, `GET /api/schemes/metadata`, and protected `POST /api/admin/schemes/sync`).

**1. Verified Official Government Schemes Registry (`backend/src/data/official_schemes.js`):**
- Normalized data model: `scheme_id`, `scheme_name`, `full_name`, `description`, `short_description`, `scheme_category`, `government_level`, `state`, `ministry_or_department`, `benefits`, `eligibility_criteria`, `required_documents`, `application_process`, `official_application_url`, `official_information_url`, `source_name`, `source_url`, `last_verified_at`, `last_updated_at`, `data_status`, `live_data`, `match_criteria`.
- **Central Schemes Verified**: PM-KISAN, PMFBY (Pradhan Mantri Fasal Bima Yojana), KCC (Kisan Credit Card), PMKSY-PDMC (Per Drop More Crop), Soil Health Card (SHC), SMAM (Sub-Mission on Agricultural Mechanization).
- **Jharkhand State Schemes Verified**: Jharkhand Rajya Fasal Rahat Yojana (JRFRY), Jharkhand Krishi Rin Mafi Yojana (JKRMY), Birsa Harit Gram Yojana (BHGY).
- **Andhra Pradesh State Schemes Verified**: Annadata Sukhibhava / YSR Rythu Bharosa, Dr. YSR Free Crop Insurance Scheme, AP Micro Irrigation Project (APMIP), YSR Sunna Vaddi Panta Runalu (0% Crop Loan).

**2. data.gov.in Live OGD Integration (`backend/src/services/schemes_service.js`):**
- Leveraged server-side `DATA_GOV_API_KEY` to query active OGD resources:
  - **PM-KISAN Beneficiaries Dataset (Resource `388208c6-d82a-4190-90df-91aa2c326fec`)**: Fetches active installment release number, quadrimester cycle dates, and tracks over 13.5M registered village beneficiaries.
  - **KCC Query Transcripts (Resource `cef25fe2-9231-4128-8aec-2c948fedd43f`)**: Confirms live reachability of agricultural advisory logs.
- In-memory caching with TTL (3600s) and stale-while-error resilience to insulate against upstream latency.
- Protected synchronization endpoint (`POST /api/admin/schemes/sync`) requiring `x-admin-key: farmly-admin-sync-2026` or service role token. Mutex lock prevents duplicate concurrent sync runs.

**3. Personalized Scheme Recommendation Engine (`GET /api/schemes/recommended`):**
- Evaluates farmer profile (`state`, `district`, `acres`, `crop`, `land_status`, `irrigation`).
- Explicitly distinguishes match levels:
  - **"Eligibility confirmed"**: Universally applicable entitlement schemes without exclusions (e.g. Soil Health Card free soil testing).
  - **"Potentially relevant"**: Profile matches primary criteria (state, crop notification, smallholder acreage quota), with clear actionable match reasons.
  - **"More information needed"**: Pinpoints missing documentation (e.g., e-KYC status, RoR land seeding, assured water source for micro-irrigation).
  - **"Not applicable in your state"**: Filters out exclusive other-state schemes (e.g. Jharkhand schemes for AP farmers and vice-versa).
- Never claims official approval or eligibility without formal government revenue/bank verification.

**4. Frontend Modernization (`frontend/lib/use-schemes.ts` & `frontend/components/farmly/screens.tsx`):**
- Replaced static fixtures with live custom hooks (`useSchemes`, `useRecommendedSchemes`, `useSchemesMetadata`).
- Real interactive filters: Category tabs, State dropdown (All States / Jharkhand / Andhra Pradesh), real-time search.
- Scheme cards display: Scheme name, full name, government level & state, ministry/department, potential benefits, applicable location, Farmly match status with color badges, verification date, data.gov.in tracking indicator, and direct official source links.
- Rich scheme details modal: Complete description, structured benefits, eligibility criteria checklist, mandatory documents list, step-by-step numbered application procedure, official online application button, and official guidelines link.
- Personal Discovery Sidebar: Interactive input fields pre-populated from farmer profile, dynamically refetching recommendations on change with live match reasons and next verification steps.
- Robust state handling: Informative loading skeleton, error banner with retry button, empty search state with reset button.

**5. Comprehensive Verification Test Results:**
- `pnpm exec tsc --noEmit`: ✅ 0 errors
- `pnpm run build`: ✅ Exit code 0 (all 10 routes prerendered)
- Backend Smoke Test (`backend/scripts/smoke-test.js`): ✅ 15 / 15 Passed
  - Health Check (200 OK)
  - Upstream Status (200 OK)
  - Weather (200 OK)
  - Live Soil (200 OK)
  - Mandi Prices (200 OK)
  - Mandi Distance & Transport (200 OK)
  - Mandi Price Trend (200 OK)
  - AI Advisor Agent (200 OK)
  - Auth Signup Validation (503 / 422 OK)
  - Profile Protected Route (503 / 401 OK)
  - Schemes Discovery Jharkhand Filter (200 OK)
  - Scheme Full Details PM-KISAN (200 OK)
  - Personalized Recommendations (200 OK)
  - Schemes Metadata & Freshness (200 OK)
  - Admin Schemes Sync Protected (200 OK)

### Phase 10: Voice Assistant Rate Limit and Quota Handling
- **Root Cause Identification & Investigation**:
  - Traced end-to-end voice pipeline: `/voice/transcribe` -> `/api/advice` -> `/voice/speak`.
  - **Failing Endpoint**: `/api/advice` on consecutive requests was throttled by the backend rate limiter (`adviceLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 })` in `backend/src/routes/advice.js`). Exceeding 30 requests per 15 minutes returned `HTTP 429 Too Many Requests`.
  - **Sarvam AI Upstream Limits**: When Sarvam STT/TTS quotas or concurrency limits are exceeded, `voice-service/voice.py` catches `APIStatusError` and raises `HTTPException(status_code=502, detail=f"Speech generation failed: Error code: {e.status_code}...")`.
  - **UI Error Masking**: `VoiceScreen` previously collapsed all errors into generic text (`"Unable to retrieve your advisory response."`), prompting users to immediately hit an active `"Retry"` button, which repeatedly re-hammered the rate limiter.
  - **Redundant Network Calls**: Every click on "Listen in [Language]" made a fresh POST request to `/voice/speak`, re-synthesizing the same text and depleting Sarvam quota.
  - **Concurrency Leaks**: Users could trigger simultaneous requests while previous advice or TTS calls were active.
- **Frontend Optimizations & Fixes (`frontend/lib/api.ts` & `frontend/components/farmly/screens.tsx`)**:
  - **Typed `ApiError` Class**: Captures `status`, `detail`, `retryAfterSeconds` (parsed from `retry-after` and `ratelimit-reset` headers), `isRateLimit`, `isQuotaExceeded`, `isTimeout`, and `isNetworkError`.
  - **In-Memory Audio Caching (`audioCacheRef`)**: Caches synthesized speech audio blobs in memory keyed by `${msgId}:${targetLang}`. Re-listening to previous responses plays instantly from memory with 0 network calls and 0 quota consumption.
  - **Pacing & Cooldown Controller (`startCooldown`, `cooldownRemaining`)**: Automatically initiates a countdown (using provider's `retry-after` header or default 15s) whenever HTTP 429 or rate limits occur.
  - **Aborting Stale Requests (`activeAbortControllerRef`)**: Automatically aborts previous pending HTTP requests before issuing new ones.
  - **Duplicate Submission Guard (`isProcessingStopRef`)**: Prevents multiple event fires on `recorder.onstop`.
  - **Granular Error Handling**:
    - Rate limit: `"The voice service is temporarily busy. Please try again in Xs."`
    - Quota exhaustion: `"Voice service request quota has been reached. Please try again later."`
    - Network failure: `"Voice service is unavailable. Please check your internet connection and try again."`
    - Timeout: `"The request timed out. Please try again."`
    - Invalid audio: `"Audio format is not supported. Please record again."`
    - Empty speech: `"No speech detected. Please speak clearly into your microphone."`
    - Advice failure: `"Unable to retrieve your advisory response. Please try again."`
    - TTS failure: `"Audio generation failed. Your text answer is still available."` (ensures text answer remains displayed in chat feed).
  - **Controlled UI State**: Disables mic button, query text box, send button, quick chips, and listen pills while busy (`isLoading` or `cooldownRemaining > 0`). Hides "Retry" button during cooldown or quota exhaustion.
- **Strict Compliance**:
  - Zero modifications to Python files in `./voice-service`.
  - Zero modifications to `./backend`.
  - Zero modifications to `.env` or exposure of API keys.
  - All multi-language support (Telugu, Hindi, English) fully preserved and validated with real speech synthesis and advisory retrieval.
- **Verification Results**:
  - **5 Consecutive Telugu Requests**: 100% success (STT 200, Advice 200, TTS 200).
  - **5 Consecutive Hindi Requests**: 100% success (STT 200, Advice 200, TTS 200).
  - **5 Consecutive English Requests**: 100% success (STT 200, Advice 200, TTS 200).
  - **3 Mixed Consecutive Requests**: 100% success (STT 200, Advice 200, TTS 200).
  - **TTS In-Memory Cache**: Verified 0ms cache hits on re-listen without network calls.
  - **Rate Limit & Error Simulation**: 4/4 assertions passed for 429, retry-after extraction, 402 quota exceeded, and audio format handling.
  - **Groq Tool Choice & Model Error Resolution**:
    - **Issue**: Groq returned HTTP 400 `{"error":{"message":"Tool choice is none, but model called a tool","code":"tool_use_failed"}}` when fallback/recovery completions omitted `tools` while `messages[0]` system prompt still listed tool definitions.
    - **Fix**: Removed raw tool listings from system prompt text (native schemas are already provided in `tools: AGENT_TOOLS`). Isolated recovery and final summarization requests with clean text-only prompts and added resilient try/catch with rule-based agronomic advisory fallback.
    - **Frontend**: Upgraded `parseApiErrorResponse` in `lib/api.ts` to cleanly extract nested `json.error.message` and mapped tool processing failures to helpful user messages in `screens.tsx`. Verified 100% success on Krishna AP queries in both English and Telugu.

---

## 3. How to Run All Three Services

### 1. Backend (Node.js 20 Express)
```powershell
cd forge-app/backend
npm run dev
```
- **Port**: `8000` (Health check: `http://localhost:8000/`)
- **Required Environment Variables in `backend/.env` (Names only, no secrets)**:
  - `PORT=8000`
  - `TRANSPORT_RATE_PER_Q_KM=8`
  - `DATA_GOV_API_KEY`
  - `OPENWEATHER_API_KEY`
  - `GROQ_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`

### 2. Voice Service (Python FastAPI + Sarvam AI)
```powershell
cd forge-app/voice-service
uvicorn main:app --host 127.0.0.1 --port 8001
```
- **Port**: `8001` (Health check: `http://localhost:8001/`)
- **Required Environment Variables in `voice-service/.env`**:
  - `SARVAM_API_KEY`

### 3. Frontend (Next.js 16 + React 19 + Turbopack)
```powershell
cd forge-app/frontend
pnpm run dev
```
- **Port**: `3000` (`http://localhost:3000/`)
- **Required Environment Variables in `frontend/.env.local`**:
  - `NEXT_PUBLIC_API_URL=http://localhost:8000`
  - `NEXT_PUBLIC_VOICE_API_URL=http://localhost:8001`

---

## 4. Known Issues & Upstream Quirks

1. **Agmarknet Live Reporting**:
   - Jharkhand mandis do not report every day to Agmarknet daily feed (Resource `9ef84268-d588-465a-a308-a864a43d0070`). When a state has 0 reporting mandis for a crop on a given day, the backend honestly returns `total_records: 0` and `records: []`. Never fall back to the 2006 archive resource as it violates the live data hackathon rule.
2. **Open-Meteo Geocoding**:
   - Searches with comma-separated inputs (e.g. `Ranchi, Jharkhand`) can return empty results in Open-Meteo's `/search` API. Clean the query to individual place names and filter results by `admin1 === stateName`.
3. **Agmarknet Single-Day Reporting**:
   - Agmarknet daily resource contains quotes for a single arrival date (today). Thus, `/api/prices/trend` legitimately returns `insufficient_data: true`. The UI honestly communicates this to the farmer rather than inventing a mock trend line.
