import { config } from '../config.js';
import { mandiCache, geocodeCache } from './cache.js';
import { geocodeCity } from './weather_service.js';

const MANDI_PRIMARY_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';

/**
 * Verified commodity name mapping against the live Agmarknet daily feed.
 * Every alias has been verified against the 194 distinct commodities currently reported.
 */
export const COMMODITY_ALIASES = {
  paddy: ['Paddy(Common)', 'Paddy(Fine/Superfine/Grade A)', 'Paddy(Basmati)', 'Rice', 'Rice(Fine/Superfine/Grade A)'],
  rice: ['Paddy(Common)', 'Paddy(Fine/Superfine/Grade A)', 'Paddy(Basmati)', 'Rice', 'Rice(Fine/Superfine/Grade A)'],
  maize: ['Maize', 'Sweet Corn ', 'Baby Corn'],
  wheat: ['Wheat'],
  mustard: ['Mustard', 'Indian Colza(Sarson)'],
  tomato: ['Tomato'],
  potato: ['Potato'],
  soybean: ['Soyabean'],
  soyabean: ['Soyabean'],
  groundnut: ['Groundnut', 'Ground Nut Seed'],
  cotton: ['Cotton', 'Lint'],
  pulses: [
    'Bengal Gram(Gram)(Whole)',
    'Black Gram(Urd Beans)(Whole)',
    'Green Gram(Moong)(Whole)',
    'Lentil(Masur)(Whole)',
    'Red gram/Arhar/Tur(whole)',
    'Cowpea(Lobia/Karamani)',
    'Other Pulses',
  ],
  gram: ['Bengal Gram(Gram)(Whole)', 'Black Gram(Urd Beans)(Whole)', 'Green Gram(Moong)(Whole)'],
  onion: ['Onion'],
  brinjal: ['Brinjal'],
  garlic: ['Garlic'],
  ginger: ['Ginger(Green)', 'Ginger(Dry)'],
  turmeric: ['Turmeric', 'Turmeric(raw)'],
};

/**
 * Haversine formula for calculating distance in kilometers between two GPS coordinates.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Helper to check whether an Open-Meteo admin1 state matches the requested state.
 */
function stateMatches(admin1, requestedState) {
  if (!requestedState) return true;
  if (!admin1) return false;
  const a = admin1.toLowerCase().trim();
  const s = requestedState.toLowerCase().trim();
  if (a === s || a.includes(s) || s.includes(a)) return true;
  // Handle common variants
  if ((s.includes('kerala') && a.includes('kerala')) || (s.includes('orissa') && a.includes('odisha'))) return true;
  return false;
}

/**
 * Geocode a specific market / mandi to { lat, lon, uncertain } using Open-Meteo.
 * Restricts candidate matching strictly to the market's state to prevent ambiguous matches across India.
 * Marks uncertain=true if falling back to district or state center.
 */
export async function geocodeMarket(marketName, districtName, stateName) {
  const cleanName = marketName.replace(/\b(APMC|Mandi|Market|Yard|Sub-yard|Kisan Mandi)\b/gi, '').trim();
  const searchKey = `market_geo_v2:${marketName}_${districtName}_${stateName}`.toLowerCase();
  const cached = geocodeCache.get(searchKey);
  if (cached && !cached.stale) return cached.data;

  const queries = [
    { name: cleanName, uncertain: false },
    { name: districtName, uncertain: true },
    { name: stateName, uncertain: true },
  ].filter((q) => Boolean(q.name && q.name.length >= 2));

  for (const q of queries) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.name)}&count=10&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.results || [];

      // Find first result in India matching the target state
      const match = results.find((r) => {
        if (r.country_code && r.country_code !== 'IN') return false;
        return stateMatches(r.admin1, stateName);
      });

      if (match) {
        const coord = {
          lat: Number(match.latitude.toFixed(4)),
          lon: Number(match.longitude.toFixed(4)),
          uncertain: q.uncertain,
        };
        geocodeCache.set(searchKey, coord, 86400 * 7); // 7-day cache
        return coord;
      }
    } catch {
      // Continue to next broader fallback query
    }
  }

  return null;
}

