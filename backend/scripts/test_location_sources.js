import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/PRAVEEN KUMAR/forge-app/.env' });

const key = process.env.DATA_GOV_API_KEY;
console.log('DATA_GOV_API_KEY available:', !!key);

async function testAgmarknet() {
  console.log('\n--- Testing Agmarknet resource 9ef84268-d588-465a-a308-a864a43d0070 ---');
  const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${key}&format=json&limit=500`;
  const t0 = Date.now();
  const res = await fetch(url);
  const json = await res.json();
  console.log(`HTTP ${res.status} in ${Date.now() - t0}ms, total records: ${json.records?.length}`);
  if (json.records?.length) {
    const states = [...new Set(json.records.map((r) => r.state).filter(Boolean))].sort();
    console.log(`Unique states found (${states.length}):`, states);
  }

  // Filter by state=Jharkhand
  const jhUrl = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${key}&format=json&limit=200&filters[state]=Jharkhand`;
  const jhRes = await fetch(jhUrl);
  const jhJson = await jhRes.json();
  console.log(`Jharkhand records: ${jhJson.records?.length}`);
  if (jhJson.records?.length) {
    const districts = [...new Set(jhJson.records.map((r) => r.district).filter(Boolean))].sort();
    console.log(`Districts in Jharkhand (${districts.length}):`, districts);
  }
}

async function testLGD() {
  console.log('\n--- Testing LGD resources on data.gov.in ---');
  // Known data.gov.in LGD catalog resources:
  // e.g., 6176ee09-3d56-4a3b-8115-22580ec77b1e (LGD District directory)
  const candidateResources = [
    '6176ee09-3d56-4a3b-8115-22580ec77b1e',
    '33dc013e-1e66-41f8-9584-63c631a067db',
  ];
  for (const r of candidateResources) {
    try {
      const url = `https://api.data.gov.in/resource/${r}?api-key=${key}&format=json&limit=5`;
      const res = await fetch(url);
      console.log(`Resource ${r}: HTTP ${res.status}`);
      if (res.ok) {
        const json = await res.json();
        console.log(`Records: ${json.records?.length}`);
        if (json.records?.[0]) console.log(`Fields:`, Object.keys(json.records[0]));
      }
    } catch (e) {
      console.log(`Resource ${r} failed:`, e.message);
    }
  }
}

async function testAgmarknetFallback() {
  console.log('\n--- Testing Agmarknet Fallback resource 35985678-0d79-46b4-9ed6-6f13308a1d24 ---');
  const url = `https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24?api-key=${key}&format=json&limit=500`;
  const t0 = Date.now();
  const res = await fetch(url);
  const json = await res.json();
  console.log(`HTTP ${res.status} in ${Date.now() - t0}ms, total records: ${json.records?.length}`);
  if (json.records?.length) {
    const states = [...new Set(json.records.map((r) => r.state).filter(Boolean))].sort();
    console.log(`Unique states found (${states.length}):`, states);
  }

  const jhUrl = `https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24?api-key=${key}&format=json&limit=200&filters[state]=Jharkhand`;
  const jhRes = await fetch(jhUrl);
  const jhJson = await jhRes.json();
  console.log(`Jharkhand records in fallback: ${jhJson.records?.length}`);
  if (jhJson.records?.length) {
    const districts = [...new Set(jhJson.records.map((r) => r.district).filter(Boolean))].sort();
    console.log(`Districts in Jharkhand (${districts.length}):`, districts);
  }
}

async function main() {
  await testLGD();
  await testAgmarknet();
  await testAgmarknetFallback();
}

main().catch(console.error);
