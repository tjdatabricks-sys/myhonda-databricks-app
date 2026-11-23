"use client";

// Shared chart theme for recharts — consistent across all tabs

export const CHART_COLORS = [
  "#0d9488", // teal
  "#f59e0b", // amber
  "#e11d48", // rose
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#65a30d", // lime
  "#db2777", // pink
  "#ea580c", // orange
  "#475569", // slate
  "#14b8a6", // teal light
];

export const COLOR_SEQUENCE = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

export const GOOD = "#059669";
export const BAD = "#e11d48";
export const NEUTRAL = "#475569";

export const AXIS = {
  stroke: "#94a3b8",
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: "#e2e8f0" },
} as const;

export const GRID_STROKE = "#e2e8f0";

export const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
  fontSize: "12px",
  padding: "8px 12px",
} as const;
