"use client";

import { useEffect, useRef, useState } from "react";
import { useLocation } from "./location-context";
import { apiGet } from "./api";

// In-memory module cache so switching tabs does not cause blank/loading states
const weatherCacheMap: Record<string, { data: any; timestamp: number }> = {};

export function useWeather() {
  const { location } = useLocation();
  const targetQuery = location.state
    ? `${location.district}, ${location.state}`
    : location.district;
  const path = `/api/weather?city=${encodeURIComponent(targetQuery)}`;

  const cached = weatherCacheMap[targetQuery];
  const [data, setData] = useState<any | null>(cached ? cached.data : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!cached);
  const lastTargetRef = useRef<string>(targetQuery);

  useEffect(() => {
    let cancelled = false;
    const currentTarget = targetQuery;
    lastTargetRef.current = currentTarget;

    const existing = weatherCacheMap[currentTarget];
    if (existing) {
      setData(existing.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    apiGet<any>(path)
      .then((d) => {
        if (!cancelled && lastTargetRef.current === currentTarget) {
          weatherCacheMap[currentTarget] = { data: d, timestamp: Date.now() };
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled && lastTargetRef.current === currentTarget) {
          setError(e.message || "Failed to load weather data");
          // Keep existing data so user still has previous forecast visible on 404
        }
      })
      .finally(() => {
        if (!cancelled && lastTargetRef.current === currentTarget) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, targetQuery]);

  return { data, error, loading, targetQuery, location };
}
