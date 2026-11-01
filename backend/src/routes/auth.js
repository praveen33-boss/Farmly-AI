import { Router } from 'express';
import { z } from 'zod';
import {
  isSupabaseConfigured,
  signUpFarmer,
  loginFarmer,
  logoutFarmer,
  getFarmerProfile,
} from '../services/supabase_client.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').default('Farmer'),
  language: z.string().trim().default('English'),
  mobile: z.string().trim().regex(/^\d{10}$/, 'Mobile must be a 10-digit number').optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/signup
 */
authRouter.post('/signup', async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        detail:
          'Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to .env and execute supabase_schema.sql.',
        source: 'supabase_auth',
        retryable: false,
      });
    }

    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        detail: parseResult.error.errors[0]?.message || 'Invalid registration input.',
        source: 'validation',
        retryable: false,
        errors: parseResult.error.errors,
      });
    }

    const { email, password, name, language, mobile } = parseResult.data;

    try {
      const { user, session } = await signUpFarmer({ email, password, name, language, mobile });

      // Fetch or initialize profile
      let profile = null;
      if (user?.id) {
        try {
          profile = await getFarmerProfile(user.id, session?.access_token);
        } catch {
          // If profile table trigger hasn't fired yet
          profile = { id: user.id, email, name, language, mobile };
        }
      }

      return res.status(201).json({
        message: 'Farmer account created successfully.',
        access_token: session?.access_token || null,
        refresh_token: session?.refresh_token || null,
        token_type: 'Bearer',
        user: {
          id: user?.id,
          email: user?.email,
          name,
          language,
        },
        profile,
      });
    } catch (authErr) {
      const msg = authErr.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('exists')) {
        return res.status(409).json({
          detail: 'An account with this email address already exists. Please log in.',
          source: 'supabase_auth',
          retryable: false,
        });
      }
      return res.status(400).json({
        detail: msg,
        source: 'supabase_auth',
        retryable: false,
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        detail:
          'Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to .env.',
        source: 'supabase_auth',
        retryable: false,
      });
    }

    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        detail: parseResult.error.errors[0]?.message || 'Invalid login credentials format.',
        source: 'validation',
        retryable: false,
      });
    }

    const { email, password } = parseResult.data;

    try {
      const { user, session } = await loginFarmer({ email, password });
      const profile = await getFarmerProfile(user.id, session?.access_token);

      return res.json({
        message: 'Login successful.',
        access_token: session?.access_token,
        refresh_token: session?.refresh_token,
        token_type: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
        },
        profile: profile || {
          id: user.id,
          name: user.user_metadata?.name || 'Farmer',
          language: user.user_metadata?.language || 'English',
        },
      });
    } catch (authErr) {
      return res.status(401).json({
        detail: 'Invalid email or password. Please verify your credentials.',
        source: 'supabase_auth',
        retryable: false,
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await logoutFarmer(req.token);
    return res.json({ message: 'Successfully logged out.', source: 'supabase_auth' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await getFarmerProfile(req.user.id, req.token);
    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        phone: req.user.phone,
        created_at: req.user.created_at,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
});
