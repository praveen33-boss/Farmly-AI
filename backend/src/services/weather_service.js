import { config } from '../config.js';
import { weatherCache, geocodeCache } from './cache.js';

const WMO_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

/**
 * Fetch with timeout and retries using built-in fetch and AbortController.
 */
async function fetchWithRetry(url, options = {}, retries = 2, timeoutMs = 8000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) throw err;
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Geocode city to { lat, lon, name, state, country } via Open-Meteo Geocoding.
 */
export async function geocodeCity(cityName) {
  const normalized = cityName.trim().toLowerCase();
  const cacheKey = `geo:${normalized}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && !cached.stale) return cached.data;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
  try {
    const data = await fetchWithRetry(url, {}, 2, 6000);
    const result = data.results?.[0];
    if (!result) {
      const err = new Error(`Location '${cityName}' not found. Please try searching by district name.`);
      err.status = 404;
      err.source = 'geocoding';
      throw err;
    }

    const geoData = {
      name: result.name,
      lat: Number(result.latitude.toFixed(4)),
      lon: Number(result.longitude.toFixed(4)),
      state: result.admin1 || '',
      country: result.country || 'India',
    };
    geocodeCache.set(cacheKey, geoData, 86400); // 24 hours
    return geoData;
  } catch (err) {
    if (cached) return cached.data; // Return stale cache if available
    throw err;
  }
}

/**
 * Fetch 5-day / 3-hour forecast slots from OpenWeather.
 */
async function fetchOpenWeatherForecast(lat, lon, cityName) {
  if (!config.OPENWEATHER_API_KEY) {
    throw new Error('OPENWEATHER_API_KEY is not configured');
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${config.OPENWEATHER_API_KEY}&units=metric`;
  const data = await fetchWithRetry(url, {}, 2, 8000);

  const slots = (data.list || []).map((item) => ({
    time: item.dt_txt,
    timestamp: item.dt,
    temp_c: Math.round(item.main.temp * 10) / 10,
    feels_like_c: Math.round(item.main.feels_like * 10) / 10,
    temp_min_c: Math.round(item.main.temp_min * 10) / 10,
    temp_max_c: Math.round(item.main.temp_max * 10) / 10,
    humidity: item.main.humidity,
    pop: item.pop !== undefined ? Math.round(item.pop * 100) : 0, // Probability of precipitation 0-100%
    rain_mm: item.rain?.['3h'] || 0,
    wind_kmh: Math.round((item.wind?.speed || 0) * 3.6),
    description: item.weather?.[0]?.description || '',
    icon: item.weather?.[0]?.icon || '',
  }));

  return {
    source: 'OpenWeather',
    city: data.city?.name || cityName,
    country: data.city?.country || 'IN',
    slots,
  };
}

/**
 * Fallback: Fetch 5-day / 3-hour forecast slots from Open-Meteo hourly.
 */
