"use client";

import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "@/lib/store";

export async function apiGet<T>(endpoint: string, params?: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, v);
    }
  }
  const res = await fetch(`/api/${endpoint}${qs.toString() ? `?${qs.toString()}` : ""}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `API ${endpoint} failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

/** Query hook that automatically applies the global filter store. */
export function useAnalyticsQuery<T>(endpoint: string, opts?: { withFilters?: boolean }) {
  const withFilters = opts?.withFilters ?? true;
  const rangeReady = useFilterStore((s) => s.dataRange !== null);
  const queryKey = useFilterStore((s) => s.queryKey());
  const toParams = useFilterStore((s) => s.toParams);
  return useQuery<T>({
    enabled: !withFilters || rangeReady,
    queryKey: [endpoint, withFilters ? queryKey : "none"],
    queryFn: () => apiGet<T>(endpoint, withFilters ? toParams() : undefined),
    staleTime: 120_000,
    retry: 1,
  });
}
