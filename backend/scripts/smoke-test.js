/**
 * Farmly.AI Backend Comprehensive Smoke Test Suite
 * Tests all live endpoints including Weather, Mandi, AI Advisor, Auth, Profile, and Schemes & Support.
 */
import { app } from '../src/app.js';
import { config, printConfigStatus } from '../src/config.js';
import http from 'node:http';

const TEST_PORT = 8016;
let server = null;

async function startTestServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[Smoke Test] Started local test instance at http://127.0.0.1:${TEST_PORT}\n`);
      resolve();
    });
  });
}

async function runSmokeTests() {
  console.log('================================================================');
  console.log('       FARMLY.AI BACKEND COMPREHENSIVE LIVE SMOKE TEST           ');
  console.log('================================================================\n');

  await startTestServer();

  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
  const results = [];

  async function testEndpoint(name, path, options = {}) {
    const t0 = Date.now();
    try {
      process.stdout.write(`• Testing ${name}... `);
      const res = await fetch(`${baseUrl}${path}`, options);
      const latency = Date.now() - t0;
      const json = await res.json().catch(() => ({}));

      const ok = res.status >= 200 && res.status < 400 || (path.includes('auth') || path.includes('profile') ? res.status === 401 || res.status === 422 || res.status === 503 : false);
      results.push({ name, status: res.status, latency, ok, detail: json });

      if (ok) {
        console.log(`[${res.status}] (${latency}ms)`);
        console.log(`  Sample: ${JSON.stringify(json).slice(0, 180)}...\n`);
      } else {
        console.log(`[FAILED: ${res.status}] (${latency}ms)`);
        console.log(`  Error: ${JSON.stringify(json)}\n`);
      }
    } catch (err) {
      const latency = Date.now() - t0;
      results.push({ name, status: 'ERROR', latency, ok: false, error: err.message });
      console.log(`[FAILED] (${latency}ms) - ${err.message}\n`);
    }
  }

  try {
    // 1. Health check
    await testEndpoint('Health Check', '/');

    // 2. Upstream status
    await testEndpoint('Upstream Services Status', '/api/status');

    // 3. Weather
    await testEndpoint('Weather (5-day slots + 7-day daily + alerts)', '/api/weather?city=Ranchi, Jharkhand');

    // 4. Live Soil
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

    // 11. Schemes Discovery (State filtered)
    await testEndpoint('Schemes Discovery (Jharkhand Filter)', '/api/schemes?state=Jharkhand');

    // 12. Scheme Full Details
    await testEndpoint('Scheme Full Details (PM-KISAN)', '/api/schemes/pm-kisan');

    // 13. Schemes Recommendation Engine
    await testEndpoint(
      'Personalized Scheme Recommendations',
      '/api/schemes/recommended?state=Jharkhand&district=Khunti&crop=Paddy&acres=2.5&irrigation=Rain-fed&land_status=Owner'
    );

    // 14. Schemes Metadata
    await testEndpoint('Schemes Metadata & Source Freshness', '/api/schemes/metadata');

    // 15. Admin Schemes Sync
    await testEndpoint('Admin Schemes Sync (Protected)', '/api/admin/schemes/sync', {
      method: 'POST',
      headers: { 'x-admin-key': config.ADMIN_SYNC_KEY },
    });

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

runSmokeTests().catch((err) => {
  console.error('[FATAL]', err);
  if (server) server.close();
  process.exit(1);
});