async function fetchOpenMeteoHourlyFallback(lat, lon, cityName) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code&timezone=auto`;
  const data = await fetchWithRetry(url, {}, 2, 8000);

  const slots = [];
  const times = data.hourly?.time || [];
  // Sample every 3 hours for 5 days (40 slots)
  for (let i = 0; i < Math.min(times.length, 120); i += 3) {
    const timeStr = times[i].replace('T', ' ') + ':00';
    const pop = data.hourly?.precipitation_probability?.[i] || 0;
    const weatherCode = data.hourly?.weather_code?.[i] || 0;
    slots.push({
      time: timeStr,
      timestamp: Math.floor(new Date(times[i]).getTime() / 1000),
      temp_c: Math.round((data.hourly?.temperature_2m?.[i] || 0) * 10) / 10,
      feels_like_c: Math.round((data.hourly?.temperature_2m?.[i] || 0) * 10) / 10,
      temp_min_c: Math.round((data.hourly?.temperature_2m?.[i] || 0) * 10) / 10,
      temp_max_c: Math.round((data.hourly?.temperature_2m?.[i] || 0) * 10) / 10,
      humidity: data.hourly?.relative_humidity_2m?.[i] || 0,
      pop,
      rain_mm: data.hourly?.precipitation?.[i] || 0,
      wind_kmh: Math.round(data.hourly?.wind_speed_10m?.[i] || 0),
      description: WMO_CODES[weatherCode] || 'Clear',
      icon: '01d',
    });
  }

  return {
    source: 'Open-Meteo (keyless fallback)',
    city: cityName,
    slots,
  };
}

/**
 * Fetch 7-day daily forecast and live soil variables from Open-Meteo.
 */
async function fetchOpenMeteoDailyAndSoil(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&hourly=soil_temperature_0cm,soil_moisture_0_to_1cm&timezone=auto`;
  const data = await fetchWithRetry(url, {}, 2, 8000);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyTimes = data.daily?.time || [];
  const daily = dailyTimes.slice(0, 7).map((dateStr, idx) => {
    const d = new Date(dateStr);
    const code = data.daily?.weather_code?.[idx] || 0;
    return {
      date: dateStr,
      day: dayNames[d.getUTCDay()],
      temp_max_c: Math.round(data.daily?.temperature_2m_max?.[idx] || 0),
      temp_min_c: Math.round(data.daily?.temperature_2m_min?.[idx] || 0),
      pop_max: data.daily?.precipitation_probability_max?.[idx] || 0,
      rain_mm: data.daily?.precipitation_sum?.[idx] || 0,
      weather_code: code,
      label: WMO_CODES[code] || 'Partly cloudy',
    };
  });

  // Current soil moisture & temperature from the first hourly slot
  const currentSoilTemp = data.hourly?.soil_temperature_0cm?.[0] ?? null;
  const currentSoilMoistureRaw = data.hourly?.soil_moisture_0_to_1cm?.[0] ?? null; // m³/m³
  const currentSoilMoisturePct = currentSoilMoistureRaw !== null ? Math.round(currentSoilMoistureRaw * 100) : null;

  return {
    daily,
    soil: {
      soil_temperature_c: currentSoilTemp,
      soil_moisture_pct: currentSoilMoisturePct,
      soil_moisture_volumetric_m3m3: currentSoilMoistureRaw,
      source: 'Open-Meteo',
    },
  };
}

/**
 * Compute agricultural weather alerts strictly from live values.
 * Every alert contains condition, threshold, and observed value.
 */
function computeWeatherAlerts(slots, daily, currentSoil) {
  const alerts = [];

  // Check next 36 hours (first 12 3-hour slots)
  const slots36h = slots.slice(0, 12);
  const maxPop36h = Math.max(...slots36h.map((s) => s.pop), 0);
  const totalRain36h = slots36h.reduce((acc, s) => acc + s.rain_mm, 0);

  if (maxPop36h >= 60 || totalRain36h >= 15) {
    alerts.push({
      type: 'heavy_rain',
      severity: 'action_needed',
      title: 'Rainfall Advisory',
      message: 'Showers expected in the next 36 hours. Clear field drainage channels and postpone fertilizer or chemical spray.',
      condition: 'rain_probability >= 60% or rain_accumulation >= 15mm in 36h',
      threshold: 60,
      observed_value: maxPop36h,
      observed_accumulation_mm: Math.round(totalRain36h * 10) / 10,
      unit: '%',
      window_hours: 36,
    });
  }

  // Extreme Heat: max temp >= 38°C in next 3 days
  const maxTemp3d = Math.max(...daily.slice(0, 3).map((d) => d.temp_max_c), 0);
  if (maxTemp3d >= 38) {
    alerts.push({
      type: 'extreme_heat',
      severity: 'warning',
      title: 'Heat Stress Advisory',
      message: 'High temperatures forecasted. Irrigate crops during early morning or late evening to minimize heat stress.',
      condition: 'temperature_max >= 38°C',
      threshold: 38,
      observed_value: maxTemp3d,
      unit: '°C',
      window_hours: 72,
    });
  }

  // High Wind: wind speed >= 30 km/h
  const maxWind = Math.max(...slots.slice(0, 16).map((s) => s.wind_kmh), 0);
  if (maxWind >= 30) {
    alerts.push({
      type: 'high_wind',
      severity: 'warning',
      title: 'Wind Advisory',
      message: 'Gusty winds expected. Secure lodging-prone crops, young saplings, and greenhouse structures.',
      condition: 'wind_speed >= 30 km/h',
      threshold: 30,
      observed_value: maxWind,
      unit: 'km/h',
      window_hours: 48,
    });
  }

  // Soil Moisture Deficit
  if (currentSoil?.soil_moisture_pct !== null && currentSoil?.soil_moisture_pct < 25) {
    alerts.push({
      type: 'soil_moisture_deficit',
      severity: 'action_needed',
      title: 'Soil Moisture Deficit',
      message: 'Current volumetric soil moisture is below the normal crop growth threshold. Schedule irrigation.',
      condition: 'soil_moisture < 25%',
      threshold: 25,
      observed_value: currentSoil.soil_moisture_pct,
      unit: '%',
    });
  }

  return alerts;
}

