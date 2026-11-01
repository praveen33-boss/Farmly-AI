import { Router } from 'express';
import { z } from 'zod';
import { getWeather, getLiveSoil } from '../services/weather_service.js';

export const weatherRouter = Router();

const weatherQuerySchema = z.object({
  city: z.string().trim().min(1).max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

weatherRouter.get('/', async (req, res, next) => {
  try {
    const parseResult = weatherQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid query parameters. Provide city name or valid lat & lon.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const { city, lat, lon } = parseResult.data;
    if (!city && (lat === undefined || lon === undefined)) {
      // Default to Ranchi if none provided
      const data = await getWeather({ city: 'Ranchi' });
      return res.json(data);
    }

    const data = await getWeather({ city, lat, lon });
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

weatherRouter.get('/soil', async (req, res, next) => {
  try {
    const parseResult = weatherQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid query parameters. Provide city name or valid lat & lon.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const { city, lat, lon } = parseResult.data;
    const data = await getLiveSoil({ city: city || 'Ranchi', lat, lon });
    return res.json(data);
  } catch (err) {
    next(err);
  }
});
