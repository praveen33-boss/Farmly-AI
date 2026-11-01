import { Groq } from 'groq-sdk';
import { config } from '../config.js';
import { getWeather, getLiveSoil } from './weather_service.js';
import { getMandiPrices, getPricesTrend } from './mandi_service.js';

let groqClient = null;

function getGroqClient() {
  if (!groqClient) {
    if (!config.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }
    groqClient = new Groq({ apiKey: config.GROQ_API_KEY });
  }
  return groqClient;
}

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description:
        'Fetch live weather conditions, 5-day / 3-hour forecast with rain probabilities, and derived weather alerts for a city or coordinates.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City, town, or district name in India (e.g. Ranchi, Khunti)' },
          lat: { type: 'number', description: 'Latitude' },
          lon: { type: 'number', description: 'Longitude' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_prices',
      description:
        'Fetch live mandi prices from data.gov.in Agmarknet for a crop/commodity and state/district, including modal prices and transport deductions.',
      parameters: {
        type: 'object',
        properties: {
          commodity: { type: 'string', description: 'Crop or commodity name (e.g. Maize, Paddy, Tomato, Wheat)' },
          state: { type: 'string', description: 'Indian state (e.g. Jharkhand, Andhra Pradesh, Rajasthan)' },
          district: { type: 'string', description: 'District name (optional)' },
          transport_rate_per_km: {
            type: 'number',
            description: 'User-specified transport rate per km per quintal in rupees (optional)',
          },
        },
        required: ['commodity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_price_trend',
      description: 'Check whether mandi prices for a commodity are trending up, down, or have insufficient historical data.',
      parameters: {
        type: 'object',
        properties: {
          commodity: { type: 'string', description: 'Crop or commodity name' },
          state: { type: 'string', description: 'Indian state' },
        },
        required: ['commodity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_soil_conditions',
      description: 'Fetch real physical soil moisture percentage and soil temperature from Open-Meteo.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City or district name' },
          lat: { type: 'number', description: 'Latitude' },
          lon: { type: 'number', description: 'Longitude' },
        },
      },
    },
  },
];

/**
 * Lightweight off-topic check.
 */
function isOffTopicQuery(query) {
  const q = query.toLowerCase();
  const agriculturalKeywords = [
    'crop', 'weather', 'rain', 'mandi', 'price', 'soil', 'water', 'irrigation',
    'paddy', 'wheat', 'maize', 'tomato', 'potato', 'fertilizer', 'pest', 'seed',
    'farm', 'harvest', 'sell', 'market', 'spray', 'temperature', 'humidity',
    'मौसम', 'बारिश', 'फसल', 'मंडी', 'भाव', 'खाद', 'पानी', 'सिंचाई', 'धान', 'गेहूं',
    'వర్షం', 'పంట', 'ధర', 'మండి', 'ఎరువు', 'వరి',
  ];
  // If the query is long enough and contains none of the agricultural keywords or is clearly code/politics
  const containsAgri = agriculturalKeywords.some((kw) => q.includes(kw));
  const clearlyOffTopic = /\b(javascript|python|react|crypto|bitcoin|election|football|movie|song)\b/i.test(q);
  return clearlyOffTopic && !containsAgri;
}

/**
 * Execute a tool call against the backend services.
 */
