/**
 * One-off probe: which live location sources actually return records?
 * Does not print API keys.
 */
import { config } from '../src/config.js';

const key = config.DATA_GOV_API_KEY;
if (!key) {
  console.log('DATA_GOV_API_KEY missing; cannot probe live sources.');
  process.exit(1);
}

const resources = [
  { id: '6176ee09-3d56-4a3b-8115-22580ec77b1e', note: 'candidate LGD 1' },
  { id: '33dc013e-1e66-41f8-9584-63c631a067db', note: 'candidate LGD 2' },
  { id: '9ef84268-d588-465a-a308-a864a43d0070', note: 'Agmarknet current daily' },
  { id: '35985678-0d79-46b4-9ed6-6f13308a1d24', note: 'Agmarknet fallback' },
];

async function probe(id, extra = '') {
  const url = `https://api.data.gov.in/resource/${id}?api-key=${key}&format=json&limit=3${extra}`;
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const json = await res.json();
    const rec = json.records?.[0];
    const fields = rec ? Object.keys(rec) : [];
    const title = json.title || json.org || json.desc || json.index_name || null;
    console.log(
      JSON.stringify({
        id,
        http: res.status,
        ms: Date.now() - t0,
        records: json.records?.length ?? 0,
        total: json.total ?? json.count ?? null,
        title,
        fields,
        sample: rec || json.message || json.error || Object.keys(json).slice(0, 8),
      })
    );
  } catch (err) {
    clearTimeout(timer);
    console.log(JSON.stringify({ id, error: err.name, message: err.message, ms: Date.now() - t0 }));
  }
}

console.log('Probing data.gov.in resources (key present:', Boolean(key), ')');
for (const r of resources) {
  console.log('\n---', r.note, r.id);
  await probe(r.id);
}

console.log('\n--- Agmarknet Jharkhand filter');
await probe('9ef84268-d588-465a-a308-a864a43d0070', '&filters[state]=Jharkhand');
