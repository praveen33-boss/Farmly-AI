import { isSupabaseConfigured, getUserFromToken } from '../services/supabase_client.js';

/**
 * Express middleware to verify Supabase JWT in Authorization header.
 */
export async function requireAuth(req, res, next) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      detail:
        'Authentication service is currently unavailable. SUPABASE_URL and SUPABASE_ANON_KEY must be configured in .env.',
      source: 'auth_configuration',
      retryable: false,
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      detail: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      source: 'auth',
      retryable: false,
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      detail: 'Bearer token is empty.',
      source: 'auth',
      retryable: false,
    });
  }

  try {
    const user = await getUserFromToken(token);
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({
      detail: err.message || 'Invalid or expired session token.',
      source: 'auth',
      retryable: false,
    });
  }
}
