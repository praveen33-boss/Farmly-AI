"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "./location-context";
import { apiGet } from "./api";

export interface MandiRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  distance_km: number | null;
  uncertain: boolean;
  transport_cost_per_q: number | null;
  est_net_per_q: number | null;
  est_total: number | null;
}

export interface MandiRecommendation {
  market: string;
  district: string;
  state: string;
  modal_price: number;
  arrival_date?: string;
  distance_km: number | null;
  uncertain: boolean;
  transport_cost_per_q: number | null;
  est_net_per_q: number | null;
  est_total: number | null;
  basis: string;
}

export interface MandiSummary {
  total_records: number;
  min_modal_price: number | null;
  max_modal_price: number | null;
  avg_modal_price: number | null;
  date_range: {
    earliest: string | null;
    latest: string | null;
    unique_dates: string[];
  } | null;
}

export interface MandiPricesResponse {
  source: string;
  resource_id: string;
  filters: {
    state: string | null;
    commodity: string | null;
    district: string | null;
    market: string | null;
  };
  summary: MandiSummary;
  transport_rate_applied: number | null;
  transport_notice: string;
  recommendation: MandiRecommendation | null;
  recommendation_notice?: string | null;
  records: MandiRecord[];
  fetched_at: string;
  stale: boolean;
}

export interface PriceTrendResponse {
  insufficient_data: boolean;
  message?: string;
  commodity?: string;
  state?: string;
  available_dates?: string[];
  sample_records_count?: number;
  trend_direction?: "up" | "down" | "stable";
  change_percentage?: number;
  price_change_per_quintal?: number;
  earliest_avg?: number;
  latest_avg?: number;
  data_points?: Array<{ date: string; avg_modal_price: number; count: number }>;
  source: string;
  fetched_at: string;
}

export function usePriceTrend(commodity?: string, state?: string, district?: string) {
  const [data, setData] = useState<PriceTrendResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!commodity) return;
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (commodity) params.set("commodity", commodity);
    if (state) params.set("state", state);
    if (district && district !== "All districts") params.set("district", district);

    apiGet<PriceTrendResponse>(`/api/prices/trend?${params.toString()}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load trend");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [commodity, state, district]);

  return { data, loading, error };
}


export interface UsePricesOptions {
  crop?: string;
  quantity?: number;
  district?: string;
  distance?: number;
  transportRate?: number;
}

// In-memory module cache to avoid blank loading flashes during navigation
const pricesCacheMap: Record<string, { data: MandiPricesResponse; timestamp: number }> = {};

export function usePrices(options: UsePricesOptions = {}) {
  const { location } = useLocation();

  const crop = options.crop || "Paddy";
  const quantity = options.quantity ?? 20;
  const districtFilter = options.district && options.district !== "All districts" ? options.district : "";
  const distance = options.distance ?? 70;

  const stateParam = location.state || "Jharkhand";
  const userDistrictParam = location.district || "Ranchi";

  const searchParams = new URLSearchParams();
  if (stateParam) searchParams.set("state", stateParam);
  if (districtFilter) searchParams.set("district", districtFilter);
  if (userDistrictParam) searchParams.set("user_district", userDistrictParam);
  if (stateParam) searchParams.set("user_state", stateParam);
  if (crop) searchParams.set("commodity", crop);
  searchParams.set("quantity_q", String(quantity));
  searchParams.set("max_km", String(distance));
  if (options.transportRate !== undefined && options.transportRate !== null) {
    searchParams.set("transport_rate", String(options.transportRate));
  }
  searchParams.set("limit", "60");

  const queryString = searchParams.toString();
  const path = `/api/prices?${queryString}`;

  const cached = pricesCacheMap[queryString];
  const [data, setData] = useState<MandiPricesResponse | null>(cached ? cached.data : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const lastQueryRef = useRef<string>(queryString);

  const refetch = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const currentQuery = queryString;
    lastQueryRef.current = currentQuery;

    const existing = pricesCacheMap[currentQuery];
    if (existing) {
      setData(existing.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    apiGet<MandiPricesResponse>(path)
      .then((res) => {
        if (!cancelled && lastQueryRef.current === currentQuery) {
          pricesCacheMap[currentQuery] = { data: res, timestamp: Date.now() };
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && lastQueryRef.current === currentQuery) {
          setError(err.message || "Failed to load mandi prices from server.");
        }
      })
      .finally(() => {
        if (!cancelled && lastQueryRef.current === currentQuery) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, queryString, reloadTrigger]);

  return { data, loading, error, refetch, location };
}
