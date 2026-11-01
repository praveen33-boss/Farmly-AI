import { config } from '../src/config.js';

async function main() {
  const apiKey = config.DATA_GOV_API_KEY;
  const res = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=5000`);
  const data = await res.json();
  const records = data.records || [];
  console.log(`Total records fetched: ${records.length}`);

  const commodities = new Set();
  const states = new Set();
  const stateCrops = {};

  for (const r of records) {
    commodities.add(r.commodity);
    states.add(r.state);
    if (!stateCrops[r.state]) stateCrops[r.state] = new Set();
    stateCrops[r.state].add(r.commodity);
  }

  console.log('\n--- ALL DISTINCT COMMODITIES IN LIVE FEED (count: ' + commodities.size + ') ---');
  console.log(Array.from(commodities).sort().join(', '));

  console.log('\n--- STATES IN LIVE FEED ---');
  for (const [st, crops] of Object.entries(stateCrops)) {
    console.log(`${st} (${crops.size} commodities)`);
  }
}

main().catch(console.error);