async function executeTool(toolName, args, userContext) {
  const t0 = Date.now();
  try {
    let result = null;
    let source = '';
    let fetched_at = '';

    if (toolName === 'get_weather') {
      const city = args.city || userContext.city || userContext.district || 'Ranchi';
      const data = await getWeather({ city, lat: args.lat, lon: args.lon });
      source = data.source;
      fetched_at = data.fetched_at;
      result = {
        location: data.location,
        current: data.current,
        next_36h_slots: data.forecast_5day.slice(0, 12).map((s) => ({
          time: s.time,
          temp_c: s.temp_c,
          pop: s.pop,
          rain_mm: s.rain_mm,
          description: s.description,
        })),
        alerts: data.alerts,
        stale: data.stale,
      };
    } else if (toolName === 'get_prices') {
      const commodity = args.commodity || userContext.crop || 'Paddy';
      const state = args.state || userContext.state || '';
      const district = args.district || userContext.district || '';
      const data = await getMandiPrices({
        commodity,
        state,
        district,
        transport_rate_per_km: args.transport_rate_per_km,
        user_lat: userContext.lat,
        user_lon: userContext.lon,
        limit: 10,
      });
      source = data.source;
      fetched_at = data.fetched_at;
      result = {
        summary: data.summary,
        top_records: (data.records || []).slice(0, 5).map((r) => ({
          market: r.market,
          district: r.district,
          state: r.state,
          modal_price: r.modal_price,
          arrival_date: r.arrival_date,
          distance_km: r.distance_km,
          estimated_net_per_q: r.estimated_net_per_q,
        })),
        recommendation: data.recommendation,
        stale: data.stale,
      };
    } else if (toolName === 'get_price_trend') {
      const commodity = args.commodity || userContext.crop || 'Paddy';
      const state = args.state || userContext.state || '';
      const data = await getPricesTrend({ commodity, state });
      source = data.source;
      fetched_at = data.fetched_at;
      result = data;
    } else if (toolName === 'get_soil_conditions') {
      const city = args.city || userContext.city || userContext.district || 'Ranchi';
      const data = await getLiveSoil({ city, lat: args.lat, lon: args.lon });
      source = data.source;
      fetched_at = data.fetched_at;
      result = data;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    return {
      ok: true,
      data: result,
      source,
      fetched_at,
      latency_ms: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      source: 'tool_execution',
      fetched_at: new Date().toISOString(),
      latency_ms: Date.now() - t0,
    };
  }
}

/**
 * Main agent method: POST /api/advice
 */
export async function getAdvice({ question, crop, state, district, city, language = 'English', lat, lon }) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question is required');
  }

  const cleanQuestion = question.trim().slice(0, 500);

  // Guardrail check
  if (isOffTopicQuery(cleanQuestion)) {
    return {
      answer:
        language === 'हिंदी'
          ? 'नमस्ते! मैं फार्मली एआई (Farmly AI) हूँ, जो विशेष रूप से किसानों की मदद के लिए बनाया गया है। मैं मौसम, फसल, खाद, और मंडी भाव से जुड़े सवालों के जवाब दे सकता हूँ। कृपया अपनी खेती से संबंधित कोई सवाल पूछें।'
          : 'Hello! I am Farmly AI, dedicated exclusively to assisting farmers with live weather forecasts, mandi prices, crop protection, and soil conditions. Please ask any farming or agricultural question!',
      steps: [],
      sources: [],
      warnings: ['Query classified as non-agricultural; redirected politely.'],
    };
  }

  const groq = getGroqClient();
  const model = config.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const userContext = {
    crop: crop || 'Paddy',
    state: state || 'Jharkhand',
    district: district || 'Khunti',
    city: city || district || 'Khunti',
    language: language || 'English',
    lat,
    lon,
  };

  const systemPrompt = `You are Farmly AI, an expert agricultural advisor assisting Indian farmers.
You provide honest, grounded, practical advice in the farmer's preferred language.

FARMER CONTEXT:
- Preferred Language: ${userContext.language}
- Farmer Crop: ${userContext.crop}
- Farmer Location: ${userContext.city}, ${userContext.district}, ${userContext.state}

AVAILABLE TOOLS (STRICT):
You have access ONLY to these exact 4 tools:
1. get_weather(city, lat, lon)
2. get_prices(commodity, state, district, transport_rate_per_km)
3. get_price_trend(commodity, state)
4. get_soil_conditions(city, lat, lon)
Do NOT call any other tool name (do NOT invent tools like 'commentary', 'search', 'query', etc.). If you want to explain, speak, or give commentary, output normal text directly.

STRICT ANTI-HALLUCINATION RULES:
1. Grounding: You MUST ONLY cite numbers (temperature, rain probability, modal prices, soil moisture) that were returned by your tool calls.
2. Attribution: Whenever you mention a figure, state the upstream source (e.g. OpenWeather, data.gov.in Agmarknet, Open-Meteo).
3. Honest failure: If a tool returns an error or 0 records, YOU MUST EXPLICITLY STATE that live data is currently unavailable from the official source. NEVER guess or invent prices or weather.
4. Actionable agronomic advice: Give clear sell/hold, irrigation, drainage, or pesticide-spraying guidance based on the numbers retrieved.
5. Language: Always reply in ${userContext.language}. If Hindi or Telugu, use natural, clear phrasing suitable for rural farmers.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: cleanQuestion },
  ];

  const steps = [];
  const sourcesMap = new Map();
  const warnings = [];

  let finalAnswer = '';
  const maxIterations = 5;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let response;
    try {
      response = await groq.chat.completions.create({
        model,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.2, // Low temperature for factual consistency
        max_tokens: 800,
      });
    } catch (groqErr) {
      if (groqErr.message?.includes('tool') || groqErr.status === 400) {
        console.warn(`[LLM Agent] Groq tool error caught (${groqErr.message}), recovering with text completion...`);
        warnings.push(`LLM tool call recovery triggered: ${groqErr.message.slice(0, 100)}`);
        response = await groq.chat.completions.create({
          model,
          messages: [
            ...messages,
            {
              role: 'system',
              content:
                'Do not call any functions. Provide your final advice directly in text in the requested language.',
            },
          ],
          temperature: 0.2,
          max_tokens: 600,
        });
      } else {
        throw groqErr;
      }
    }

    const choice = response.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      warnings.push('Model returned an empty response choice.');
      break;
    }

    // If the model called tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        let functionArgs = {};
        try {
          functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          functionArgs = {};
        }

        const toolResult = await executeTool(functionName, functionArgs, userContext);

        steps.push({
          tool: functionName,
          args: functionArgs,
          ok: toolResult.ok,
          latency_ms: toolResult.latency_ms,
        });

        if (toolResult.source) {
          sourcesMap.set(toolResult.source, {
            source: toolResult.source,
            fetched_at: toolResult.fetched_at,
          });
        }

        if (!toolResult.ok) {
          warnings.push(`Tool ${functionName} failed: ${toolResult.error}`);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(toolResult.ok ? toolResult.data : { error: toolResult.error }),
        });
      }
    } else {
      // Model produced text answer
      finalAnswer = assistantMessage.content || '';
      break;
    }
  }

  // Fallback if loop ended without content
  if (!finalAnswer) {
    const fallbackResponse = await groq.chat.completions.create({
      model,
      messages: [
        ...messages,
        {
          role: 'user',
          content:
            'Please summarize your final agricultural advice for the farmer based on the tool results gathered so far.',
        },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });
    finalAnswer = fallbackResponse.choices?.[0]?.message?.content || 'Data retrieved. Please verify with local agricultural office.';
  }

  return {
    answer: finalAnswer,
    steps,
    sources: Array.from(sourcesMap.values()),
    warnings,
  };
}
