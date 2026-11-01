-- =========================================================================
-- Farmly.AI Supabase SQL Schema & Row Level Security (RLS) Setup
-- Run this in your Supabase Project's SQL Editor (Dashboard > SQL Editor)
-- =========================================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  mobile TEXT,
  language TEXT DEFAULT 'English',
  state TEXT DEFAULT 'Jharkhand',
  district TEXT,
  village TEXT,
  acres NUMERIC,
  land_status TEXT DEFAULT 'Owner',
  crops TEXT[] DEFAULT '{}',
  soil TEXT DEFAULT 'Clay loam',
  irrigation TEXT DEFAULT 'Rain-fed',
  experience TEXT DEFAULT 'New to farming',
  preferences JSONB DEFAULT '{"interaction": "voice", "weatherAlerts": true, "schemeUpdates": true, "cropAlerts": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create advice_history table
CREATE TABLE IF NOT EXISTS public.advice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  crop TEXT,
  location TEXT,
  language TEXT DEFAULT 'English',
  steps JSONB DEFAULT '[]'::jsonb,
  sources JSONB DEFAULT '[]'::jsonb,
  warnings TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advice_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for profiles
-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. RLS Policies for advice_history
DROP POLICY IF EXISTS "Users can view own advice history" ON public.advice_history;
DROP POLICY IF EXISTS "Users can insert own advice history" ON public.advice_history;

CREATE POLICY "Users can view own advice history"
  ON public.advice_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own advice history"
  ON public.advice_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Trigger to automatically create a profile row upon new Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    language,
    mobile,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'Farmer'),
    COALESCE(new.raw_user_meta_data->>'language', 'English'),
    COALESCE(new.raw_user_meta_data->>'mobile', NULL),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_advice_history_user_id ON public.advice_history(user_id);
CREATE INDEX IF NOT EXISTS idx_advice_history_created_at ON public.advice_history(created_at DESC);
