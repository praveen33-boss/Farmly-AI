import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getFarmerProfile, updateFarmerProfile } from '../services/supabase_client.js';

export const profileRouter = Router();

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  language: z.string().trim().max(50).optional(),
  state: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  village: z.string().trim().max(100).optional(),
  acres: z.coerce.number().min(0.01).max(10000).optional(),
  land_status: z.string().trim().max(50).optional(),
  crops: z.array(z.string().trim()).optional(),
  soil: z.string().trim().max(50).optional(),
  irrigation: z.string().trim().max(50).optional(),
  experience: z.string().trim().max(50).optional(),
  preferences: z
    .object({
      interaction: z.enum(['voice', 'text']).optional(),
      weatherAlerts: z.boolean().optional(),
      schemeUpdates: z.boolean().optional(),
      cropAlerts: z.boolean().optional(),
    })
    .optional(),
});

/**
 * GET /api/profile
 * Retrieves authenticated farmer profile from Supabase.
 */
profileRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const profile = await getFarmerProfile(req.user.id, req.token);
    if (!profile) {
      return res.status(404).json({
        detail: 'Farmer profile not found. Please complete onboarding.',
        source: 'supabase_profile',
        retryable: false,
      });
    }
    return res.json(profile);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profile
 * Updates authenticated farmer profile in Supabase.
 */
profileRouter.put('/', requireAuth, async (req, res, next) => {
  try {
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(422).json({
        detail: 'Invalid profile update values.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const updated = await updateFarmerProfile(req.user.id, parseResult.data, req.token);
    return res.json({
      message: 'Farmer profile updated successfully.',
      profile: updated,
    });
  } catch (err) {
    next(err);
  }
});
