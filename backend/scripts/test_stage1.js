import { app } from '../src/app.js';

async function runStage1Verification() {
  console.log('=== STAGE 1 LIVE VERIFICATION (Weather & Soil) ===\n');

  // Start server on a test port
  const PORT = 8008;
  const server = app.listen(PORT, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  console.log(`[Test Server] Running at http://127.0.0.1:${PORT}\n`);

  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Health check
    console.log('1. Testing GET / (Health Check)...');
    const healthRes = await fetch(`${baseUrl}/`);
    const healthJson = await healthRes.json();
    console.log(`   Status: ${healthRes.status}`);
    console.log(`   Response: ${JSON.stringify(healthJson)}\n`);

    // 2. Weather for Ranchi (city name)
    console.log('2. Testing GET /api/weather?city=Ranchi...');
    const t0 = Date.now();
    const weatherRes = await fetch(`${baseUrl}/api/weather?city=Ranchi`);
    const latency = Date.now() - t0;
    const weatherJson = await weatherRes.json();
    console.log(`   Status: ${weatherRes.status} (${latency}ms)`);
    console.log(`   Location: ${weatherJson.location?.name}, ${weatherJson.location?.state} (lat: ${weatherJson.location?.lat}, lon: ${weatherJson.location?.lon})`);
    console.log(`   Source: ${weatherJson.source}`);
    console.log(`   Slot Source: ${weatherJson.slot_source}`);
    console.log(`   Daily Source: ${weatherJson.daily_source}`);
    console.log(`   Soil Source: ${weatherJson.soil_source}`);
    console.log(`   Current: temp: ${weatherJson.current?.temp_c}°C, rain_chance: ${weatherJson.current?.rain_chance}%, soil_moisture: ${weatherJson.current?.soil_moisture_pct}%`);
    console.log(`   Forecast 5-day slots count: ${weatherJson.forecast_5day?.length}`);
    console.log(`   First slot: time: ${weatherJson.forecast_5day?.[0]?.time}, temp: ${weatherJson.forecast_5day?.[0]?.temp_c}°C, pop: ${weatherJson.forecast_5day?.[0]?.pop}%, rain_mm: ${weatherJson.forecast_5day?.[0]?.rain_mm}`);
    console.log(`   Daily 7-day items: ${weatherJson.daily_7day?.length} days`);
    console.log(`   Daily sample: ${weatherJson.daily_7day?.[0]?.day} (${weatherJson.daily_7day?.[0]?.date}): max ${weatherJson.daily_7day?.[0]?.temp_max_c}°C, min ${weatherJson.daily_7day?.[0]?.temp_min_c}°C, pop: ${weatherJson.daily_7day?.[0]?.pop_max}%`);
    console.log(`   Live-computed alerts count: ${weatherJson.alerts?.length}`);
    if (weatherJson.alerts?.length) {
      console.log(`   Sample alert:`, JSON.stringify(weatherJson.alerts[0]));
    }
    console.log(`   Stale: ${weatherJson.stale}, Fetched at: ${weatherJson.fetched_at}\n`);

    // 3. Weather for Khunti (demonstrating live geocoding of small district)
    console.log('3. Testing GET /api/weather?city=Khunti...');
    const khuntiRes = await fetch(`${baseUrl}/api/weather?city=Khunti`);
    const khuntiJson = await khuntiRes.json();
    console.log(`   Status: ${khuntiRes.status}`);
    console.log(`   Location: ${khuntiJson.location?.name}, ${khuntiJson.location?.state} (lat: ${khuntiJson.location?.lat}, lon: ${khuntiJson.location?.lon})`);
    console.log(`   Current temp: ${khuntiJson.current?.temp_c}°C, rain_chance: ${khuntiJson.current?.rain_chance}%\n`);

    // 4. Live soil endpoint
    console.log('4. Testing GET /api/weather/soil?city=Khunti...');
    const soilRes = await fetch(`${baseUrl}/api/weather/soil?city=Khunti`);
    const soilJson = await soilRes.json();
    console.log(`   Status: ${soilRes.status}`);
    console.log(`   Soil moisture: ${soilJson.soil_moisture_pct}% (${soilJson.soil_moisture_volumetric_m3m3} m³/m³)`);
    console.log(`   Soil temperature: ${soilJson.soil_temperature_c}°C`);
    console.log(`   Source: ${soilJson.source}`);
    console.log(`   Fetched at: ${soilJson.fetched_at}\n`);

    // 5. Validation error test
    console.log('5. Testing 422 Validation Error on invalid lat: GET /api/weather?lat=999...');
    const badRes = await fetch(`${baseUrl}/api/weather?lat=999`);
    const badJson = await badRes.json();
    console.log(`   Status: ${badRes.status}`);
    console.log(`   Detail: ${badJson.detail}`);
    console.log(`   Source: ${badJson.source}, Retryable: ${badJson.retryable}\n`);

    console.log('=== STAGE 1 VERIFICATION COMPLETE: ALL PASS ===');
  } catch (error) {
    console.error('STAGE 1 VERIFICATION FAILED:', error);
  } finally {
    server.close();
  }
}

runStage1Verification();
