"use client";

import { create } from "zustand";

export type RangePreset = "30d" | "90d" | "6m" | "12m" | "ytd" | "all";

export const RANGE_LABELS: Record<RangePreset, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date",
  all: "All time",
};

export function rangeParams(preset: RangePreset, range: { min: string; max: string } | null): Record<string, string> {
  if (!range) return {};
  if (preset === "all") return { from: range.min, to: range.max };
  const end = new Date(range.max + "T00:00:00Z");
  const start = new Date(end);
  if (preset === "30d" || preset === "90d") start.setUTCDate(start.getUTCDate() - (preset === "30d" ? 29 : 89));
  else if (preset === "ytd") start.setUTCMonth(0, 1);
  else {
    const day = end.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - (preset === "6m" ? 6 : 12));
    const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    start.setUTCDate(Math.min(day, lastDay));
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return { from: [start.toISOString().slice(0, 10), range.min].sort()[1], to: range.max };
}

interface FilterState {
  dataRange: { min: string; max: string } | null;
  setDataRange: (range: { min: string; max: string }) => void;
  rangePreset: RangePreset;
  campaignKey: string;
  platform: string;
  marketId: string;
  productId: string;
  segmentId: string;
  setRange: (r: RangePreset) => void;
  setCampaign: (v: string) => void;
  setPlatform: (v: string) => void;
  setMarket: (v: string) => void;
  setProduct: (v: string) => void;
  setSegment: (v: string) => void;
  reset: () => void;
  hasActiveFilters: () => boolean;
  toParams: () => Record<string, string>;
  queryKey: () => string;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  rangePreset: "12m",
  dataRange: null,
  setDataRange: (dataRange) => set({ dataRange }),
  campaignKey: "",
  platform: "",
  marketId: "",
  productId: "",
  segmentId: "",
  setRange: (rangePreset) => set({ rangePreset }),
  setCampaign: (campaignKey) => set({ campaignKey }),
  setPlatform: (platform) => set({ platform }),
  setMarket: (marketId) => set({ marketId }),
  setProduct: (productId) => set({ productId }),
  setSegment: (segmentId) => set({ segmentId }),
  reset: () => set({ rangePreset: "12m", campaignKey: "", platform: "", marketId: "", productId: "", segmentId: "" }),
  hasActiveFilters: () => {
    const s = get();
    return Boolean(s.campaignKey || s.platform || s.marketId || s.productId || s.segmentId);
  },
  toParams: () => {
    const s = get();
    const params = rangeParams(s.rangePreset, s.dataRange);
    if (s.campaignKey) params.campaign = s.campaignKey;
    if (s.platform) params.platform = s.platform;
    if (s.marketId) params.market = s.marketId;
    if (s.productId) params.product = s.productId;
    if (s.segmentId) params.segment = s.segmentId;
    return params;
  },
  queryKey: () => {
    const p = get().toParams();
    return Object.entries(p).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  },
}));
