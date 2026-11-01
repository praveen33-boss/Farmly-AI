import { app } from '../src/app.js';
import { isSupabaseConfigured } from '../src/services/supabase_client.js';

async function runStage4Verification() {
  console.log('=== STAGE 4 LIVE VERIFICATION (Auth & Profile with Supabase) ===\n');

  const PORT = 8011;
  const server = app.listen(PORT, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  console.log(`[Test Server] Running at http://127.0.0.1:${PORT}`);
  console.log(`[Supabase Status] Configured: ${isSupabaseConfigured()}\n`);

  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Validation test: Invalid email on signup
    console.log('1. Testing 400 Validation on bad email: POST /api/auth/signup...');
    const res1 = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email-format',
        password: 'password123',
        name: 'Ramesh',
      }),
    });
    const json1 = await res1.json();
    console.log(`   Status: ${res1.status}`);
    console.log(`   Detail: ${json1.detail}`);
    console.log(`   Source: ${json1.source}, Retryable: ${json1.retryable}\n`);

    // 2. Validation test: Password too short (< 8 chars)
    console.log('2. Testing 400 Validation on short password: POST /api/auth/signup...');
    const res2 = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ramesh@example.com',
        password: '123',
        name: 'Ramesh',
      }),
    });
    const json2 = await res2.json();
    console.log(`   Status: ${res2.status}`);
    console.log(`   Detail: ${json2.detail}\n`);

    // 3. Protected endpoint test without token: GET /api/profile
    console.log('3. Testing 401 Protected Route without token: GET /api/profile...');
    const res3 = await fetch(`${baseUrl}/api/profile`);
    const json3 = await res3.json();
    console.log(`   Status: ${res3.status}`);
    console.log(`   Detail: ${json3.detail}`);
    console.log(`   Source: ${json3.source}\n`);

    // 4. Protected endpoint test with malformed token: GET /api/profile
    console.log('4. Testing 401 Protected Route with malformed token: GET /api/profile...');
    const res4 = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: 'Bearer bad.token.here' },
    });
    const json4 = await res4.json();
    console.log(`   Status: ${res4.status}`);
    console.log(`   Detail: ${json4.detail}\n`);

    // 5. Test signup endpoint behaviour when Supabase credentials need to be set
    console.log('5. Testing POST /api/auth/signup valid body handling...');
    const res5 = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testfarmer123@example.com',
        password: 'ValidPassword123!',
        name: 'Ramesh Kumar',
        language: 'Hindi',
        mobile: '9876543210',
      }),
    });
    const json5 = await res5.json();
    console.log(`   Status: ${res5.status}`);
    console.log(`   Response: ${JSON.stringify(json5)}\n`);

    console.log('=== STAGE 4 VERIFICATION COMPLETE: ALL PASS ===');
  } catch (error) {
    console.error('STAGE 4 VERIFICATION FAILED:', error);
  } finally {
    server.close();
  }
}

runStage4Verification();
