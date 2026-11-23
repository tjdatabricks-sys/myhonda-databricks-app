"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { PaidMediaResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtX, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, LabelList,
} from "recharts";
import { DollarSign, Eye, MousePointerClick, Percent, Coins, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function cacCell(funded: number, cac: number) {
  if (funded <= 0) return <span className="text-slate-400">-</span>;
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        cac < 500 ? "text-emerald-600" : cac < 1000 ? "text-amber-600" : "text-rose-600"
      )}
    >
      {fmtCurrency(cac)}
    </span>
  );
}

function adResolutionClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("resolv") && !s.includes("unresolv")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function PaidMediaTab() {
  const { data, isLoading } = useAnalyticsQuery<PaidMediaResponse>("paid-media");
  const k = data?.kpis;

  const platformCols: Column<PaidMediaResponse["platform"][number]>[] = [
    { key: "platform", header: "Platform", cell: (r) => <span className="font-medium text-slate-700">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
    { key: "impressions", header: "Impr.", align: "right", cell: (r) => fmtNumber(r.impressions, { compact: true }), sortValue: (r) => r.impressions },
    { key: "clicks", header: "Clicks", align: "right", cell: (r) => fmtNumber(r.clicks, { compact: true }), sortValue: (r) => r.clicks },
    { key: "ctr", header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr, 2), sortValue: (r) => r.ctr },
    { key: "cpc", header: "CPC", align: "right", cell: (r) => fmtCurrency(r.cpc), sortValue: (r) => r.cpc },
    { key: "cpm", header: "CPM", align: "right", cell: (r) => fmtCurrency(r.cpm), sortValue: (r) => r.cpm },
    { key: "submissions", header: "Submissions", align: "right", cell: (r) => fmtNumber(r.submissions), sortValue: (r) => r.submissions },
    { key: "fundedAccounts", header: "Funded", align: "right", cell: (r) => fmtNumber(r.fundedAccounts), sortValue: (r) => r.fundedAccounts },
    { key: "cac", header: "CAC", align: "right", cell: (r) => cacCell(r.fundedAccounts, r.cac), sortValue: (r) => r.cac },
  ];

  const reachCols: Column<PaidMediaResponse["reach"][number]>[] = [
    {
      key: "campaignTitle", header: "Campaign",
      cell: (r) => (
        <div className="min-w-0">
          <p className="max-w-[200px] truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <p className="text-[11px] text-slate-400">{r.campaignKey}</p>
        </div>
      ),
      sortValue: (r) => r.campaignTitle,
    },
    { key: "platform", header: "Platform", cell: (r) => <span className="text-slate-600">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "uniqueReach", header: "Unique Reach", align: "right", cell: (r) => fmtNumber(r.uniqueReach, { compact: true }), sortValue: (r) => r.uniqueReach },
    { key: "impressions", header: "Impressions", align: "right", cell: (r) => fmtNumber(r.impressions, { compact: true }), sortValue: (r) => r.impressions },
    { key: "frequency", header: "Frequency", align: "right", cell: (r) => fmtX(r.frequency), sortValue: (r) => r.frequency },
  ];

  const adCols: Column<PaidMediaResponse["ads"][number]>[] = [
    {
      key: "adId", header: "Ad",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{r.adId}</p>
          <p className="max-w-[200px] truncate text-[11px] text-slate-400">{r.campaignTitle}</p>
        </div>
      ),
      sortValue: (r) => r.adId,
    },
    { key: "platform", header: "Platform", cell: (r) => <span className="text-slate-600">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "format", header: "Format", cell: (r) => <span className="text-slate-600">{r.format}</span>, sortValue: (r) => r.format },
    { key: "market", header: "Market", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.market}</span>, sortValue: (r) => r.market },
    {
      key: "flight", header: "Flight",
      cell: (r) => <span className="font-mono text-[11px] text-slate-500">{fmtDate(r.effectiveStart)} → {fmtDate(r.effectiveEnd)}</span>,
      sortValue: (r) => r.effectiveStart,
    },
    {
      key: "resolutionStatus", header: "Resolution",
      cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", adResolutionClass(r.resolutionStatus))}>{r.resolutionStatus}</Badge>
      ),
      sortValue: (r) => r.resolutionStatus,
    },
  ];

  const daily = data?.daily ?? [];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Spend" value={fmtCurrency(k?.spend, { compact: true })} icon={DollarSign} loading={isLoading} accent="slate" description="paid media delivery" />
        <KpiCard label="Impressions" value={fmtNumber(k?.impressions, { compact: true })} icon={Eye} loading={isLoading} accent="cyan" description="across platforms" />
        <KpiCard label="Clicks" value={fmtNumber(k?.clicks, { compact: true })} icon={MousePointerClick} loading={isLoading} accent="amber" description="billable clicks" />
        <KpiCard label="CTR" value={fmtPct(k?.ctr, 2)} icon={Percent} loading={isLoading} accent="teal" description="clicks / impressions" />
        <KpiCard label="CPC" value={fmtCurrency(k?.cpc)} icon={Coins} loading={isLoading} accent="violet" description="cost per click" />
        <KpiCard label="CPM" value={fmtCurrency(k?.cpm)} icon={BarChart3} loading={isLoading} accent="rose" description="cost per 1,000 impressions" />
      </div>

      {/* Daily delivery */}
      <ChartCard title="Daily delivery" subtitle="Daily spend and clicks across all paid platforms" loading={isLoading}>
        {daily.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  {...AXIS}
                  interval={daily.length > 120 ? "preserveStartEnd" : undefined}
                />
                <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={62} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v, n) => (n.includes("Clicks") ? fmtNumber(v) : fmtCurrency(v, { compact: true }))}
                      labelFormatter={(l) => fmtDate(String(l))}
                    />
                  }
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Area yAxisId="left" dataKey="spend" name="Spend" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
                <Line yAxisId="right" dataKey="clicks" name="Clicks" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No daily delivery data for the selected filters" />
        )}
      </ChartCard>

      {/* Platform performance */}
      <ChartCard
        title="Platform performance"
        subtitle="Standardized cross-platform delivery and acquisition economics"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={platformCols}
          rows={data?.platform ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "spend", dir: "desc" }}
          rowKey={(r) => r.platform}
          emptyMessage="No platform data for the selected filters"
        />
      </ChartCard>

      {/* Format mix + model vs vendor */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Creative format mix" subtitle="Spend distribution by creative format" loading={isLoading}>
          {data?.format?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.format} layout="vertical" margin={{ top: 5, right: 56, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} />
                  <YAxis type="category" dataKey="format" width={88} {...AXIS} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Bar dataKey="spend" name="Spend" radius={[0, 3, 3, 0]} maxBarSize={18}>
                    {data.format.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList dataKey="spend" position="right" fontSize={10} fill="#475569" formatter={(v) => (typeof v === "number" ? fmtCurrency(v, { compact: true }) : String(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No creative format data" />
          )}
        </ChartCard>

        <ChartCard title="Model vs vendor spend" subtitle="Modeled platform spend vs vendor-invoiced spend with variance" loading={isLoading}>
          {data?.vendorVsModel?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.vendorVsModel} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="platform" {...AXIS} interval={0} />
                  <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={62} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtPct(v)} {...AXIS} width={52} />
                  <Tooltip
                    content={
                      <ChartTooltip valueFormatter={(v, n) => (n.includes("Variance") ? fmtPct(v) : fmtCurrency(v, { compact: true }))} />
                    }
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Bar yAxisId="left" dataKey="modelSpend" name="Model spend" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar yAxisId="left" dataKey="vendorSpend" name="Vendor spend" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Line yAxisId="right" dataKey="variancePct" name="Variance" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No vendor reconciliation data" />
          )}
        </ChartCard>
      </div>

      {/* Reach + top ads */}
      <div className="grid gap-4 xl:grid-cols-5">
        <ChartCard
          title="Reach & frequency"
          subtitle="Unique audience reach and average frequency by campaign"
          className="xl:col-span-2"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={reachCols}
            rows={data?.reach ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "uniqueReach", dir: "desc" }}
            rowKey={(r) => `${r.campaignKey}:${r.platform}`}
            emptyMessage="No reach data for the selected filters"
          />
        </ChartCard>

        <ChartCard
          title="Ad registry"
          subtitle="Creative units with platform, format, market, flight window and link resolution"
          className="xl:col-span-3"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={adCols}
            rows={data?.ads ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "adId", dir: "asc" }}
            rowKey={(r) => r.adId}
            emptyMessage="No ad-level data for the selected filters"
          />
        </ChartCard>
      </div>
    </div>
  );
}
