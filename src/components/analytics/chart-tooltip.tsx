"use client";

import { TOOLTIP_STYLE } from "@/lib/chart-theme";

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  valueFormatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string | number) => string;
}

export function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={TOOLTIP_STYLE} className="min-w-[140px]">
      {label != null ? (
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </p>
      ) : null}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold text-slate-800 tabular-nums">
              {typeof entry.value === "number" && valueFormatter
                ? valueFormatter(entry.value, String(entry.name ?? ""))
                : String(entry.value ?? "-")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
