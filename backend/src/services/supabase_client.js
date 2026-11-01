import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let supabaseAnonClient = null;
let supabaseAdminClient = null;

export function isSupabaseConfigured() {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file and run supabase_schema.sql.'
    );
  }

  if (!supabaseAnonClient) {
    supabaseAnonClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAnonClient;
}

export function getSupabaseAdminClient() {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    // If service role key is not configured, fallback to anon client
    return getSupabaseClient();
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdminClient;
}

/**
 * Creates an authenticated Supabase client for a specific user JWT.
 * Enforces RLS policies for that specific user.
 */
export function getAuthenticatedClient(accessToken) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Sign up a new farmer with email and password.
 */
export async function signUpFarmer({ email, password, name, language = 'English', mobile }) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        language,
        mobile,
      },
    },
  });

  if (error) throw error;

  return {
    user: data.user,
    session: data.session,
  };
}

/**
 * Authenticate a farmer with email and password.
 */
export async function loginFarmer({ email, password }) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return {
    user: data.user,
    session: data.session,
  };
}

/**
 * Invalidate farmer session.
 */
export async function logoutFarmer(accessToken) {
  const userClient = getAuthenticatedClient(accessToken);
  const { error } = await userClient.auth.signOut();
  if (error) throw error;
  return { success: true };
}

/**
 * Retrieve user metadata from access token.
 */
export async function getUserFromToken(accessToken) {
  const userClient = getAuthenticatedClient(accessToken);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    throw new Error(error?.message || 'Invalid or expired authentication token');
  }
  return data.user;
}

/**
 * Fetch profile from public.profiles table under RLS.
 */
export async function getFarmerProfile(userId, accessToken) {
  const client = accessToken ? getAuthenticatedClient(accessToken) : getSupabaseAdminClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
}

/**
 * Update profile in public.profiles table under RLS.
 */
export async function updateFarmerProfile(userId, profileData, accessToken) {
  const client = accessToken ? getAuthenticatedClient(accessToken) : getSupabaseAdminClient();
  const payload = {
    ...profileData,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('profiles')
    .upsert({ id: userId, ...payload })
    .select()
    .single();

  if (error) throw error;
  return data;
}
