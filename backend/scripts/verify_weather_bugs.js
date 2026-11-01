async function verify() {
  const places = ["Khunti", "Ranchi", "Hazaribagh"];
  console.log("=== WEATHER API TEST FOR 3 LOCATIONS ===");
  for (const p of places) {
    const res = await fetch(`http://127.0.0.1:8000/api/weather?city=${p}`);
    const data = await res.json();
    console.log(`\nLocation query: "${p}"`);
    console.log(`- Resolved: ${data.location?.name}, ${data.location?.state} (lat: ${data.location?.lat}, lon: ${data.location?.lon})`);
    console.log(`- Current: ${data.current?.temp_c}°C (feels like ${data.current?.feels_like_c}°C), Humidity: ${data.current?.humidity}%, Rain Chance: ${data.current?.rain_chance}%`);
    console.log(`- Soil: Volumetric moisture ${data.soil?.soil_moisture_pct}%, Temp ${data.soil?.soil_temperature_c}°C`);
    console.log(`- Day 0 Forecast: ${data.daily_7day?.[0]?.day} (${data.daily_7day?.[0]?.date}) - High: ${data.daily_7day?.[0]?.temp_max_c}°C, Low: ${data.daily_7day?.[0]?.temp_min_c}°C, Rain: ${data.daily_7day?.[0]?.pop_max}% (${data.daily_7day?.[0]?.label})`);
    console.log(`- Active Alerts: ${data.alerts?.length} (${data.alerts?.[0]?.title || "None"})`);
  }

  console.log("\n=== UNKNOWN LOCATION 404 TEST ===");
  const badRes = await fetch("http://127.0.0.1:8000/api/weather?city=NonExistentTown12345");
  const badData = await badRes.json();
  console.log(`Status: ${badRes.status}`);
  console.log(`Body: ${JSON.stringify(badData)}`);
}

verify().catch(console.error);
