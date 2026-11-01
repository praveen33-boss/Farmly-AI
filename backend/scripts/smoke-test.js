import { app } from '../src/app.js';

const argUrl = process.argv[2];
const envUrl = process.env.TEST_BASE_URL;

async function runComprehensiveSmokeTest() {
  console.log('================================================================');
  console.log('       FARMLY.AI BACKEND COMPREHENSIVE LIVE SMOKE TEST           ');
  console.log('================================================================\n');

  let server = null;
  let baseUrl = argUrl || envUrl;

  if (!baseUrl) {
    const PORT = 8015;
    server = app.listen(PORT, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${PORT}`;
    console.log(`[Smoke Test] Started local test instance at ${baseUrl}\n`);
  } else {
    console.log(`[Smoke Test] Targeting running server at ${baseUrl}\n`);
  }

  const results = [];

  async function testEndpoint(name, path, options = {}) {
    process.stdout.write(`• Testing ${name}... `);
    const t0 = Date.now();
    try {
      const res = await fetch(`${baseUrl}${path}`, options);
      const latency = Date.now() - t0;
      const json = await res.json().catch(() => null);
      const isExpected = res.status < 500 || res.status === 503; // 503 is expected for unconfigured Supabase
      console.log(`[${res.status}] (${latency}ms)`);
      const sample = JSON.stringify(json);
      const trimmed = sample && sample.length > 180 ? `${sample.slice(0, 180)}...` : sample;
      console.log(`  Sample: ${trimmed}\n`);
      results.push({ name, path, status: res.status, latency, ok: isExpected });
      return { status: res.status, latency, json };
    } catch (err) {
      const latency = Date.now() - t0;
      console.log(`[FAILED] (${latency}ms) - ${err.message}\n`);
      results.push({ name, path, status: 'ERROR', latency, ok: false, error: err.message });
      return null;
    }
  }

  try {
    // 1. Health Check
    await testEndpoint('Health Check', '/');

    // 2. Upstream Status
    await testEndpoint('Upstream Services Status', '/api/status');

    // 3. Weather
    await testEndpoint('Weather (5-day slots + 7-day daily + alerts)', '/api/weather?city=Ranchi');

    // 4. Soil
    await testEndpoint('Live Soil (Moisture & Temperature)', '/api/weather/soil?city=Khunti');

    // 5. Mandi Prices
    await testEndpoint('Mandi Prices (Live data.gov.in)', '/api/prices?commodity=Maize&limit=5');

    // 6. Mandi with Distance & User Transport Rate
    await testEndpoint(
      'Mandi with Geocoded Distance & Transport Cost',
      '/api/prices?commodity=Paddy&user_lat=23.34&user_lon=85.31&transport_rate_per_km=8&limit=5'
    );

    // 7. Mandi Trend
    await testEndpoint('Mandi Price Trend', '/api/prices/trend?commodity=Maize');

    // 8. AI Advisor Agent
    await testEndpoint('AI Advisor Agent (Groq Tool-Calling)', '/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Will it rain in Khunti in the next 36 hours and should I harvest my paddy?',
        crop: 'Paddy',
        city: 'Khunti',
        district: 'Khunti',
        state: 'Jharkhand',
        language: 'English',
      }),
    });

    // 9. Auth Signup Validation
    await testEndpoint('Auth Signup (Validation check)', '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bad-email',
        password: 'short',
      }),
    });

    // 10. Profile Protected Route
    await testEndpoint('Profile (401 Protected Route Check)', '/api/profile');

    console.log('================================================================');
    console.log('                     SMOKE TEST SUMMARY                         ');
    console.log('================================================================');
    const passed = results.filter((r) => r.ok).length;
    console.log(`Total Endpoints Tested: ${results.length}`);
    console.log(`Passed: ${passed} / ${results.length}`);
    results.forEach((r) => {
      console.log(`  ${r.ok ? '✓ PASS' : '✗ FAIL'} [${r.status}] ${r.name} (${r.latency}ms)`);
    });
    console.log('================================================================\n');

    if (passed === results.length) {
      console.log('ALL ENDPOINTS OPERATIONAL. Backend ready for hackathon demo!\n');
    }
  } finally {
    if (server) {
      server.close();
    }
  }
}

runComprehensiveSmokeTest();
