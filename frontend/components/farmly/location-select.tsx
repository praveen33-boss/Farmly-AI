"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useApi } from "@/lib/use-api";

export interface LocationSelectProps {
  state: string;
  district: string;
  onStateChange: (state: string) => void;
  onDistrictChange: (district: string) => void;
  variant?: "profile" | "onboarding";
  stateId?: string;
  districtId?: string;
}

export function LocationSelect({
  state,
  district,
  onStateChange,
  onDistrictChange,
  variant = "profile",
  stateId = "state-select",
  districtId = "district-select",
}: LocationSelectProps) {
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");

  // Fetch live/official states from backend
  const {
    data: statesData,
    error: statesError,
    loading: statesLoading,
  } = useApi<{ states: string[] }>("/api/locations/states");
  const states = useMemo(() => statesData?.states || [], [statesData]);

  // Fetch live/official districts for the chosen state from backend
  const districtsPath = state
    ? `/api/locations/districts?state=${encodeURIComponent(state)}`
    : null;
  const {
    data: districtsData,
    error: districtsError,
    loading: districtsLoading,
  } = useApi<{ districts: string[] }>(districtsPath);
  const districts = useMemo(() => districtsData?.districts || [], [districtsData]);

  // Filter states by search input
  const filteredStates = useMemo(() => {
    if (!stateFilter.trim()) return states;
    return states.filter((s) =>
      s.toLowerCase().includes(stateFilter.trim().toLowerCase())
    );
  }, [states, stateFilter]);

  // Filter districts by search input
  const filteredDistricts = useMemo(() => {
    if (!districtFilter.trim()) return districts;
    return districts.filter((d) =>
      d.toLowerCase().includes(districtFilter.trim().toLowerCase())
    );
  }, [districts, districtFilter]);

  // Check if current district is an old free-text value not in the loaded district list
  const isNotInList = Boolean(
    district &&
      districts.length > 0 &&
      !districts.some((d) => d.toLowerCase() === district.toLowerCase())
  );

  const handleStateChange = (nextState: string) => {
    onStateChange(nextState);
    onDistrictChange(""); // Clear district when state changes
    setDistrictFilter("");
  };

  // ----------------------------------------------------
  // Variant: Onboarding (<div className="auth-field">)
  // ----------------------------------------------------
  if (variant === "onboarding") {
    return (
      <>
        <div className="auth-field">
          <label htmlFor={stateId}>State</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search
                size={13}
                style={{ position: "absolute", left: "9px", color: "#8a9485" }}
              />
              <input
                type="text"
                placeholder="Filter states…"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                style={{
                  height: "32px",
                  fontSize: "12px",
                  padding: "0 10px 0 28px",
                  border: "1px solid #e1e7dd",
                  borderRadius: "6px",
                  background: "#fbfcfb",
                  outline: "none",
                  width: "100%",
                }}
                aria-label="Filter state options"
              />
            </div>
            <div className="select-field">
              <select
                id={stateId}
                value={state}
                disabled={statesLoading}
                onChange={(e) => handleStateChange(e.target.value)}
              >
                <option value="">
                  {statesLoading ? "Loading states…" : "Select State"}
                </option>
                {state && !filteredStates.includes(state) && (
                  <option value={state}>{state}</option>
                )}
                {filteredStates.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          {statesError && (
            <span className="field-error" style={{ marginTop: "4px" }}>
              Could not load state list: {statesError}
            </span>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor={districtId}>
            District{" "}
            {isNotInList && (
              <span style={{ color: "#d97706", fontSize: "10px", fontWeight: "normal" }}>
                (not in list)
              </span>
            )}
          </label>

          {districtsError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <input
                id={districtId}
                value={district}
                onChange={(e) => onDistrictChange(e.target.value)}
                placeholder="Enter district name"
              />
              <small style={{ color: "#b91c1c", fontSize: "11px", lineHeight: "1.3" }}>
                Could not load district list ({districtsError}). You can enter your district manually.
              </small>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {state && !districtsLoading && districts.length > 0 && (
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Search
                    size={13}
                    style={{ position: "absolute", left: "9px", color: "#8a9485" }}
                  />
                  <input
                    type="text"
                    placeholder={`Filter ${state} districts…`}
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    style={{
                      height: "32px",
                      fontSize: "12px",
                      padding: "0 10px 0 28px",
                      border: "1px solid #e1e7dd",
                      borderRadius: "6px",
                      background: "#fbfcfb",
                      outline: "none",
                      width: "100%",
                    }}
                    aria-label={`Filter ${state} districts`}
                  />
                </div>
              )}
              <div className="select-field">
                <select
                  id={districtId}
                  value={district}
                  disabled={!state || districtsLoading}
                  onChange={(e) => onDistrictChange(e.target.value)}
                >
                  {!state ? (
                    <option value="">Choose state first</option>
                  ) : districtsLoading ? (
                    <>
                      <option value="">{district || "Loading districts…"}</option>
                      {district ? <option value={district}>{district}</option> : null}
                    </>
                  ) : (
                    <>
                      <option value="">Select District</option>
                      {isNotInList && (
                        <option value={district}>{district} (not in list)</option>
                      )}
                      {filteredDistricts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown size={15} />
              </div>
            </div>
          )}
          {isNotInList && (
            <span className="field-hint" style={{ color: "#b45309", fontSize: "10px" }}>
              "{district}" is not in the official list for {state}. You can select an official district or keep this entry.
            </span>
          )}
        </div>
      </>
    );
  }

  // ----------------------------------------------------
  // Variant: Profile (<label>...</label> inside .profile-form-grid)
  // ----------------------------------------------------
  return (
    <>
      <label style={{ position: "relative" }}>
        <span>State</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={11}
              style={{ position: "absolute", left: "6px", color: "#8a9485" }}
            />
            <input
              type="text"
              placeholder="Filter states…"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              style={{
                fontSize: "11px",
                padding: "2px 6px 2px 22px",
                border: "1px solid #d8ddd5",
                borderRadius: "4px",
                background: "#fbfcfb",
                outline: "none",
                width: "100%",
                height: "24px",
              }}
              aria-label="Filter states"
            />
          </div>
          <select
            value={state}
            disabled={statesLoading}
            onChange={(e) => handleStateChange(e.target.value)}
          >
            <option value="">
              {statesLoading ? "Loading states…" : "Select State"}
            </option>
            {state && !filteredStates.includes(state) && (
              <option value={state}>{state}</option>
            )}
            {filteredStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {statesError && (
          <small style={{ color: "#b91c1c", fontSize: "9px" }}>
            Failed to load states: {statesError}
          </small>
        )}
      </label>

      <label style={{ position: "relative" }}>
        <span>
          District{" "}
          {isNotInList && (
            <span style={{ color: "#d97706", fontSize: "9px", fontWeight: "normal" }}>
              (not in list)
            </span>
          )}
        </span>

        {districtsError ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
            <input
              value={district}
              onChange={(e) => onDistrictChange(e.target.value)}
              placeholder="Enter district name"
              style={{ height: "24px" }}
            />
            <small style={{ color: "#b91c1c", fontSize: "9px", lineHeight: "1.2" }}>
              District list unavailable ({districtsError}). You can enter manually.
            </small>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
            {state && !districtsLoading && districts.length > 0 && (
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search
                  size={11}
                  style={{ position: "absolute", left: "6px", color: "#8a9485" }}
                />
                <input
                  type="text"
                  placeholder={`Filter ${state} districts…`}
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  style={{
                    fontSize: "11px",
                    padding: "2px 6px 2px 22px",
                    border: "1px solid #d8ddd5",
                    borderRadius: "4px",
                    background: "#fbfcfb",
                    outline: "none",
                    width: "100%",
                    height: "24px",
                  }}
                  aria-label={`Filter ${state} districts`}
                />
              </div>
            )}
            <select
              value={district}
              disabled={!state || districtsLoading}
              onChange={(e) => onDistrictChange(e.target.value)}
            >
              {!state ? (
                <option value="">Choose state first</option>
              ) : districtsLoading ? (
                <>
                  <option value="">{district || "Loading districts…"}</option>
                  {district ? <option value={district}>{district}</option> : null}
                </>
              ) : (
                <>
                  <option value="">Select District</option>
                  {isNotInList && (
                    <option value={district}>{district} (not in list)</option>
                  )}
                  {filteredDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        )}
      </label>
    </>
  );
}
