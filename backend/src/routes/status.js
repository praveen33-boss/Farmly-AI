import { Router } from 'express';
import { config } from '../config.js';
import { statusCache } from '../services/cache.js';
import { isSupabaseConfigured, getSupabaseClient } from '../services/supabase_client.js';
import { getSchemesMetadata } from '../services/schemes_service.js';

export const statusRouter = Router();

async function checkOpenWeather() {
  if (!config.OPENWEATHER_API_KEY) {
    return { configured: false, status: 'missing_key', latency_ms: null, message: 'OPENWEATHER_API_KEY is not set' };
  }
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Delhi&appid=${config.OPENWEATHER_API_KEY}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    return {
      configured: true,
      status: res.ok ? 'operational' : `http_${res.status}`,
      latency_ms: Date.now() - t0,
      last_check: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      configured: true,
      status: 'unreachable',
      latency_ms: Date.now() - t0,
      error: err.message,
      last_check: new Date().toISOString(),
    };
  }
}

async function checkOpenMeteo() {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=23.34&longitude=85.31&current_weather=true',
      { signal: controller.signal }
    );
    clearTimeout(timer);
    return {
      configured: true,
      status: res.ok ? 'operational' : `http_${res.status}`,
      latency_ms: Date.now() - t0,
      last_check: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      configured: true,
      status: 'unreachable',
      latency_ms: Date.now() - t0,
      error: err.message,
      last_check: new Date().toISOString(),
    };
  }
}

async function checkDataGovIn() {
  if (!config.DATA_GOV_API_KEY) {
    return { configured: false, status: 'missing_key', latency_ms: null, message: 'DATA_GOV_API_KEY is not set' };
  }
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${config.DATA_GOV_API_KEY}&format=json&limit=1`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    return {
      configured: true,
      status: res.ok ? 'operational' : `http_${res.status}`,
      latency_ms: Date.now() - t0,
      last_check: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      configured: true,
      status: 'unreachable',
      latency_ms: Date.now() - t0,
      error: err.message,
      last_check: new Date().toISOString(),
    };
  }
}

async function checkGroq() {
  if (!config.GROQ_API_KEY) {
    return { configured: false, status: 'missing_key', latency_ms: null, message: 'GROQ_API_KEY is not set' };
  }
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${config.GROQ_API_KEY}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      configured: true,
      status: res.ok ? 'operational' : `http_${res.status}`,
      model_configured: config.GROQ_MODEL,
      latency_ms: Date.now() - t0,
      last_check: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      configured: true,
      status: 'unreachable',
      latency_ms: Date.now() - t0,
      error: err.message,
      last_check: new Date().toISOString(),
    };
  }
}

async function checkSupabase() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'SUPABASE_URL and SUPABASE_ANON_KEY need to be set in .env',
      last_check: new Date().toISOString(),
    };
  }
  const t0 = Date.now();
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      return {
        configured: true,
        status: 'error',
        message: error.message,
        latency_ms: Date.now() - t0,
        last_check: new Date().toISOString(),
      };
    }
    return {
      configured: true,
      status: 'operational',
      latency_ms: Date.now() - t0,
      last_check: new Date().toISOString(),
    };
  } catch (err) {
    return {
      configured: true,
      status: 'unreachable',
      error: err.message,
      latency_ms: Date.now() - t0,
      last_check: new Date().toISOString(),
    };
  }
}

statusRouter.get('/', async (req, res) => {
  const cacheKey = 'status:all';
  const cached = statusCache.get(cacheKey);
  if (cached && !cached.stale) {
    return res.json(cached.data);
  }

  const [weather, openMeteo, mandi, groq, supabase, schemesMeta] = await Promise.all([
    checkOpenWeather(),
    checkOpenMeteo(),
    checkDataGovIn(),
    checkGroq(),
    checkSupabase(),
    getSchemesMetadata().catch(() => ({ status: 'error', total_schemes: 0, verified_schemes: 0 })),
  ]);

  const allOperational =
    weather.status === 'operational' &&
    openMeteo.status === 'operational' &&
    mandi.status === 'operational' &&
    groq.status === 'operational';

  const payload = {
    status: allOperational ? 'operational' : 'degraded',
    app: 'Farmly.AI Backend',
    timestamp: new Date().toISOString(),
    services: {
      openweather: weather,
      open_meteo: openMeteo,
      data_gov_in_agmarknet: mandi,
      groq_ai: groq,
      supabase: supabase,
      government_schemes: {
        configured: true,
        status: schemesMeta.status || 'operational',
        total_schemes: schemesMeta.total_schemes || 0,
        verified_schemes: schemesMeta.verified_schemes || 0,
        last_synced_at: schemesMeta.last_synced_at || null,
        last_check: new Date().toISOString(),
      },
    },
  };

  statusCache.set(cacheKey, payload, 30); // Cache for 30s
  return res.json(payload);
});
