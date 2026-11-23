"use client";

import { useMemo } from "react";
import { useAnalyticsQuery } from "@/lib/api";
import type { BrandResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { AXIS, GRID_STROKE } from "@/lib/chart-theme";
import { fmtPct, fmtMonth } from "@/lib/format";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, LabelList,
} from "recharts";
import { Award, TrendingUp, Percent, MessageSquare, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const PRE_COLOR = "#94a3b8";
const POST_COLOR = "#0d9488";

/** Signed percentage-point label for values already converted to pp units. */
function fmtPp(v: number | null | undefined, decimals = 1): string {
  if (v == null || Number.isNaN(v)) return "-";
  return `${v > 0 ? "+" : ""}${v.toFixed(decimals)} pp`;
}

export function BrandTab() {
  const { data, isLoading } = useAnalyticsQuery<BrandResponse>("brand");

  // Awareness metrics may arrive as decimals (0.35) per the API contract; guard against raw pct (35).
  const scale = useMemo(() => {
    const pres = data?.lift?.map((r) => Math.abs(r.preAwareness)) ?? [];
    return pres.length && Math.max(...pres) > 1.5 ? 0.01 : 1;
  }, [data]);
  const pp = (v: number) => v * scale * 100;

  const lift = data?.lift ?? [];
  const avgLiftPp = lift.length ? lift.reduce((a, r) => a + r.lift, 0) / lift.length * scale * 100 : null;
  const avgRelLift = lift.length ? lift.reduce((a, r) => a + r.relLift, 0) / lift.length : null;
  const postRecallWaves = (data?.waves ?? []).filter((w) => w.wave.toLowerCase().includes("post"));
  const avgPostRecallPp = postRecallWaves.length
    ? (postRecallWaves.reduce((a, w) => a + w.recall, 0) / postRecallWaves.length) * scale * 100
    : null;

  const liftChart = lift.map((r) => ({
    campaign: r.campaignTitle.length > 26 ? `${r.campaignTitle.slice(0, 25)}…` : r.campaignTitle,
    pre: Math.round(pp(r.preAwareness) * 10) / 10,
    post: Math.round(pp(r.postAwareness) * 10) / 10,
    liftLabel: fmtPp(Math.round(pp(r.lift) * 10) / 10),
  }));

  const timelineChart = (data?.timeline ?? []).map((t) => ({
    month: t.month,
    awareness: Math.round(pp(t.avgAwareness) * 10) / 10,
    consideration: Math.round(pp(t.avgConsideration) * 10) / 10,
    recall: Math.round(pp(t.avgRecall) * 10) / 10,
  }));

  const marketChart = (data?.byMarket ?? []).map((m) => ({
    market: m.market,
    pre: Math.round(pp(m.preAwareness) * 10) / 10,
    post: Math.round(pp(m.postAwareness) * 10) / 10,
  }));

  const liftCols: Column<BrandResponse["lift"][number]>[] = [
    {
      key: "campaignTitle", header: "Campaign", cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <p className="text-[11px] text-slate-400">{r.campaignKey}</p>
        </div>
      ), sortValue: (r) => r.campaignTitle,
    },
    { key: "channel", header: "Channel", cell: (r) => <span className="text-slate-600">{r.channel}</span> },
    { key: "preAwareness", header: "Pre", align: "right", cell: (r) => <span className="text-slate-500 tabular-nums">{pp(r.preAwareness).toFixed(1)}%</span>, sortValue: (r) => r.preAwareness },
    { key: "postAwareness", header: "Post", align: "right", cell: (r) => <span className="font-semibold text-slate-700 tabular-nums">{pp(r.postAwareness).toFixed(1)}%</span>, sortValue: (r) => r.postAwareness },
    {
      key: "lift", header: "Lift", align: "right", cell: (r) => (
        <span className={cn("font-semibold tabular-nums", r.lift >= 0 ? "text-emerald-600" : "text-rose-600")}>{fmtPp(pp(r.lift))}</span>
      ), sortValue: (r) => r.lift,
    },
    { key: "relLift", header: "Rel. Lift", align: "right", cell: (r) => <span className="text-slate-600 tabular-nums">{fmtPct(r.relLift)}</span>, sortValue: (r) => r.relLift },
    { key: "considerationLift", header: "Consideration Lift", align: "right", cell: (r) => <span className="text-slate-600 tabular-nums">{fmtPp(pp(r.considerationLift))}</span>, sortValue: (r) => r.considerationLift },
    { key: "recallLift", header: "Recall Lift", align: "right", cell: (r) => <span className="text-slate-600 tabular-nums">{fmtPp(pp(r.recallLift))}</span>, sortValue: (r) => r.recallLift },
    { key: "markets", header: "Markets", align: "right", cell: (r) => <span className="text-slate-600 tabular-nums">{r.markets}</span>, sortValue: (r) => r.markets },
  ];

  const methodCols: Column<BrandResponse["byMethod"][number]>[] = [
    { key: "method", header: "Method", cell: (r) => <span className="font-medium text-slate-700">{r.method}</span> },
    { key: "waves", header: "Waves", align: "right", cell: (r) => <span className="tabular-nums">{r.waves}</span>, sortValue: (r) => r.waves },
    {
      key: "avgLift", header: "Avg Lift", align: "right", cell: (r) => (
        <span className={cn("font-semibold tabular-nums", r.avgLift >= 0 ? "text-emerald-600" : "text-rose-600")}>{fmtPp(pp(r.avgLift))}</span>
      ), sortValue: (r) => r.avgLift,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Campaigns Measured" value={String(lift.length || 0)} icon={Award} loading={isLoading} accent="teal" description="with pre/post waves" />
        <KpiCard label="Avg Awareness Lift" value={avgLiftPp == null ? "-" : fmtPp(avgLiftPp)} icon={TrendingUp} loading={isLoading} accent="cyan" description="percentage points" />
        <KpiCard label="Avg Relative Lift" value={avgRelLift == null ? "-" : fmtPct(avgRelLift)} icon={Percent} loading={isLoading} accent="amber" description="vs pre-wave baseline" />
        <KpiCard label="Avg Message Recall (post)" value={avgPostRecallPp == null ? "-" : `${avgPostRecallPp.toFixed(1)}%`} icon={MessageSquare} loading={isLoading} accent="violet" description="post-wave respondents" />
      </div>

      {/* Pre/post by campaign + timeline */}
      <div className="grid gap-4 xl:grid-cols-5">
        <ChartCard
          title="Brand lift by campaign"
          subtitle="Pre vs post-wave aided awareness, with absolute lift"
          className="xl:col-span-3"
          loading={isLoading}
        >
          {liftChart.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liftChart} layout="vertical" margin={{ top: 5, right: 48, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v)}%`} {...AXIS} />
                  <YAxis type="category" dataKey="campaign" width={150} {...AXIS} tick={{ fontSize: 10, fill: "#64748b" }} interval={0} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={7} />
                  <Bar dataKey="pre" name="Pre-wave" fill={PRE_COLOR} radius={[0, 3, 3, 0]} maxBarSize={13} />
                  <Bar dataKey="post" name="Post-wave" fill={POST_COLOR} radius={[0, 3, 3, 0]} maxBarSize={13}>
                    <LabelList dataKey="liftLabel" position="right" fontSize={10} fill="#475569" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No brand lift waves available" />
          )}
        </ChartCard>

        <ChartCard
          title="Brand tracker timeline"
          subtitle="Monthly average awareness, consideration and message recall"
          className="xl:col-span-2"
          loading={isLoading}
        >
          {timelineChart.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineChart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => `${Math.round(v)}%`} {...AXIS} width={44} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} labelFormatter={(l) => fmtMonth(String(l))} />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Line dataKey="awareness" name="Awareness" stroke="#0d9488" strokeWidth={2.5} dot={false} />
                  <Line dataKey="consideration" name="Consideration" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line dataKey="recall" name="Message recall" stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No tracker history available" />
          )}
        </ChartCard>
      </div>

      {/* Lift detail table */}
      <ChartCard
        title="Lift detail by campaign"
        subtitle="Wave-over-wave movement for every measured campaign"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={liftCols}
          rows={lift}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "lift", dir: "desc" }}
          rowKey={(r) => r.campaignKey}
          emptyMessage="No campaigns measured in range"
        />
      </ChartCard>

      {/* By market + by method */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Awareness by market"
          subtitle="Pre vs post-wave aided awareness across measured markets"
          className="xl:col-span-2"
          loading={isLoading}
        >
          {marketChart.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketChart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="market" {...AXIS} interval={0} />
                  <YAxis tickFormatter={(v: number) => `${Math.round(v)}%`} {...AXIS} width={44} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Bar dataKey="pre" name="Pre-wave" fill={PRE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="post" name="Post-wave" fill={POST_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No market breakdown available" />
          )}
        </ChartCard>

        <ChartCard title="Survey methods" subtitle="Wave counts and average awareness lift by collection method" loading={isLoading}>
          <DataTable
            columns={methodCols}
            rows={data?.byMethod ?? []}
            loading={isLoading}
            maxHeight="max-h-64"
            dense
            initialSort={{ key: "waves", dir: "desc" }}
            rowKey={(r) => r.method}
            emptyMessage="No survey methods recorded"
          />
        </ChartCard>
      </div>

      {/* Methodology note */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <p className="text-[11px] leading-relaxed text-amber-800">
          Pre/post waves measure change, not causation. Randomized control designs are required for causal incrementality claims.
        </p>
      </div>
    </div>
  );
}
