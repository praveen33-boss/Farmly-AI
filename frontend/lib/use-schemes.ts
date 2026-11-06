"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "./api";

export interface SchemeBenefits {
  amount?: string;
  frequency?: string;
  transfer_mode?: string;
  additional_support?: string;
}

export interface SchemeRecord {
  scheme_id: string;
  scheme_name: string;
  full_name: string;
  description: string;
  short_description: string;
  scheme_category: string;
  government_level: "Central" | "State";
  state: string;
  ministry_or_department: string;
  benefits: SchemeBenefits | string;
  eligibility_criteria: string[];
  required_documents: string[];
  application_process: string[];
  official_application_url: string;
  official_information_url: string;
  source_name: string;
  source_url: string;
  data_gov_resource_id?: string | null;
  last_verified_at: string;
  last_updated_at: string;
  data_status: "verified" | "requires_local_confirmation" | "unverified";
  color: string;
  mark: string;
  fit?: "Eligibility confirmed" | "Potentially relevant" | "More information needed" | "Not applicable in your state" | string;
  fit_status?: "eligible" | "potential" | "needs_info" | "not_applicable";
  match_score?: number;
  applicable_location?: string;
  match_reasons?: string[];
  missing_information?: string[];
  disclaimer?: string;
  live_data?: {
    source_feed?: string;
    resource_id?: string;
    title?: string;
    latest_installment_release_no?: number;
    quadrimester_no?: number;
    total_records_tracked?: number;
    fetched_at?: string;
    status?: string;
  } | null;
}

export interface SchemesListResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  filters: {
    state: string | null;
    government_level: string | null;
    category: string | null;
    crop: string | null;
    search: string | null;
  };
  last_synced_at: string;
  schemes: SchemeRecord[];
}

export interface SchemesRecommendedResponse {
  farmer_profile_applied: {
    state: string;
    district: string;
    crop: string;
    acres: number;
    land_status: string;
    irrigation: string;
    farmer_category: string;
  };
  summary: {
    total_explored: number;
    confirmed_count: number;
    potential_count: number;
    needs_info_count: number;
    official_approvals_claimed: number;
  };
  recommendations: SchemeRecord[];
}

export interface SchemesMetadataResponse {
  status: string;
  total_schemes: number;
  verified_schemes: number;
  central_schemes_count: number;
  state_schemes_count: number;
  last_synced_at: string;
  sync_count: number;
  sync_status: string;
  data_freshness_notice: string;
  sources: Record<
    string,
    {
      name: string;
      url: string;
      configured?: boolean;
      status: string;
      last_check: string;
      verification_level?: string;
      resources_tracked?: Array<{ id: string; title: string }>;
    }
  >;
}

// In-memory module cache to prevent UI flicker
const schemesCache = new Map<string, { data: SchemesListResponse; timestamp: number }>();
const recommendedCache = new Map<string, { data: SchemesRecommendedResponse; timestamp: number }>();
let metadataCache: { data: SchemesMetadataResponse; timestamp: number } | null = null;

const CACHE_TTL_MS = 60_000; // 1 minute

export interface SchemesFilterParams {
  category?: string;
  state?: string;
  crop?: string;
  search?: string;
  government_level?: string;
}

/**
 * Hook to discover government schemes with filtering and search.
 */
