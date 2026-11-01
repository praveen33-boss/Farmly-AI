import { Router } from 'express';
import { z } from 'zod';
import { getMandiPrices, getPricesTrend } from '../services/mandi_service.js';

export const pricesRouter = Router();

const pricesQuerySchema = z.object({
  state: z.string().trim().max(100).optional(),
  commodity: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  market: z.string().trim().max(100).optional(),
  user_lat: z.coerce.number().min(-90).max(90).optional(),
  user_lon: z.coerce.number().min(-180).max(180).optional(),
  user_district: z.string().trim().max(100).optional(),
  user_state: z.string().trim().max(100).optional(),
  transport_rate: z.coerce.number().min(0).max(1000).optional(),
  transport_rate_per_km: z.coerce.number().min(0).max(1000).optional(),
  quantity_q: z.coerce.number().min(0.1).max(100000).optional(),
  quantity: z.coerce.number().min(0.1).max(100000).optional(),
  max_km: z.coerce.number().min(1).max(5000).default(100),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const trendQuerySchema = z.object({
  state: z.string().trim().max(100).optional(),
  commodity: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  market: z.string().trim().max(100).optional(),
});

pricesRouter.get('/', async (req, res, next) => {
  try {
    const parseResult = pricesQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid mandi query parameters.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const parsed = parseResult.data;
    const normalizedQuery = {
      ...parsed,
      transport_rate: parsed.transport_rate ?? parsed.transport_rate_per_km,
      quantity: parsed.quantity_q ?? parsed.quantity ?? 1,
      quantity_q: parsed.quantity_q ?? parsed.quantity ?? 1,
      max_km: parsed.max_km ?? 100,
    };

    const data = await getMandiPrices(normalizedQuery);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

pricesRouter.get('/trend', async (req, res, next) => {
  try {
    const parseResult = trendQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid trend query parameters.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const data = await getPricesTrend(parseResult.data);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});
