"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { OverviewResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE, GOOD, BAD } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtX, fmtMonth } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, Users, FileCheck2, Landmark, TrendingUp, Lightbulb, ShieldCheck, Activity, MousePointerClick,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function OverviewTab() {
  const { data, isLoading } = useAnalyticsQuery<OverviewResponse>("overview");
  const k = data?.kpis;

  const topCampaignCols: Column<OverviewResponse["topCampaigns"][number]>[] = [
    { key: "campaignTitle", header: "Campaign", cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-700">{r.campaignTitle}</p>
        <p className="text-[11px] text-slate-400">{r.campaignKey} · {r.channelGroup}</p>
      </div>
    ), sortValue: (r) => r.campaignTitle },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }) },
    { key: "fundedAccounts", header: "Funded Accts", align: "right", cell: (r) => fmtNumber(r.fundedAccounts) },
    { key: "cac", header: "CAC", align: "right", cell: (r) => fmtCurrency(r.cac) },
    { key: "contribution", header: "Contribution", align: "right", cell: (r) => fmtCurrency(r.contribution, { compact: true }) },
    { key: "roi", header: "ROI (obs.)", align: "right", cell: (r) => (
      <span className={cn("font-semibold", r.roi >= 0 ? "text-emerald-600" : "text-rose-600")}>{fmtX(r.roi)}</span>
    ) },
  ];

  const platformCols: Column<OverviewResponse["platformTable"][number]>[] = [
    { key: "platform", header: "Platform", cell: (r) => <span className="font-medium text-slate-700">{r.platform}</span> },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }) },
    { key: "impressions", header: "Impr.", align: "right", cell: (r) => fmtNumber(r.impressions, { compact: true }) },
    { key: "ctr", header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr, 2) },
    { key: "cpc", header: "CPC", align: "right", cell: (r) => fmtCurrency(r.cpc) },
    { key: "fundedAccounts", header: "Funded", align: "right", cell: (r) => fmtNumber(r.fundedAccounts) },
  ];

  return (
    <div className="space-y-4">
      {/* Insights strip */}
      {data?.insights?.length ? (
        <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 via-cyan-50 to-white p-3.5">
          <div className="flex items-center gap-2 text-teal-800">
            <Lightbulb className="h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold tracking-wide uppercase">Automated insights</p>
          </div>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {data.insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                {ins}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Marketing Spend" value={fmtCurrency(k?.spend, { compact: true })} delta={data?.deltas.spend} deltaLabel="vs prior period" icon={DollarSign} loading={isLoading} accent="slate" />
        <KpiCard label="Leads" value={fmtNumber(k?.leads)} delta={data?.deltas.leads} deltaLabel="vs prior period" icon={Users} loading={isLoading} accent="cyan" />
        <KpiCard label="Applications" value={fmtNumber(k?.applications)} icon={FileCheck2} loading={isLoading} accent="violet" description="submitted applications" />
        <KpiCard label="Funded Accounts" value={fmtNumber(k?.fundedAccounts)} delta={data?.deltas.fundedAccounts} deltaLabel="vs prior period" icon={Landmark} loading={isLoading} accent="teal" />
        <KpiCard label="Net Contribution" value={fmtCurrency(k?.contribution, { compact: true })} delta={data?.deltas.contribution} deltaLabel="observed to date" icon={TrendingUp} loading={isLoading} accent="rose" />
      </div>

      {/* Monthly + funnel */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Monthly performance"
          subtitle="Spend vs funded accounts and observed relationship contribution"
          className="xl:col-span-2"
          loading={isLoading}
        >
          {data?.monthly?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={62} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v, n) => (n.includes("Funded") ? fmtNumber(v) : fmtCurrency(v, { compact: true }))} labelFormatter={(l) => fmtMonth(String(l))} />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Area yAxisId="left" dataKey="contribution" name="Contribution" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.12} strokeWidth={2} />
                  <Line yAxisId="right" dataKey="fundedAccounts" name="Funded accounts" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
                  <Line yAxisId="right" dataKey="leads" name="Leads" stroke={CHART_COLORS[3]} strokeWidth={1.8} dot={false} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        <ChartCard title="Acquisition funnel" subtitle="Paid submissions through funded accounts" loading={isLoading}>
          {data?.funnel?.length ? (
            <div className="space-y-2.5 py-1">
              {data.funnel.map((stage, i) => {
                const maxVal = data.funnel[0]?.value ?? 1;
                const width = Math.max(2, (stage.value / maxVal) * 100);
                return (
                  <div key={stage.stage}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">{stage.stage}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {fmtNumber(stage.value)}
                        {i > 0 && stage.rate > 0 ? (
                          <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">
                            {fmtPct(stage.rate)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                      <div
                        className="flex h-full items-center justify-end rounded-md px-1.5 transition-all duration-500"
                        style={{ width: `${width}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length], opacity: 1 - i * 0.07 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* Channel mix + platform + right column */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Channel mix" subtitle="Spend and funded accounts by channel group" loading={isLoading}>
          {data?.channelMix?.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.channelMix}
                    dataKey="spend"
                    nameKey="channel"
                    innerRadius="52%"
                    outerRadius="78%"
                    paddingAngle={2}
                    strokeWidth={2}
                  >
                    {data.channelMix.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} />} />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={7} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        <ChartCard title="Platform scorecard" subtitle="Standardized cross-platform metrics" loading={isLoading}>
          <DataTable
            columns={platformCols}
            rows={data?.platformTable ?? []}
            loading={isLoading}
            maxHeight="max-h-60"
            dense
            initialSort={{ key: "spend", dir: "desc" }}
            rowKey={(r) => r.platform}
          />
        </ChartCard>

        <div className="space-y-4">
          <ChartCard title="Target attainment" subtitle="Funded accounts vs plan" loading={isLoading}>
            {data?.attainment ? (
              <div className="space-y-3 py-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold text-slate-900">{fmtPct(data.attainment.pct)}</span>
                  <span className="text-xs text-slate-400">
                    {fmtNumber(data.attainment.actualFunded)} / {fmtNumber(data.attainment.targetFunded)}
                  </span>
                </div>
                <Progress value={Math.min(100, data.attainment.pct * 100)} className="h-2.5" />
                <p className="text-[11px] text-slate-400">
                  Gap to plan: {fmtNumber(Math.max(0, data.attainment.targetFunded - data.attainment.actualFunded))} funded accounts
                </p>
              </div>
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          <ChartCard title="Data quality" subtitle="Gold layer governance signals" loading={isLoading}>
            {data?.dataQuality ? (
              <div className="space-y-2.5 py-1">
                <DqRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Campaign resolution" value={fmtPct(data.dataQuality.resolvedPct)} good={data.dataQuality.resolvedPct > 0.9} />
                <DqRow icon={<Activity className="h-3.5 w-3.5" />} label="Reconciliation rate" value={fmtPct(data.dataQuality.reconciliationRate)} good={data.dataQuality.reconciliationRate > 0.9} />
                <DqRow icon={<MousePointerClick className="h-3.5 w-3.5" />} label="Unresolved links" value={fmtNumber(data.dataQuality.pendingLinks)} good={data.dataQuality.pendingLinks < 60} />
                <DqRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Open GL variance" value={fmtCurrency(data.dataQuality.openVarianceUsd, { compact: true })} good={data.dataQuality.openVarianceUsd < 250000} />
              </div>
            ) : (
              <EmptyState />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Top campaigns */}
      <ChartCard
        title="Top campaigns by funded accounts"
        subtitle="Acquisition economics for the best-performing campaigns in range"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={topCampaignCols}
          rows={data?.topCampaigns ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          initialSort={{ key: "fundedAccounts", dir: "desc" }}
          rowKey={(r) => r.campaignKey}
        />
      </ChartCard>
    </div>
  );
}

function DqRow({ icon, label, value, good }: { icon: React.ReactNode; label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-xs text-slate-600">
        <span className="text-slate-400">{icon}</span>
        {label}
      </span>
      <Badge variant="outline" className={cn("text-[11px] font-semibold tabular-nums", good ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
        {value}
      </Badge>
    </div>
  );
}
