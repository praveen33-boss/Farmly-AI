
async function testGeocode(marketName, districtName, stateName) {
  const cleanName = marketName.replace(/\b(APMC|Mandi|Market|Yard)\b/gi, '').trim();
  console.log(`\nTesting geocode for: "${marketName}", "${districtName}", "${stateName}" (cleanName: "${cleanName}")`);

  const queries = [
    { name: cleanName, uncertain: false },
    { name: districtName, uncertain: true },
    { name: stateName, uncertain: true },
  ].filter((q) => Boolean(q.name));

  for (const q of queries) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.name)}&count=10&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const results = data.results || [];
    
    // Find candidate matching state
    const match = results.find((r) => {
      if (r.country_code !== 'IN') return false;
      if (!r.admin1) return true;
      const admin1 = r.admin1.toLowerCase();
      const state = stateName.toLowerCase();
      return admin1.includes(state) || state.includes(admin1);
    });

    if (match) {
      console.log(`  -> MATCH on "${q.name}": lat=${match.latitude}, lon=${match.longitude}, admin1=${match.admin1}, admin2=${match.admin2}, uncertain=${q.uncertain}`);
      return { lat: match.latitude, lon: match.longitude, uncertain: q.uncertain };
    }
  }

  console.log('  -> NO MATCH');
  return null;
}

async function main() {
  await testGeocode("Lakhisarai APMC", "Luckeesarai", "Bihar");
  await testGeocode("Saidpurhat APMC", "Samastipur", "Bihar");
  await testGeocode("Ranchi APMC", "Ranchi", "Jharkhand");
  await testGeocode("Parchur APMC", "Prakasam", "Andhra Pradesh");
}

main().catch(console.error);