export function useSchemes(filters: SchemesFilterParams = {}) {
  const [data, setData] = useState<SchemesListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const activeReqRef = useRef<number>(0);

  const fetchSchemes = useCallback(
    async (isManualRefresh = false) => {
      const requestId = ++activeReqRef.current;
      const params = new URLSearchParams();
      if (filters.category && filters.category !== "All schemes" && filters.category !== "All") {
        params.set("category", filters.category);
      }
      if (filters.state && filters.state !== "All India" && filters.state !== "All states") {
        params.set("state", filters.state);
      }
      if (filters.crop && filters.crop !== "All crops") {
        params.set("crop", filters.crop);
      }
      if (filters.government_level) {
        params.set("government_level", filters.government_level);
      }
      if (filters.search && filters.search.trim()) {
        params.set("search", filters.search.trim());
      }
      params.set("limit", "50");

      const cacheKey = params.toString();
      const cached = schemesCache.get(cacheKey);

      if (!isManualRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setData(cached.data);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const queryStr = cacheKey ? `?${cacheKey}` : "";
        const json = await apiGet<SchemesListResponse>(`/api/schemes${queryStr}`);
        if (requestId !== activeReqRef.current) return;

        schemesCache.set(cacheKey, { data: json, timestamp: Date.now() });
        setData(json);
        setError(null);
      } catch (err: unknown) {
        if (requestId !== activeReqRef.current) return;
        const msg = err instanceof Error ? err.message : "Failed to load government schemes";
        setError(msg);
      } finally {
        if (requestId === activeReqRef.current) {
          setLoading(false);
        }
      }
    },
    [filters.category, filters.state, filters.crop, filters.search, filters.government_level]
  );

  useEffect(() => {
    fetchSchemes(false);
  }, [fetchSchemes]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchSchemes(true),
  };
}

export interface RecommendationProfileInput {
  state?: string;
  district?: string;
  village?: string;
  crop?: string;
  acres?: string | number;
  land_status?: string;
  irrigation?: string;
  experience?: string;
}

/**
 * Hook to retrieve personalized scheme recommendations for a farmer profile.
 */
export function useRecommendedSchemes(profile: RecommendationProfileInput) {
  const [data, setData] = useState<SchemesRecommendedResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const activeReqRef = useRef<number>(0);

  const fetchRecommendations = useCallback(
    async (isManualRefresh = false) => {
      const requestId = ++activeReqRef.current;
      const params = new URLSearchParams();
      if (profile.state) params.set("state", profile.state);
      if (profile.district) params.set("district", profile.district);
      if (profile.village) params.set("village", profile.village);
      if (profile.crop) params.set("crop", profile.crop);
      if (profile.acres) params.set("acres", String(profile.acres));
      if (profile.land_status) params.set("land_status", profile.land_status);
      if (profile.irrigation) params.set("irrigation", profile.irrigation);
      if (profile.experience) params.set("experience", profile.experience);

      const cacheKey = params.toString();
      const cached = recommendedCache.get(cacheKey);

      if (!isManualRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setData(cached.data);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const queryStr = cacheKey ? `?${cacheKey}` : "";
        const json = await apiGet<SchemesRecommendedResponse>(`/api/schemes/recommended${queryStr}`);
        if (requestId !== activeReqRef.current) return;

        recommendedCache.set(cacheKey, { data: json, timestamp: Date.now() });
        setData(json);
        setError(null);
      } catch (err: unknown) {
        if (requestId !== activeReqRef.current) return;
        const msg = err instanceof Error ? err.message : "Failed to load personalized recommendations";
        setError(msg);
      } finally {
        if (requestId === activeReqRef.current) {
          setLoading(false);
        }
      }
    },
    [
      profile.state,
      profile.district,
      profile.village,
      profile.crop,
      profile.acres,
      profile.land_status,
      profile.irrigation,
      profile.experience,
    ]
  );

  useEffect(() => {
    fetchRecommendations(false);
  }, [fetchRecommendations]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchRecommendations(true),
  };
}

/**
 * Hook to retrieve metadata and source synchronization freshness.
 */
export function useSchemesMetadata() {
  const [data, setData] = useState<SchemesMetadataResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeta = useCallback(async (isManualRefresh = false) => {
    if (!isManualRefresh && metadataCache && Date.now() - metadataCache.timestamp < CACHE_TTL_MS) {
      setData(metadataCache.data);
      setLoading(false);
      return;
    }

    try {
      const json = await apiGet<SchemesMetadataResponse>("/api/schemes/metadata");
      metadataCache = { data: json, timestamp: Date.now() };
      setData(json);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load scheme metadata";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta(false);
  }, [fetchMeta]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchMeta(true),
  };
}
