"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDelta } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  /** when true, a negative delta is good (e.g. cost metrics) */
  invertDelta?: boolean;
  deltaLabel?: string;
  icon: LucideIcon;
  iconClassName?: string;
  description?: string;
  loading?: boolean;
  accent?: "teal" | "amber" | "rose" | "violet" | "cyan" | "slate";
}

const ACCENTS: Record<string, string> = {
  teal: "bg-teal-50 text-teal-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  cyan: "bg-cyan-50 text-cyan-600",
  slate: "bg-slate-100 text-slate-600",
};

export function KpiCard({ label, value, delta, invertDelta, deltaLabel, icon: Icon, iconClassName, description, loading, accent = "teal" }: KpiCardProps) {
  if (loading) {
    return (
      <Card role="group" aria-label={`${label} KPI`}>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </CardContent>
      </Card>
    );
  }
  const hasDelta = delta != null && Number.isFinite(delta);
  const good = hasDelta ? (invertDelta ? delta < 0 : delta > 0) : null;
  return (
    <Card role="group" aria-label={`${label} KPI`} className="group transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs leading-snug font-medium tracking-wide text-slate-500 uppercase">{label}</p>
            <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ACCENTS[accent], iconClassName)}>
            <Icon size={18} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {hasDelta ? (
            <Badge variant="outline" className={cn("gap-0.5 px-1.5 text-[11px] font-medium", good ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>
              {delta! > 0.0005 ? <ArrowUpRight className="h-3 w-3" /> : delta! < -0.0005 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {fmtDelta(delta)}
            </Badge>
          ) : null}
          {deltaLabel ? <span className="min-w-0 text-[11px] leading-snug text-slate-400">{deltaLabel}</span> : null}
          {!hasDelta && description ? <span className="truncate text-[11px] text-slate-400">{description}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
