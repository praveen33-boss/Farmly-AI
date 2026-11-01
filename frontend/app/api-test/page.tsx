"use client";
import { useApi } from "@/lib/use-api";

export default function ApiTest() {
  const { data, error, loading } = useApi<any>("/api/weather?city=Ranchi");
  return (
    <pre style={{ padding: 20, whiteSpace: "pre-wrap" }}>
      {loading ? "Loading..." : error ? `Error: ${error}` : JSON.stringify(data, null, 2)}
    </pre>
  );
}