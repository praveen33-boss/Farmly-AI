import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import {
  getSchemes,
  getSchemeById,
  recommendSchemesForProfile,
  getSchemesMetadata,
  triggerSchemesSync,
} from '../services/schemes_service.js';
import { getUserFromToken, getFarmerProfile } from '../services/supabase_client.js';

export const schemesRouter = Router();

const schemesQuerySchema = z.object({
  state: z.string().trim().max(100).optional(),
  government_level: z.string().trim().max(50).optional(),
  category: z.string().trim().max(100).optional(),
  crop: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const recommendedQuerySchema = z.object({
  state: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  village: z.string().trim().max(100).optional(),
  crop: z.string().trim().max(100).optional(),
  crops: z.string().trim().max(200).optional(),
  acres: z.coerce.number().min(0.01).max(10000).optional(),
  land_status: z.string().trim().max(50).optional(),
  irrigation: z.string().trim().max(50).optional(),
  experience: z.string().trim().max(50).optional(),
  farmer_category: z.string().trim().max(50).optional(),
});

/**
 * Admin authentication middleware.
 * Verifies x-admin-key or bearer token matching ADMIN_SYNC_KEY or SUPABASE_SERVICE_ROLE_KEY.
 */
function requireAdminAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const validKey = config.ADMIN_SYNC_KEY;
  const serviceKey = config.SUPABASE_SERVICE_ROLE_KEY;

  if (
    (adminKey && (adminKey === validKey || (serviceKey && adminKey === serviceKey))) ||
    (token && (token === validKey || (serviceKey && token === serviceKey)))
  ) {
    return next();
  }

  return res.status(403).json({
    detail: 'Unauthorized: Valid admin authorization key is required to trigger synchronization.',
    source: 'admin_auth',
    retryable: false,
  });
}

/**
 * GET /api/schemes/metadata
 * Source information, last synchronization time, and data freshness.
 */
schemesRouter.get('/metadata', async (req, res, next) => {
  try {
    const meta = await getSchemesMetadata();
    return res.json(meta);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/schemes/recommended
 * Personalized scheme recommendation engine using farmer profile.
 * Supports authenticated session profile or query parameter fallback.
 */
schemesRouter.get('/recommended', async (req, res, next) => {
  try {
    const parseResult = recommendedQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid profile recommendation parameters.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    let profile = parseResult.data;

    // If an Authorization Bearer token is provided, try loading the saved farmer profile
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const user = await getUserFromToken(token);
        if (user?.id) {
          const dbProfile = await getFarmerProfile(user.id, token);
          if (dbProfile) {
            profile = {
              ...dbProfile,
              ...Object.fromEntries(Object.entries(profile).filter(([_, v]) => v !== undefined)),
            };
          }
        }
      } catch {
        // Fall back gracefully to query params if token is invalid or Supabase unconfigured
      }
    }

    const recommendations = await recommendSchemesForProfile(profile);
    return res.json(recommendations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/schemes
 * Retrieve available schemes with filtering and pagination.
 */
schemesRouter.get('/', async (req, res, next) => {
  try {
    const parseResult = schemesQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid schemes query parameters.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const data = await getSchemes(parseResult.data);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/schemes/:id
 * Retrieve full details of a specific scheme.
 */
schemesRouter.get('/:id', async (req, res, next) => {
  try {
    const scheme = await getSchemeById(req.params.id);
    if (!scheme) {
      return res.status(404).json({
        detail: `Scheme with ID '${req.params.id}' was not found.`,
        source: 'schemes_registry',
        retryable: false,
      });
    }
    return res.json(scheme);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/schemes/sync (and /api/admin/schemes/sync)
 * Protected administrative sync trigger.
 */
schemesRouter.post('/sync', requireAdminAuth, async (req, res, next) => {
  try {
    const syncResult = await triggerSchemesSync();
    return res.json(syncResult);
  } catch (err) {
    next(err);
  }
});