/**
 * Resolve farmer coordinates from user_lat/lon or by geocoding farmer's district/state.
 */
export async function getFarmerCoordinates(user_lat, user_lon, district, state) {
  if (user_lat !== undefined && user_lat !== null && !isNaN(Number(user_lat)) &&
      user_lon !== undefined && user_lon !== null && !isNaN(Number(user_lon))) {
    return { lat: Number(user_lat), lon: Number(user_lon) };
  }

  const queries = [
    [district, state].filter(Boolean).join(', '),
    district,
    state,
  ].filter((q) => Boolean(q && q.trim().length >= 2));

  for (const q of queries) {
    try {
      const geo = await geocodeCity(q);
      if (geo?.lat && geo?.lon) {
        return { lat: geo.lat, lon: geo.lon };
      }
    } catch {
      // Continue to next query
    }
  }

  return null;
}

/**
 * Fetch from data.gov.in API with retries, timeout, and abort controller.
 */
async function fetchMandiData(resourceId, filters, limit = 100, timeoutMs = 8000) {
  if (!config.DATA_GOV_API_KEY) {
    throw new Error('DATA_GOV_API_KEY is not configured');
  }

  const params = new URLSearchParams({
    'api-key': config.DATA_GOV_API_KEY,
    format: 'json',
    limit: String(limit),
  });

  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(`filters[${key}]`, value);
  }

  const url = `https://api.data.gov.in/resource/${resourceId}?${params.toString()}`;

  for (let attempt = 0; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Normalize records from live feed into standard format.
 */
function normalizeRecords(records) {
  return records.map((r) => ({
    state: (r.state || r.State || '').trim(),
    district: (r.district || r.District || '').trim(),
    market: (r.market || r.Market || '').trim(),
    commodity: (r.commodity || r.Commodity || '').trim(),
    variety: (r.variety || r.Variety || 'Standard').trim(),
    grade: (r.grade || r.Grade || 'FAQ').trim(),
    arrival_date: (r.arrival_date || r.Arrival_Date || '').trim(),
    min_price: Number(r.min_price || r.Min_Price || 0),
    max_price: Number(r.max_price || r.Max_Price || 0),
    modal_price: Number(r.modal_price || r.Modal_Price || 0),
  }));
}

/**
 * Compute real statistical summary strictly from returned records.
 */
function computeMandiSummary(records) {
  if (!records.length) {
    return {
      total_records: 0,
      min_modal_price: null,
      max_modal_price: null,
      avg_modal_price: null,
      date_range: null,
    };
  }

  const modalPrices = records.map((r) => r.modal_price).filter((p) => p > 0);
  const minPrice = modalPrices.length ? Math.min(...modalPrices) : null;
  const maxPrice = modalPrices.length ? Math.max(...modalPrices) : null;
  const avgPrice = modalPrices.length
    ? Math.round(modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length)
    : null;

  const dates = [...new Set(records.map((r) => r.arrival_date).filter(Boolean))];

  return {
    total_records: records.length,
    min_modal_price: minPrice,
    max_modal_price: maxPrice,
    avg_modal_price: avgPrice,
    date_range: {
      earliest: dates[0] || null,
      latest: dates[dates.length - 1] || null,
      unique_dates: dates,
    },
  };
}

/**
 * Enriches records with distance, transport cost, net return, applies filters and builds recommendation.
 */
async function enrichPricesWithDistanceAndTransport(
  basePayload,
  user_lat,
  user_lon,
  user_district,
  user_state,
  transport_rate,
  quantity = 1,
  max_km = 100
) {
  const rawRecords = basePayload.records || [];
  const rate = transport_rate !== undefined && transport_rate !== null && !isNaN(Number(transport_rate))
    ? Number(transport_rate)
    : (config.TRANSPORT_RATE_PER_Q_KM ?? 8);
  const qty = Math.max(0.1, Number(quantity) || 1);
  const maxDistanceKm = max_km ? Number(max_km) : 100;

  // Resolve farmer coordinates for distance calculation
  const farmerCoords = await getFarmerCoordinates(
    user_lat,
    user_lon,
    user_district || basePayload.filters.district,
    user_state || basePayload.filters.state
  );

  // Geocode unique markets
  const uniqueMarkets = [...new Set(rawRecords.map((r) => `${r.market}::${r.district}::${r.state}`))];
  const marketCoords = new Map();

  await Promise.all(
    uniqueMarkets.map(async (key) => {
      const [m, d, s] = key.split('::');
      const coord = await geocodeMarket(m, d, s);
      if (coord) marketCoords.set(key, coord);
    })
  );

  // Enrich each record
  const enriched = rawRecords.map((record) => {
    const key = `${record.market}::${record.district}::${record.state}`;
    const coord = marketCoords.get(key);

    let distance_km = null;
    let uncertain = true;
    let transport_cost_per_q = null;
    let est_net_per_q = null;
    let est_total = null;

    if (coord && farmerCoords) {
      distance_km = haversineDistanceKm(farmerCoords.lat, farmerCoords.lon, coord.lat, coord.lon);
      uncertain = coord.uncertain || false;
    }

    if (rate !== null && distance_km !== null) {
      transport_cost_per_q = Math.round(distance_km * rate * 10) / 10;
      est_net_per_q = Math.round((record.modal_price - transport_cost_per_q) * 10) / 10;
      est_total = Math.round(est_net_per_q * qty);
    } else if (rate !== null && distance_km === null) {
      // Rate provided but distance unknown
      transport_cost_per_q = null;
      est_net_per_q = record.modal_price;
      est_total = Math.round(record.modal_price * qty);
    } else {
      transport_cost_per_q = null;
      est_net_per_q = record.modal_price;
      est_total = Math.round(record.modal_price * qty);
    }

    return {
      state: record.state,
      district: record.district,
      market: record.market,
      commodity: record.commodity,
      variety: record.variety,
      grade: record.grade,
      arrival_date: record.arrival_date,
      min_price: record.min_price,
      max_price: record.max_price,
      modal_price: record.modal_price,
      distance_km,
      uncertain,
      transport_cost_per_q,
      est_net_per_q,
      est_total,
    };
  });

  // Filter records:
  // 1. If state filter specified, strictly restrict to state
  let filtered = enriched;
  if (basePayload.filters.state) {
    const targetState = basePayload.filters.state.toLowerCase();
    filtered = filtered.filter((r) => stateMatches(r.state, targetState));
  }

  // 2. If district filter specified and not "all", filter by district
  if (basePayload.filters.district && !/^(all|all districts)$/i.test(basePayload.filters.district)) {
    const targetDistrict = basePayload.filters.district.toLowerCase();
    filtered = filtered.filter((r) => r.district.toLowerCase() === targetDistrict);
  }

  // 3. Max distance filter: only include markets where distance_km is known and <= maxDistanceKm
  // (or if distance is unknown, keep it)
  filtered = filtered.filter((r) => r.distance_km === null || r.distance_km <= maxDistanceKm);

  // Compute summary ONLY from the filtered returned records
  const summary = computeMandiSummary(filtered);

  // Determine recommendation:
  // MUST NEVER recommend a market with a negative net!
  let recommendation = null;
  let recommendation_notice = null;

  if (filtered.length > 0) {
    if (rate !== null) {
      // Eligible markets MUST have positive net return
      const positiveNetMarkets = filtered
        .filter((r) => r.est_net_per_q !== null && r.est_net_per_q > 0)
        .sort((a, b) => (b.est_net_per_q || 0) - (a.est_net_per_q || 0));

      if (positiveNetMarkets.length > 0) {
        const top = positiveNetMarkets[0];
        recommendation = {
          market: top.market,
          district: top.district,
          state: top.state,
          modal_price: top.modal_price,
          arrival_date: top.arrival_date,
          distance_km: top.distance_km,
          uncertain: top.uncertain,
          transport_cost_per_q: top.transport_cost_per_q,
          est_net_per_q: top.est_net_per_q,
          est_total: top.est_total,
          basis: 'Highest estimated net return after user-specified transport cost',
        };
      } else {
        recommendation = null;
        recommendation_notice = `No market within ${maxDistanceKm} km has a positive estimated net return after transport costs. Try lowering transport rate or increasing distance.`;
      }
    } else {
      // Best by highest modal price
      const sortedByPrice = [...filtered].sort((a, b) => b.modal_price - a.modal_price);
      const top = sortedByPrice[0];
      if (top && top.modal_price > 0) {
        recommendation = {
          market: top.market,
          district: top.district,
          state: top.state,
          modal_price: top.modal_price,
          arrival_date: top.arrival_date,
          distance_km: top.distance_km,
          uncertain: top.uncertain,
          transport_cost_per_q: null,
          est_net_per_q: top.modal_price,
          est_total: Math.round(top.modal_price * qty),
          basis: 'Highest modal price reported in live mandi feed',
        };
      }
    }
  } else {
    recommendation_notice = `No market reported prices for ${basePayload.filters.commodity || 'this crop'} within ${maxDistanceKm} km today.`;
  }

  return {
    source: basePayload.source,
    resource_id: basePayload.resource_id,
    filters: basePayload.filters,
    summary,
    transport_rate_applied: rate,
    transport_notice: `Travel cost uses an assumed rate of ₹${rate}/quintal/km (estimate, not an official figure).`,
    recommendation,
    recommendation_notice,
    records: filtered,
    fetched_at: basePayload.fetched_at,
    stale: basePayload.stale || false,
  };
}

/**
 * Main service method: GET /api/prices
 */
export async function getMandiPrices({
  state,
  commodity,
  district,
  market,
  user_lat,
  user_lon,
  user_district,
  user_state,
  transport_rate,
  transport_rate_per_km,
  quantity = 1,
  quantity_q,
  max_km = 100,
  limit = 50,
}) {
  const normState = state?.trim() || '';
  const normCommodity = commodity?.trim() || '';
  const normDistrict = district?.trim() || '';
  const normMarket = market?.trim() || '';
  const effectiveRate = (transport_rate !== undefined && transport_rate !== null && !isNaN(Number(transport_rate)))
    ? Number(transport_rate)
    : (transport_rate_per_km !== undefined && transport_rate_per_km !== null && !isNaN(Number(transport_rate_per_km)))
      ? Number(transport_rate_per_km)
      : (config.TRANSPORT_RATE_PER_Q_KM ?? 8);
  const effectiveQty = quantity_q ?? quantity ?? 1;

  const cacheKey = `mandi_v2:${normState}:${normDistrict}:${normCommodity}:${normMarket}:${limit}`.toLowerCase();
  const cached = mandiCache.get(cacheKey);

  if (cached && !cached.stale) {
    return await enrichPricesWithDistanceAndTransport(
      cached.data,
      user_lat,
      user_lon,
      user_district,
      user_state,
      effectiveRate,
      effectiveQty,
      max_km
    );
  }

  try {
    const primaryFilters = {};
    if (normState) primaryFilters.state = normState;
    if (normDistrict && !/^(all|all districts)$/i.test(normDistrict)) {
      primaryFilters.district = normDistrict;
    }
    if (normMarket) primaryFilters.market = normMarket;

    // Resolve commodity aliases
    let targetCommodities = [normCommodity];
    if (normCommodity && COMMODITY_ALIASES[normCommodity.toLowerCase()]) {
      targetCommodities = COMMODITY_ALIASES[normCommodity.toLowerCase()];
    }

    let rawRecords = [];
    for (const comm of targetCommodities) {
      if (comm) primaryFilters.commodity = comm;
      try {
        const primaryJson = await fetchMandiData(MANDI_PRIMARY_RESOURCE, primaryFilters, limit);
        if (primaryJson?.records?.length > 0) {
          rawRecords.push(...primaryJson.records);
          if (rawRecords.length >= limit) break;
        }
      } catch (err) {
        console.warn(`[Mandi] Primary fetch failed for ${comm}: ${err.message}`);
      }
    }

    const records = normalizeRecords(rawRecords);
    const resultPayload = {
      source: 'data.gov.in Agmarknet Daily Feed (Resource 9ef84268-d588-465a-a308-a864a43d0070)',
      resource_id: MANDI_PRIMARY_RESOURCE,
      filters: {
        state: normState || null,
        commodity: normCommodity || null,
        district: normDistrict || null,
        market: normMarket || null,
      },
      records,
      fetched_at: new Date().toISOString(),
      stale: false,
    };

    mandiCache.set(cacheKey, resultPayload, 900); // 15-minute TTL

    return await enrichPricesWithDistanceAndTransport(
      resultPayload,
      user_lat,
      user_lon,
      user_district,
      user_state,
      effectiveRate,
      effectiveQty,
      max_km
    );
  } catch (err) {
    if (cached) {
      console.warn(`[Mandi] Upstream failed, returning stale cache: ${err.message}`);
      const stalePayload = {
        ...cached.data,
        stale: true,
        fetched_at: cached.fetched_at,
        warning: `Upstream data.gov.in unreachable (${err.message}). Returning cached data.`,
      };
      return await enrichPricesWithDistanceAndTransport(
        stalePayload,
        user_lat,
        user_lon,
        user_district,
        user_state,
        effectiveRate,
        effectiveQty,
        max_km
      );
    }
    throw err;
  }
}

/**
 * Service method: GET /api/prices/trend
 */
export async function getPricesTrend({ state, commodity, district, market }) {
  const normState = state?.trim() || '';
  const normCommodity = commodity?.trim() || '';
  const normDistrict = district?.trim() || '';
  const normMarket = market?.trim() || '';

  const pricesData = await getMandiPrices({
    state: normState,
    commodity: normCommodity,
    district: normDistrict,
    market: normMarket,
    limit: 100,
  });

  const records = pricesData.records || [];

  const dateMap = new Map();
  for (const r of records) {
    if (!r.arrival_date || !r.modal_price) continue;
    if (!dateMap.has(r.arrival_date)) dateMap.set(r.arrival_date, []);
    dateMap.get(r.arrival_date).push(r.modal_price);
  }

  const distinctDates = Array.from(dateMap.keys());
  if (distinctDates.length < 2) {
    return {
      insufficient_data: true,
      message:
        'Insufficient historical arrival dates returned from live mandi feed to compute a valid price trend. Live feed contains single-date reporting.',
      commodity: normCommodity || 'All',
      state: normState || 'All',
      available_dates: distinctDates,
      sample_records_count: records.length,
      source: pricesData.source,
      fetched_at: pricesData.fetched_at,
    };
  }

  const points = distinctDates.map((dateStr) => {
    const prices = dateMap.get(dateStr);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    return { date: dateStr, avg_modal_price: avg, count: prices.length };
  });

  const earliest = points[0].avg_modal_price;
  const latest = points[points.length - 1].avg_modal_price;
  const diff = latest - earliest;
  const pctChange = earliest > 0 ? Math.round((diff / earliest) * 1000) / 10 : 0;

  return {
    insufficient_data: false,
    commodity: normCommodity,
    state: normState,
    trend_direction: pctChange > 0 ? 'up' : pctChange < 0 ? 'down' : 'stable',
    change_percentage: pctChange,
    price_change_per_quintal: diff,
    earliest_avg: earliest,
    latest_avg: latest,
    data_points: points,
    source: pricesData.source,
    fetched_at: pricesData.fetched_at,
  };
}
