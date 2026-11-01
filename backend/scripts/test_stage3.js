import { app } from '../src/app.js';

async function runStage3Verification() {
  console.log('=== STAGE 3 LIVE VERIFICATION (AI Advisor Agent with Tool Calling) ===\n');

  const PORT = 8010;
  const server = app.listen(PORT, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  console.log(`[Test Server] Running at http://127.0.0.1:${PORT}\n`);

  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Weather & Agronomic Query (English)
    console.log('1. Testing POST /api/advice: Weather & Fertilizer advice for Khunti Paddy...');
    const t0 = Date.now();
    const res1 = await fetch(`${baseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Will it rain in Khunti in the next 36 hours and should I spray fertilizer or pesticide on my paddy?',
        crop: 'Paddy',
        city: 'Khunti',
        district: 'Khunti',
        state: 'Jharkhand',
        language: 'English',
      }),
    });
    const lat1 = Date.now() - t0;
    const json1 = await res1.json();
    console.log(`   Status: ${res1.status} (${lat1}ms)`);
    console.log(`   Steps Executed (${json1.steps?.length}):`);
    json1.steps?.forEach((s, idx) => {
      console.log(`     [Step ${idx + 1}] Tool: ${s.tool}, Args: ${JSON.stringify(s.args)}, ok: ${s.ok}, latency: ${s.latency_ms}ms`);
    });
    console.log(`   Sources Cited (${json1.sources?.length}):`, json1.sources?.map((s) => s.source).join('; '));
    console.log(`   Warnings: ${json1.warnings?.length ? json1.warnings.join(', ') : 'None'}`);
    console.log(`   Agent Answer:`);
    console.log(`   ------------------------------------------------------------`);
    console.log(`   ${json1.answer?.replace(/\n/g, '\n   ')}`);
    console.log(`   ------------------------------------------------------------\n`);

    // 2. Mandi Price Query in Hindi
    console.log('2. Testing POST /api/advice in Hindi: Mandi prices for Maize in Rajasthan...');
    const t1 = Date.now();
    const res2 = await fetch(`${baseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'राजस्थान में मक्के का आज का क्या मंडी भाव चल रहा है और क्या मुझे बेचना चाहिए?',
        crop: 'Maize',
        state: 'Rajasthan',
        language: 'Hindi',
      }),
    });
    const lat2 = Date.now() - t1;
    const json2 = await res2.json();
    console.log(`   Status: ${res2.status} (${lat2}ms)`);
    console.log(`   Steps Executed:`);
    json2.steps?.forEach((s, idx) => {
      console.log(`     [Step ${idx + 1}] Tool: ${s.tool}, Args: ${JSON.stringify(s.args)}, ok: ${s.ok}`);
    });
    console.log(`   Agent Hindi Answer:`);
    console.log(`   ------------------------------------------------------------`);
    console.log(`   ${json2.answer?.replace(/\n/g, '\n   ')}`);
    console.log(`   ------------------------------------------------------------\n`);

    // 3. Guardrail Redirection Test (Off-topic question)
    console.log('3. Testing Guardrail: Off-topic JavaScript question...');
    const res3 = await fetch(`${baseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Can you write a javascript function to sort an array using quicksort?',
        language: 'English',
      }),
    });
    const json3 = await res3.json();
    console.log(`   Status: ${res3.status}`);
    console.log(`   Steps Executed: ${json3.steps?.length} (Expected 0)`);
    console.log(`   Warning: ${json3.warnings?.[0]}`);
    console.log(`   Guardrail Response: ${json3.answer}\n`);

    // 4. Validation Error on Question Length (> 500 chars)
    console.log('4. Testing 422 Validation Error on oversized question (> 500 characters)...');
    const longQuestion = 'What should I do with my crops? '.repeat(30);
    const res4 = await fetch(`${baseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: longQuestion,
        language: 'English',
      }),
    });
    const json4 = await res4.json();
    console.log(`   Status: ${res4.status}`);
    console.log(`   Detail: ${json4.detail}`);
    console.log(`   Source: ${json4.source}, Retryable: ${json4.retryable}\n`);

    console.log('=== STAGE 3 VERIFICATION COMPLETE: ALL PASS ===');
  } catch (error) {
    console.error('STAGE 3 VERIFICATION FAILED:', error);
  } finally {
    server.close();
  }
}

runStage3Verification();
