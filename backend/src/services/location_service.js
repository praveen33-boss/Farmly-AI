import { config } from '../config.js';
import { locationCache } from './cache.js';
import { OFFICIAL_STATES_AND_DISTRICTS, OFFICIAL_STATES_LIST } from '../data/official_locations.js';

const AGMARKNET_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';
const CACHE_TTL_SECONDS = 86400; // 24 hours

// Live LGD resources on data.gov.in, verified 2026-11-01:
// States  a71e60f0-a21d-43de-a6c5-fa5d21600cdb  (36 rows, updated 2026-10-31)
// Districts 37231365-78ba-44d5-ac22-3deec40b9197 (785 rows, updated 2026-10-31)
const LGD_STATES_RESOURCE = 'a71e60f0-a21d-43de-a6c5-fa5d21600cdb';
const LGD_DISTRICTS_RESOURCE = '37231365-78ba-44d5-ac22-3deec40b9197';

const OFFICIAL_SOURCE =
  'official_reference (Local Government Directory, Ministry of Panchayati Raj, snapshot 2026-10-31)';
const AGMARKNET_SOURCE = `data.gov.in (Agmarknet ${AGMARKNET_RESOURCE})`;
const LGD_STATES_SOURCE = `data.gov.in (LGD States ${LGD_STATES_RESOURCE})`;
const LGD_DISTRICTS_SOURCE = `data.gov.in (LGD Districts ${LGD_DISTRICTS_RESOURCE})`;

// Agmarknet uses a few non-LGD spellings for the same states.
const AGMARKNET_STATE_ALIASES = {
  Chhattisgarh: ['Chhattisgarh', 'Chattisgarh'],
  Kerala: ['Kerala', 'Keralam'],
  Delhi: ['Delhi', 'NCT of Delhi'],
  Odisha: ['Odisha', 'Orissa'],
  'Andaman and Nicobar Islands': ['Andaman and Nicobar Islands', 'Andaman and Nicobar'],
};

/**
 * Fetch JSON with a short timeout and a couple of retries.
 * data.gov.in is often slow or stalls, so we abort rather than hanging the UI.
 */
