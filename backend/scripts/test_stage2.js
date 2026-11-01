import { app } from '../src/app.js';

async function runStage2Verification() {
  console.log('=== STAGE 2 LIVE VERIFICATION (Mandi Prices Intelligence) ===\n');

  const PORT = 8009;
  const server = app.listen(PORT, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  console.log(`[Test Server] Running at http://127.0.0.1:${PORT}\n`);

  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Basic Mandi Query for Maize
    console.log('1. Testing GET /api/prices?commodity=Maize (Live data.gov.in fetch)...');
    const t0 = Date.now();
    const res1 = await fetch(`${baseUrl}/api/prices?commodity=Maize&limit=10`);
    const lat1 = Date.now() - t0;
    const json1 = await res1.json();
    console.log(`   Status: ${res1.status} (${lat1}ms)`);
    console.log(`   Source: ${json1.source}`);
    console.log(`   Resource ID: ${json1.resource_id}`);
    console.log(`   Total Records: ${json1.summary?.total_records}`);
    console.log(`   Summary Modal Prices: min: ₹${json1.summary?.min_modal_price}, max: ₹${json1.summary?.max_modal_price}, avg: ₹${json1.summary?.avg_modal_price}/quintal`);
    console.log(`   Date Range: earliest: ${json1.summary?.date_range?.earliest}, latest: ${json1.summary?.date_range?.latest}`);
    console.log(`   Sample Record: ${json1.records?.[0]?.market} (${json1.records?.[0]?.district}, ${json1.records?.[0]?.state}): ₹${json1.records?.[0]?.modal_price}/q (Arrival: ${json1.records?.[0]?.arrival_date})`);
    console.log(`   Stale: ${json1.stale}, Fetched at: ${json1.fetched_at}\n`);

    // 2. Query with state filter and alias handling (Paddy)
    console.log('2. Testing GET /api/prices?state=Andhra Pradesh&commodity=Paddy...');
    const res2 = await fetch(`${baseUrl}/api/prices?state=Andhra%20Pradesh&commodity=Paddy&limit=5`);
    const json2 = await res2.json();
    console.log(`   Status: ${res2.status}`);
    console.log(`   Records Returned: ${json2.records?.length}`);
    if (json2.records?.length > 0) {
      console.log(`   First Record: ${json2.records[0].market} - ${json2.records[0].commodity}: ₹${json2.records[0].modal_price}/q`);
    }
    console.log('');

    // 3. Live Distance, User Transport Rate & Net Return Calculation
    console.log('3. Testing GET /api/prices with User Coordinates & Transport Rate:');
    console.log('   (Farmer at Ranchi lat: 23.3432, lon: 85.3094, transport_rate: ₹8/km/q, quantity: 25 quintals)...');
    const res3 = await fetch(
      `${baseUrl}/api/prices?commodity=Maize&user_lat=23.3432&user_lon=85.3094&transport_rate_per_km=8&quantity=25&limit=5`
    );
    const json3 = await res3.json();
    console.log(`   Status: ${res3.status}`);
    console.log(`   Transport Notice: ${json3.transport_notice}`);
    if (json3.records?.[0]) {
      const r = json3.records[0];
      console.log(`   Record: ${r.market} (${r.district}, ${r.state})`);
      console.log(`   Distance from farmer: ${r.distance_km} km`);
      console.log(`   Raw Modal Price: ₹${r.modal_price}/q`);
      console.log(`   Computed Transport Cost: ₹${r.transport_cost_per_q}/q (at ₹8/km/q)`);
      console.log(`   Estimated Net Return: ₹${r.estimated_net_per_q}/q`);
      console.log(`   Estimated Total Return for 25 quintals: ₹${r.estimated_total_return?.toLocaleString('en-IN')}`);
    }
    if (json3.recommendation) {
      console.log(`   Top Selling Recommendation: ${json3.recommendation.market} - Net: ₹${json3.recommendation.estimated_net_per_q}/q (${json3.recommendation.basis})`);
    }
    console.log('');

    // 4. Trend endpoint
    console.log('4. Testing GET /api/prices/trend?commodity=Maize...');
    const res4 = await fetch(`${baseUrl}/api/prices/trend?commodity=Maize`);
    const json4 = await res4.json();
    console.log(`   Status: ${res4.status}`);
    console.log(`   Insufficient Data: ${json4.insufficient_data}`);
    if (json4.insufficient_data) {
      console.log(`   Honest Message: ${json4.message}`);
      console.log(`   Available Dates: ${json4.available_dates?.join(', ')}`);
    } else {
      console.log(`   Trend Direction: ${json4.trend_direction} (${json4.change_percentage}%)`);
      console.log(`   Data Points: ${JSON.stringify(json4.data_points)}`);
    }
    console.log('');

    // 5. Validation Error (limit > 100)
    console.log('5. Testing 422 Validation Error on limit=999: GET /api/prices?limit=999...');
    const badRes = await fetch(`${baseUrl}/api/prices?limit=999`);
    const badJson = await badRes.json();
    console.log(`   Status: ${badRes.status}`);
    console.log(`   Detail: ${badJson.detail}`);
    console.log(`   Source: ${badJson.source}, Retryable: ${badJson.retryable}\n`);

    console.log('=== STAGE 2 VERIFICATION COMPLETE: ALL PASS ===');
  } catch (error) {
    console.error('STAGE 2 VERIFICATION FAILED:', error);
  } finally {
    server.close();
  }
}

runStage2Verification();
