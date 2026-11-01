/**
 * Probe unique states/districts from live Agmarknet pages.
 * Does not print API keys.
 */
import { config } from '../src/config.js';

const key = config.DATA_GOV_API_KEY;
const id = '9ef84268-d588-465a-a308-a864a43d0070';

async function page(offset, limit = 1000) {
  const url = `https://api.data.gov.in/resource/${id}?api-key=${key}&format=json&fields=state,district&limit=${limit}&offset=${offset}`;
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const json = await res.json();
    return { http: res.status, ms: Date.now() - t0, records: json.records || [], total: json.total };
  } catch (err) {
    clearTimeout(timer);
    return { error: err.message, ms: Date.now() - t0, records: [] };
  }
}

const states = new Set();
const byState = new Map();
let total = null;
for (const offset of [0, 1000, 2000]) {
  const result = await page(offset);
  console.log('page', offset, { http: result.http, ms: result.ms, n: result.records.length, error: result.error || null, total: result.total });
  if (result.total) total = result.total;
  for (const r of result.records) {
    if (!r.state) continue;
    states.add(r.state);
    if (!byState.has(r.state)) byState.set(r.state, new Set());
    if (r.district) byState.get(r.state).add(r.district);
  }
}

const sorted = [...states].sort();
console.log('unique states', sorted.length, sorted);
console.log('Jharkhand in live feed?', states.has('Jharkhand'), 'districts', [...(byState.get('Jharkhand') || [])].sort());
console.log('Bihar districts sample', [...(byState.get('Bihar') || [])].sort().slice(0, 20), 'count', byState.get('Bihar')?.size || 0);
console.log('feed total records claimed', total);