async function fetchWithTimeout(url, timeoutMs = 6000, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

function dataGovUrl(resourceId, extraParams) {
  const params = new URLSearchParams({
    'api-key': config.DATA_GOV_API_KEY,
    format: 'json',
    ...extraParams,
  });
  return `https://api.data.gov.in/resource/${resourceId}?${params.toString()}`;
}

function pickField(record, candidates) {
  for (const name of candidates) {
    if (record[name]) return String(record[name]).trim();
    const match = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
    if (match && record[match]) return String(record[match]).trim();
  }
  return '';
}

/**
 * Find the canonical LGD state name, including a few common aliases.
 */
export function matchCanonicalState(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase();
  for (const s of OFFICIAL_STATES_LIST) {
    if (s.toLowerCase() === clean) return s;
  }
  if (clean === 'chattisgarh') return 'Chhattisgarh';
  if (clean === 'orissa') return 'Odisha';
  if (clean === 'keralam') return 'Kerala';
  if (clean === 'nct of delhi') return 'Delhi';
  if (clean === 'andaman and nicobar') return 'Andaman and Nicobar Islands';
  if (clean === 'pondicherry') return 'Puducherry';
  return null;
}

function officialStatesResult() {
  return {
    source: OFFICIAL_SOURCE,
    states: OFFICIAL_STATES_LIST,
    count: OFFICIAL_STATES_LIST.length,
  };
}

function officialDistrictsResult(canonicalState) {
  const districts = OFFICIAL_STATES_AND_DISTRICTS[canonicalState] || [];
  return {
    source: OFFICIAL_SOURCE,
    state: canonicalState,
    districts,
    count: districts.length,
  };
}

/**
 * Source 1: official LGD States dataset on data.gov.in (36 rows).
 */
async function tryLiveLgdStates() {
  const cacheKey = 'locations:lgd-states-live';
  const cached = locationCache.get(cacheKey);
  if (cached && !cached.stale) return cached.data;

  if (!config.DATA_GOV_API_KEY) {
    const miss = { available: false, reason: 'DATA_GOV_API_KEY missing' };
    locationCache.set(cacheKey, miss, CACHE_TTL_SECONDS);
    return miss;
  }

  try {
    const json = await fetchWithTimeout(
      dataGovUrl(LGD_STATES_RESOURCE, {
        fields: 'state_name_english,state_or_ut',
        limit: '100',
      }),
      8000,
      2
    );
    const names = [
      ...new Set(
        (json.records || [])
          .map((rec) => pickField(rec, ['state_name_english', 'state_name', 'state']))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    if (names.length < 28) {
      const miss = { available: false, reason: `LGD states returned only ${names.length} names` };
      locationCache.set(cacheKey, miss, 600);
      return miss;
    }

    const hit = { available: true, source: LGD_STATES_SOURCE, states: names };
    locationCache.set(cacheKey, hit, CACHE_TTL_SECONDS);
    return hit;
  } catch (err) {
    console.warn(`[Locations] LGD states failed: ${err.message}`);
    if (cached) return { ...cached.data, stale: true };
    return { available: false, reason: err.message };
  }
}

/**
 * Source 1: official LGD Districts dataset, filtered by state_name_english.
 */
async function tryLiveLgdDistricts(stateName) {
  const cacheKey = `locations:lgd-districts:${stateName.toLowerCase()}`;
  const cached = locationCache.get(cacheKey);
  if (cached && !cached.stale) return cached.data;

  if (!config.DATA_GOV_API_KEY) {
    return { available: false, reason: 'DATA_GOV_API_KEY missing' };
  }

  try {
    const json = await fetchWithTimeout(
      dataGovUrl(LGD_DISTRICTS_RESOURCE, {
        fields: 'state_name_english,district_name_english',
        limit: '500',
        [`filters[state_name_english]`]: stateName,
      }),
      8000,
      2
    );
    const names = [
      ...new Set(
        (json.records || [])
          .map((rec) => pickField(rec, ['district_name_english', 'district_name', 'district']))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    if (names.length === 0) {
      const miss = { available: false, reason: `LGD districts empty for ${stateName}` };
      locationCache.set(cacheKey, miss, 600);
      return miss;
    }

    const hit = { available: true, source: LGD_DISTRICTS_SOURCE, districts: names };
    locationCache.set(cacheKey, hit, CACHE_TTL_SECONDS);
    return hit;
  } catch (err) {
    console.warn(`[Locations] LGD districts ${stateName} failed: ${err.message}`);
    if (cached) return { ...cached.data, stale: true };
    return { available: false, reason: err.message };
  }
}

/**
 * Source 2: distinct state/district values from the live Agmarknet mandi feed.
 * This is an arrivals feed, not an administrative directory — some states have
 * zero rows on a given day (Jharkhand had none on 2026-11-01).
 */
async function tryAgmarknetDirectory() {
  const cacheKey = 'locations:agmarknet-uniques';
  const cached = locationCache.get(cacheKey);
  if (cached && !cached.stale) return cached.data;

  if (!config.DATA_GOV_API_KEY) {
    const miss = { available: false, reason: 'DATA_GOV_API_KEY missing' };
    locationCache.set(cacheKey, miss, CACHE_TTL_SECONDS);
    return miss;
  }

  try {
    const byState = {};
    const limit = 1000;
    // Three pages is enough to see coverage without blowing the request budget.
    for (let offset = 0; offset < 3000; offset += limit) {
      const json = await fetchWithTimeout(
        dataGovUrl(AGMARKNET_RESOURCE, {
          fields: 'state,district',
          limit: String(limit),
          offset: String(offset),
        }),
        8000,
        1
      );
      const records = json.records || [];
      for (const rec of records) {
        const rawState = pickField(rec, ['state']);
        const district = pickField(rec, ['district']);
        const state = matchCanonicalState(rawState) || rawState;
        if (!state || !district) continue;
        if (!byState[state]) byState[state] = new Set();
        byState[state].add(district);
      }
      if (records.length < limit) break;
    }

    const states = Object.keys(byState).sort();
    if (states.length === 0) {
      const miss = { available: false, reason: 'Agmarknet returned no state/district rows' };
      locationCache.set(cacheKey, miss, CACHE_TTL_SECONDS);
      return miss;
    }
    const map = {};
    for (const s of states) map[s] = [...byState[s]].sort();
    const hit = {
      available: true,
      source: AGMARKNET_SOURCE,
      states,
      districtsByState: map,
    };
    locationCache.set(cacheKey, hit, CACHE_TTL_SECONDS);
    return hit;
  } catch (err) {
    console.warn(`[Locations] Agmarknet unique scrape failed: ${err.message}`);
    if (cached) return { ...cached.data, stale: true };
    return { available: false, reason: err.message };
  }
}

async function tryAgmarknetDistrictsForState(canonicalState) {
  if (!config.DATA_GOV_API_KEY) return [];
  const names = AGMARKNET_STATE_ALIASES[canonicalState] || [canonicalState];
  const found = new Set();
  for (const name of names) {
    try {
      const json = await fetchWithTimeout(
        dataGovUrl(AGMARKNET_RESOURCE, {
          fields: 'state,district',
          limit: '1000',
          [`filters[state]`]: name,
        }),
        6000,
        1
      );
      for (const rec of json.records || []) {
        const district = pickField(rec, ['district']);
        if (district) found.add(district);
      }
    } catch (err) {
      console.warn(`[Locations] Agmarknet filter state=${name} failed: ${err.message}`);
    }
  }
  return [...found].sort();
}

function wrapFresh(result) {
  return { ...result, stale: false, fetched_at: new Date().toISOString() };
}

function wrapCached(cached) {
  return { ...cached.data, stale: cached.stale, fetched_at: cached.fetched_at };
}

/**
 * GET /api/locations/states
 *
 * Order: live LGD States → Agmarknet uniques (only if reasonably complete) → bundled snapshot.
 */
export async function getStates() {
  const cacheKey = 'locations:states';
  const cached = locationCache.get(cacheKey);
  if (cached && !cached.stale) return wrapCached(cached);

  try {
    const lgd = await tryLiveLgdStates();
    if (lgd?.available && lgd.states?.length) {
      const result = { source: lgd.source, states: lgd.states, count: lgd.states.length };
      locationCache.set(cacheKey, result, CACHE_TTL_SECONDS);
      return wrapFresh(result);
    }

    const ag = await tryAgmarknetDirectory();
    // Arrivals feeds omit states with no trades that day (Jharkhand on 2026-11-01).
    // Only use them when the set looks like a full administrative list.
    if (ag?.available && ag.states?.length >= 28 && ag.states.includes('Jharkhand')) {
      const result = { source: ag.source, states: ag.states, count: ag.states.length };
      locationCache.set(cacheKey, result, CACHE_TTL_SECONDS);
      return wrapFresh(result);
    }
  } catch (err) {
    console.warn(`[Locations] Live state sources failed: ${err.message}`);
    if (cached) return wrapCached(cached);
  }

  const fallback = officialStatesResult();
  locationCache.set(cacheKey, fallback, CACHE_TTL_SECONDS);
  return wrapFresh(fallback);
}

/**
 * GET /api/locations/districts?state=...
 */
export async function getDistricts(stateQuery) {
  if (!stateQuery || !stateQuery.trim()) {
    const err = new Error("Query parameter 'state' is required.");
    err.status = 422;
    err.source = 'validation';
    throw err;
  }

  const trimmed = stateQuery.trim();
  const canonicalState = matchCanonicalState(trimmed);
  const lookupNames = [...new Set([trimmed, canonicalState].filter(Boolean))];

  const cacheKey = `locations:districts:${(canonicalState || trimmed).toLowerCase()}`;
  const cached = locationCache.get(cacheKey);
  if (cached && !cached.stale) return wrapCached(cached);

  try {
    for (const name of lookupNames) {
      const lgd = await tryLiveLgdDistricts(name);
      if (lgd?.available && lgd.districts?.length) {
        const result = {
          source: lgd.source,
          state: canonicalState || name,
          districts: lgd.districts,
          count: lgd.districts.length,
        };
        locationCache.set(cacheKey, result, CACHE_TTL_SECONDS);
        return wrapFresh(result);
      }
    }

    if (canonicalState) {
      const filtered = await tryAgmarknetDistrictsForState(canonicalState);
      if (filtered.length > 0) {
        const result = {
          source: AGMARKNET_SOURCE,
          state: canonicalState,
          districts: filtered,
          count: filtered.length,
        };
        locationCache.set(cacheKey, result, CACHE_TTL_SECONDS);
        return wrapFresh(result);
      }

      const ag = await tryAgmarknetDirectory();
      if (ag?.available && ag.districtsByState?.[canonicalState]?.length) {
        const districts = ag.districtsByState[canonicalState];
        const result = {
          source: ag.source,
          state: canonicalState,
          districts,
          count: districts.length,
        };
        locationCache.set(cacheKey, result, CACHE_TTL_SECONDS);
        return wrapFresh(result);
      }
    }
  } catch (err) {
    console.warn(`[Locations] Live districts for ${trimmed} failed: ${err.message}`);
    if (cached) return wrapCached(cached);
  }

  if (canonicalState) {
    const fallback = officialDistrictsResult(canonicalState);
    locationCache.set(cacheKey, fallback, CACHE_TTL_SECONDS);
    return wrapFresh(fallback);
  }

  const err = new Error(`State '${stateQuery}' not found. Please select a valid Indian state.`);
  err.status = 404;
  err.source = 'locations';
  throw err;
}
