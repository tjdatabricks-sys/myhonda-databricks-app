"use client";

import { useMemo } from "react";
import { useAnalyticsQuery } from "@/lib/api";
import type { ExperimentsResponse, ExperimentVariantDto } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtNumber, fmtPct, fmtDelta } from "@/lib/format";
import { FlaskConical, CheckCircle2, Play, Trophy, TrendingUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTROL_COLOR = "#94a3b8";
const TREATMENT_COLOR = "#0d9488";

export function ExperimentsTab() {
  const { data, isLoading } = useAnalyticsQuery<ExperimentsResponse>("experiments", { withFilters: false });
  const s = data?.summary;

  const experiments = useMemo(() => {
    if (!data?.experiments) return [];
    return [...data.experiments].sort((a, b) => {
      const aw = a.bestVariant ? 1 : 0;
      const bw = b.bestVariant ? 1 : 0;
      if (aw !== bw) return bw - aw;
      return b.bestLiftRel - a.bestLiftRel;
    });
  }, [data]);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Experiments" value={fmtNumber(s?.total)} icon={FlaskConical} loading={isLoading} accent="slate" description="across all campaigns" />
        <KpiCard label="Completed" value={fmtNumber(s?.completed)} icon={CheckCircle2} loading={isLoading} accent="teal" description="read out and locked" />
        <KpiCard label="Running" value={fmtNumber(s?.running)} icon={Play} loading={isLoading} accent="cyan" description="collecting traffic" />
        <KpiCard label="Winners Found" value={fmtNumber(s?.winners)} icon={Trophy} loading={isLoading} accent="amber" description="significant uplift" />
        <KpiCard label="Avg Lift" value={s ? fmtDelta(s.avgLift) : "-"} icon={TrendingUp} loading={isLoading} accent="violet" description="relative, vs control" />
      </div>

      {/* Experiment cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : experiments.length ? (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {experiments.map((exp) => (
            <ExperimentCard key={exp.experimentId} experiment={exp} />
          ))}
        </div>
      ) : (
        <ChartCard title="Experiments" subtitle="A/B test readouts by variant">
          <EmptyState message="No experiments available" />
        </ChartCard>
      )}

      {/* Methodology footnote */}
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-[11px] leading-relaxed text-slate-500">
          Statistical confidence via two-proportion z-test at alpha 0.05. Conversion uplift is not necessarily incremental — see governance tab.
        </p>
      </div>
    </div>
  );
}

function ExperimentCard({ experiment: exp }: { experiment: ExperimentsResponse["experiments"][number] }) {
  const isWinner = !!exp.bestVariant;
  const isRunning = exp.status.toLowerCase() === "running";
  const maxRate = Math.max(...exp.variants.map((v) => v.rate), 0.0001);

  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md",
        isWinner && "border-teal-200 ring-1 ring-teal-300/70"
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm leading-snug font-semibold text-slate-800">{exp.name}</h3>
          {isRunning ? (
            <Badge variant="outline" className="shrink-0 gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Running
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 border-slate-200 bg-slate-100 text-slate-600">
              Completed
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[10.5px] text-teal-700">
            {exp.primaryMetric}
          </Badge>
          <span className="font-mono text-[10.5px] text-slate-400">{exp.experimentId}</span>
        </div>

        {/* Hypothesis + meta */}
        <p className="line-clamp-2 text-xs leading-relaxed italic text-slate-500">{exp.hypothesis}</p>
        <p className="text-[11px] leading-snug text-slate-400">
          <span className="font-medium text-slate-500">{exp.campaignTitle}</span> · {exp.ownerTeam} · {exp.window}
        </p>

        {/* Variant bars */}
        <div className="mt-auto space-y-2.5 border-t border-slate-100 pt-3">
          {exp.variants.map((v) => (
            <VariantRow key={v.variantId} variant={v} maxRate={maxRate} />
          ))}
        </div>

        {/* Winner footer */}
        {isWinner ? (
          <div className="-mx-4 -mb-4 mt-3 flex items-center gap-2 border-t border-teal-200 bg-teal-50/70 px-4 py-2">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            <p className="text-[11px] font-semibold text-teal-800">Winner: {exp.bestVariant}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VariantRow({ variant: v, maxRate }: { variant: ExperimentVariantDto; maxRate: number }) {
  const isControl = v.variant.toLowerCase() === "control";
  const width = Math.max(2, (v.rate / maxRate) * 100);
  const liftPositive = v.liftRel >= 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs", isControl ? "font-medium text-slate-500" : "font-semibold text-slate-700")}>
          {v.variant}
        </span>
        <span className="flex items-center gap-1">
          {!isControl ? (
            <>
              <Badge
                className={cn(
                  "px-1.5 text-[10.5px] font-semibold tabular-nums",
                  liftPositive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
                )}
                variant="outline"
              >
                {fmtDelta(v.liftRel)}
              </Badge>
              {v.significant ? (
                <Badge className="border-transparent bg-emerald-600 px-1.5 text-[10.5px] font-semibold text-white tabular-nums">
                  {fmtPct(v.confidence, 1)} conf.
                </Badge>
              ) : (
                <Badge variant="outline" className="px-1.5 text-[10.5px] text-slate-500 tabular-nums">
                  {fmtPct(v.confidence, 1)} conf.
                </Badge>
              )}
            </>
          ) : (
            <span className="text-[10.5px] font-medium tracking-wide text-slate-400 uppercase">baseline</span>
          )}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${v.variant} conversion rate ${fmtPct(v.rate, 2)}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: isControl ? CONTROL_COLOR : TREATMENT_COLOR }}
        />
      </div>
      <p className="mt-1 text-[10.5px] text-slate-400 tabular-nums">
        <span className="font-semibold text-slate-600">{fmtPct(v.rate, 2)}</span>
        <span className="mx-1.5">·</span>
        {fmtNumber(v.eligible)} eligible
        <span className="mx-1.5">·</span>
        {fmtNumber(v.converted)} converted
      </p>
    </div>
  );
}
