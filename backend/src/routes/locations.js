import { Router } from 'express';
import { z } from 'zod';
import { getStates, getDistricts } from '../services/location_service.js';

export const locationsRouter = Router();

const districtsQuerySchema = z.object({
  state: z
    .string({
      required_error: "Query parameter 'state' is required.",
      invalid_type_error: "Query parameter 'state' is required.",
    })
    .trim()
    .min(1, "Query parameter 'state' is required.")
    .max(100),
});

locationsRouter.get('/states', async (req, res, next) => {
  try {
    const data = await getStates();
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

locationsRouter.get('/districts', async (req, res, next) => {
  try {
    const parseResult = districtsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: parseResult.error.errors[0]?.message || "Query parameter 'state' is required.",
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const { state } = parseResult.data;
    const data = await getDistricts(state);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});
