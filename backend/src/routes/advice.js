import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getAdvice } from '../services/llm_service.js';

export const adviceRouter = Router();

// Rate limiter: 30 requests per 15 minutes per IP to protect the Groq free tier
const adviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    detail: 'Too many advice requests from this IP, please try again in 15 minutes.',
    source: 'rate_limiter',
    retryable: true,
  },
});

const adviceRequestSchema = z.object({
  question: z.string().trim().min(2, 'Question must be at least 2 characters').max(500, 'Question capped at 500 characters'),
  crop: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  language: z.string().trim().max(50).default('English'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

adviceRouter.post('/', adviceLimiter, async (req, res, next) => {
  try {
    const parseResult = adviceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid advice request body.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const advice = await getAdvice(parseResult.data);
    return res.json(advice);
  } catch (err) {
    next(err);
  }
});