/**
 * Main service method: GET /api/weather
 */
export async function getWeather({ city, lat, lon }) {
  let targetLat = lat;
  let targetLon = lon;
  let locationName = city || 'Unknown';
  let state = '';

  if (!targetLat || !targetLon) {
    const geo = await geocodeCity(city || 'Ranchi');
    targetLat = geo.lat;
    targetLon = geo.lon;
    locationName = geo.name;
    state = geo.state;
  }

  const cacheKey = `weather:${targetLat.toFixed(3)}:${targetLon.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && !cached.stale) {
    return { ...cached.data, stale: false, fetched_at: cached.fetched_at };
  }

  try {
    // 1. Fetch 5-day slots (OpenWeather primary, Open-Meteo fallback)
    let slotsResult;
    try {
      slotsResult = await fetchOpenWeatherForecast(targetLat, targetLon, locationName);
    } catch (owErr) {
      console.warn(`[Weather] OpenWeather error, falling back to Open-Meteo: ${owErr.message}`);
      slotsResult = await fetchOpenMeteoHourlyFallback(targetLat, targetLon, locationName);
    }

    // 2. Fetch 7-day daily chart and real live soil moisture / temperature from Open-Meteo
    const { daily, soil } = await fetchOpenMeteoDailyAndSoil(targetLat, targetLon);

    // 3. Current conditions from the first available slot
    const currentSlot = slotsResult.slots[0] || {};
    const current = {
      temp_c: currentSlot.temp_c,
      feels_like_c: currentSlot.feels_like_c,
      humidity: currentSlot.humidity,
      rain_chance: currentSlot.pop,
      wind_kmh: currentSlot.wind_kmh,
      description: currentSlot.description,
      icon: currentSlot.icon,
      soil_moisture_pct: soil.soil_moisture_pct,
      soil_temperature_c: soil.soil_temperature_c,
    };

    // 4. Compute real alerts
    const alerts = computeWeatherAlerts(slotsResult.slots, daily, soil);

    const nowIso = new Date().toISOString();
    const payload = {
      location: {
        name: locationName,
        state,
        lat: targetLat,
        lon: targetLon,
      },
      current,
      daily_7day: daily, // Feeds 7-day daily chart
      forecast_5day: slotsResult.slots.slice(0, 40), // Feeds 5-day 3-hour slots with pop
      alerts,
      soil,
      source: `Slots: ${slotsResult.source} | Daily & Soil: Open-Meteo`,
      slot_source: slotsResult.source,
      daily_source: 'Open-Meteo',
      soil_source: 'Open-Meteo',
      fetched_at: nowIso,
      stale: false,
    };

    weatherCache.set(cacheKey, payload, 600); // 10 minutes cache
    return payload;
  } catch (err) {
    // Return stale cache with honest labelling if upstream failed
    if (cached) {
      console.warn(`[Weather] Upstream failed, returning stale cache for ${locationName}`);
      return {
        ...cached.data,
        stale: true,
        fetched_at: cached.fetched_at,
        warning: `Live weather fetch failed: ${err.message}. Returning cached data.`,
      };
    }
    throw err;
  }
}

/**
 * Dedicated live soil endpoint: GET /api/weather/soil
 */
export async function getLiveSoil({ city, lat, lon }) {
  let targetLat = lat;
  let targetLon = lon;
  let locationName = city || '';

  if (!targetLat || !targetLon) {
    const geo = await geocodeCity(city || 'Ranchi');
    targetLat = geo.lat;
    targetLon = geo.lon;
    locationName = geo.name;
  }

  const { soil } = await fetchOpenMeteoDailyAndSoil(targetLat, targetLon);
  return {
    location: { name: locationName, lat: targetLat, lon: targetLon },
    soil_moisture_pct: soil.soil_moisture_pct,
    soil_moisture_volumetric_m3m3: soil.soil_moisture_volumetric_m3m3,
    soil_temperature_c: soil.soil_temperature_c,
    source: 'Open-Meteo (live keyless API)',
    fetched_at: new Date().toISOString(),
    stale: false,
  };
}
