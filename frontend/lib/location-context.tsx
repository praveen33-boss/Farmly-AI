"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

export type LocationInfo = {
  district: string;
  state: string;
  label: string;
};

const STORAGE_KEY = "farmly-selected-location";
export const DEFAULT_LOCATION: LocationInfo = {
  district: "Ranchi",
  state: "Jharkhand",
  label: "Ranchi, Jharkhand",
};

interface LocationContextType {
  location: LocationInfo;
  setLocation: (loc: LocationInfo) => void;
  updateLocationFromInput: (input: string) => void;
  isMounted: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Deterministic initial location for both SSR and initial client hydration
function getInitialLocation(profileDistrict?: string, profileState?: string): LocationInfo {
  if (profileDistrict) {
    return {
      district: profileDistrict,
      state: profileState || "Jharkhand",
      label: `${profileDistrict}, ${profileState || "Jharkhand"}`,
    };
  }
  return DEFAULT_LOCATION;
}

export function LocationProvider({
  children,
  profileDistrict,
  profileState,
}: {
  children: ReactNode;
  profileDistrict?: string;
  profileState?: string;
}) {
  // Always initialize deterministically so SSR and initial client render match perfectly
  const [location, setLocationState] = useState<LocationInfo>(() =>
    getInitialLocation(profileDistrict, profileState)
  );
  const [isMounted, setIsMounted] = useState(false);
  const prevProfileRef = useRef({ district: profileDistrict, state: profileState });

  const setLocation = (loc: LocationInfo) => {
    setLocationState(loc);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
      }
    } catch {
      // Local storage unavailable
    }
  };

  // Read saved location from localStorage ONLY after mounting on client (post-hydration)
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.district) {
          setLocationState(parsed);
          return;
        }
      }
      const profileSaved = window.localStorage.getItem("farmly-profile");
      if (profileSaved) {
        const p = JSON.parse(profileSaved);
        if (p.district) {
          setLocationState({
            district: p.district,
            state: p.state || "Jharkhand",
            label: `${p.district}, ${p.state || "Jharkhand"}`,
          });
          return;
        }
      }
    } catch {
      // Local storage unavailable
    }
  }, []);

  // When the saved farm profile location changes, Weather and Overview follow it.
  useEffect(() => {
    const prev = prevProfileRef.current;
    const changed =
      Boolean(profileDistrict) &&
      (profileDistrict !== prev.district || profileState !== prev.state);
    prevProfileRef.current = { district: profileDistrict, state: profileState };
    if (!changed || !profileDistrict) return;
    setLocation({
      district: profileDistrict,
      state: profileState || "",
      label: profileState ? `${profileDistrict}, ${profileState}` : profileDistrict,
    });
  }, [profileDistrict, profileState]);

  const updateLocationFromInput = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const parts = trimmed.split(",").map((s) => s.trim());
    const district = parts[0];
    const state = parts[1] || location.state || "Jharkhand";
    setLocation({
      district,
      state,
      label: parts.length > 1 ? `${district}, ${state}` : `${district}, ${state}`,
    });
  };

  return (
    <LocationContext.Provider value={{ location, setLocation, updateLocationFromInput, isMounted }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    return {
      location: DEFAULT_LOCATION,
      setLocation: () => {},
      updateLocationFromInput: () => {},
      isMounted: false,
    };
  }
  return context;
}
