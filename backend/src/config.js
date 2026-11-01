import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (../.env) and local directory (../.env, ./.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseOrigins(raw) {
  if (!raw) return ['http://localhost:3000'];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export const config = {
  PORT: Number.parseInt(process.env.PORT || '8000', 10),
  HOST: '0.0.0.0',
  FRONTEND_ORIGIN: parseOrigins(process.env.FRONTEND_ORIGIN),
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || null,
  DATA_GOV_API_KEY: process.env.DATA_GOV_API_KEY || null,
  GROQ_API_KEY: process.env.GROQ_API_KEY || null,
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  SUPABASE_URL: process.env.SUPABASE_URL || null,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || null,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || null,
  TRANSPORT_RATE_PER_Q_KM: Number.parseFloat(process.env.TRANSPORT_RATE_PER_Q_KM || '8'),
};

// Safe startup configuration check without exposing full keys
export function printConfigStatus() {
  const mask = (val) => (val && typeof val === 'string' && val.length > 6 ? `${val.slice(0, 3)}...${val.slice(-3)}` : val ? 'configured' : 'missing');
  console.log(`[Config] PORT: ${config.PORT}`);
  console.log(`[Config] Allowed Origins: ${config.FRONTEND_ORIGIN.join(', ')}`);
  console.log(`[Config] OpenWeather Key: ${mask(config.OPENWEATHER_API_KEY)}`);
  console.log(`[Config] Data.gov.in Key: ${mask(config.DATA_GOV_API_KEY)}`);
  console.log(`[Config] Groq Key: ${mask(config.GROQ_API_KEY)} (Model: ${config.GROQ_MODEL})`);
  console.log(`[Config] Supabase URL: ${config.SUPABASE_URL ? 'configured' : 'missing'}`);
}
