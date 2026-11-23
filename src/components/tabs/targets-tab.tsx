"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { TargetsResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE, GOOD } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtMonth, safeDiv } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { Flag, Trophy, Target, ArrowRightLeft, CalendarCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const KPI_ACCENTS: Record<string, string> = {
  teal: "bg-teal-50 text-teal-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  cyan: "bg-cyan-50 text-cyan-600",
  slate: "bg-slate-100 text-slate-600",
};

/** KpiCard variant that allows a colored value (mirrors KpiCard layout). */
function KpiValueCard({
  label, value, valueClassName, icon: Icon, accent = "teal", description, loading,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  icon: LucideIcon;
  accent?: "teal" | "amber" | "rose" | "violet" | "cyan" | "slate";
  description?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
            <p className={cn("mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums text-slate-900", valueClassName)}>{value}</p>
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", KPI_ACCENTS[accent])}>
            <Icon size={18} />
          </div>
        </div>
        {description ? <p className="mt-2 truncate text-[11px] text-slate-400">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

function attainmentTone(a: number): string {
  if (a >= 1) return "text-emerald-600";
  if (a >= 0.8) return "text-amber-600";
  return "text-rose-600";
}

function attainmentBarTone(a: number): string {
  if (a >= 1) return "[&>[data-slot=progress-indicator]]:bg-emerald-500";
  if (a >= 0.8) return "[&>[data-slot=progress-indicator]]:bg-amber-500";
  return "[&>[data-slot=progress-indicator]]:bg-rose-500";
}

function overrideStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("approv")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("reject")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

interface AttainmentItem {
  id: string;
  name: string;
  target: number;
  actual: number;
  attainment: number;
}

function AttainmentList({ rows, emptyMessage }: { rows: AttainmentItem[]; emptyMessage: string }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;
  return (
    <div className="max-h-80 space-y-3.5 overflow-y-auto scrollbar-thin py-1 pr-1">
      {rows.map((r) => (
        <div key={r.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-medium text-slate-700">{r.name}</span>
            <span className={cn("shrink-0 text-xs font-semibold tabular-nums", attainmentTone(r.attainment))}>{fmtPct(r.attainment)}</span>
          </div>
          <Progress value={Math.min(100, r.attainment * 100)} className={cn("h-2", attainmentBarTone(r.attainment))} />
          <p className="mt-1 text-[10.5px] text-slate-400 tabular-nums">
            {fmtNumber(r.actual)} of {fmtNumber(r.target)} funded
          </p>
        </div>
      ))}
    </div>
  );
}

export function TargetsTab() {
  const { data, isLoading } = useAnalyticsQuery<TargetsResponse>("targets");
  const k = data?.kpis;

  const productRows: AttainmentItem[] = (data?.byProduct ?? []).map((p) => ({
    id: p.productId, name: p.product, target: p.target, actual: p.actual, attainment: p.attainment,
  }));
  const marketRows: AttainmentItem[] = (data?.byMarket ?? []).map((m) => ({
    id: m.marketId, name: m.market, target: m.target, actual: m.actual, attainment: m.attainment,
  }));

  const overrideCols: Column<TargetsResponse["overrides"][number]>[] = [
    { key: "month", header: "Month", cell: (r) => <span className="text-slate-600">{fmtMonth(r.month)}</span>, sortValue: (r) => r.month },
    { key: "product", header: "Product", cell: (r) => <span className="font-medium text-slate-700">{r.product}</span> },
    { key: "market", header: "Market", cell: (r) => <span className="text-slate-600">{r.market}</span> },
    {
      key: "status", header: "Status", cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", overrideStatusClass(r.status))}>{r.status}</Badge>
      ),
    },
    { key: "amount", header: "Amount", align: "right", cell: (r) => fmtNumber(r.amount), sortValue: (r) => r.amount },
    {
      key: "reason", header: "Reason", cell: (r) => (
        <span className="block max-w-[380px] truncate text-slate-500" title={r.reason}>{r.reason}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Target Funded" value={fmtNumber(k?.targetFunded)} icon={Flag} loading={isLoading} accent="slate" description="plan total" />
        <KpiCard label="Actual Funded" value={fmtNumber(k?.actualFunded)} icon={Trophy} loading={isLoading} accent="teal" description="funded to date" />
        <KpiValueCard
          label="Attainment"
          value={fmtPct(k?.attainment)}
          valueClassName={k ? attainmentTone(k.attainment) : undefined}
          icon={Target}
          accent="violet"
          description="actual vs plan"
          loading={isLoading}
        />
        <KpiValueCard
          label="Gap"
          value={k?.gap != null ? `${k.gap > 0 ? "+" : ""}${fmtNumber(k.gap)}` : "-"}
          valueClassName={k ? (k.gap <= 0 ? "text-emerald-600" : "text-rose-600") : undefined}
          icon={ArrowRightLeft}
          accent="amber"
          description="target minus actual"
          loading={isLoading}
        />
        <KpiCard label="Months On Track" value={fmtNumber(k?.monthsOnTrack)} icon={CalendarCheck} loading={isLoading} accent="cyan" description={k ? `of ${fmtNumber(k.monthsTotal)} months` : undefined} />
        <KpiCard label="Target Contribution" value={fmtCurrency(k?.targetContribution, { compact: true })} icon={Wallet} loading={isLoading} accent="rose" description="planned contribution" />
      </div>

      {/* Target vs actual by month */}
      <ChartCard
        title="Target vs actual by month"
        subtitle="Monthly funded accounts against plan with attainment rate on the right axis"
        loading={isLoading}
      >
        {data?.monthly?.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtPct(v, 0)} {...AXIS} width={44} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v, n) => (n.includes("Attainment") ? fmtPct(v) : fmtNumber(v))}
                      labelFormatter={(l) => fmtMonth(String(l))}
                    />
                  }
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Bar yAxisId="left" dataKey="targetFunded" name="Target" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar yAxisId="left" dataKey="actualFunded" name="Actual" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line yAxisId="right" dataKey="attainment" name="Attainment" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
                <ReferenceLine
                  yAxisId="right"
                  y={1}
                  stroke={GOOD}
                  strokeDasharray="5 5"
                  label={{ value: "plan", position: "insideTopRight", fontSize: 10, fill: GOOD }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No target months in the selected range" />
        )}
      </ChartCard>

      {/* Attainment by product / market */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Attainment by product" subtitle="Funded accounts vs plan by product" loading={isLoading}>
          <AttainmentList rows={productRows} emptyMessage="No product targets in range" />
        </ChartCard>
        <ChartCard title="Attainment by market" subtitle="Funded accounts vs plan by market" loading={isLoading}>
          <AttainmentList rows={marketRows} emptyMessage="No market targets in range" />
        </ChartCard>
      </div>

      {/* Plan versions */}
      <ChartCard title="Plan versions" subtitle="Target vs actual funded accounts across planning cycles" loading={isLoading}>
        {data?.planVersions?.length ? (
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            {data.planVersions.map((p) => {
              const attain = safeDiv(p.actualFunded, p.targetFunded);
              return (
                <Card key={p.planVersion} className="border-slate-200 bg-slate-50/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-teal-700">{p.planVersion}</span>
                      <span className={cn("shrink-0 text-xs font-semibold tabular-nums", attainmentTone(attain))}>{fmtPct(attain)}</span>
                    </div>
                    <Progress value={Math.min(100, attain * 100)} className={cn("mt-3 h-2", attainmentBarTone(attain))} />
                    <p className="mt-2 text-[11px] text-slate-400 tabular-nums">
                      {fmtNumber(p.actualFunded)} of {fmtNumber(p.targetFunded)} funded
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState message="No plan versions registered" />
        )}
      </ChartCard>

      {/* Target overrides */}
      <ChartCard
        title="Target overrides"
        subtitle="Plan adjustment requests with approval status"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={overrideCols}
          rows={data?.overrides ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "month", dir: "desc" }}
          rowKey={(r, i) => `${r.month}-${r.product}-${r.market}-${i}`}
          emptyMessage="No target overrides"
        />
      </ChartCard>
    </div>
  );
}
