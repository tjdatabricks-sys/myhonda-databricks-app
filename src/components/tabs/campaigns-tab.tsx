"use client";

import { useMemo } from "react";
import { useAnalyticsQuery } from "@/lib/api";
import type { CampaignsResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE, GOOD, BAD, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtX, fmtMonth, safeDiv } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, Cell, LabelList,
} from "recharts";
import { Megaphone, Wallet, DollarSign, Users, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "In Review": "border-amber-200 bg-amber-50 text-amber-700",
};

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

function roiCell(roi: number) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        roi >= 1 ? "text-emerald-600" : roi >= 0 ? "text-amber-600" : "text-rose-600"
      )}
    >
      {fmtX(roi)}
    </span>
  );
}

function budgetPctCell(r: CampaignsResponse["rows"][number]) {
  const pct = Number.isFinite(r.budgetPct) ? r.budgetPct : 0;
  const fill = pct > 1 ? "bg-rose-500" : pct >= 0.85 ? "bg-amber-500" : "bg-teal-500";
  return (
    <div className="flex items-center justify-end gap-1.5">
      <div className="h-1.5 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
      </div>
      <span className="tabular-nums">{fmtPct(pct)}</span>
    </div>
  );
}

function ScatterTip({ active, payload }: { active?: boolean; payload?: { payload: CampaignsResponse["scatter"][number] }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE} className="min-w-[180px]">
      <p className="mb-1 truncate text-[11px] font-semibold text-slate-600">{p.campaignTitle}</p>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Spend</span>
          <span className="font-semibold text-slate-800 tabular-nums">{fmtCurrency(p.spend, { compact: true })}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Funded accounts</span>
          <span className="font-semibold text-slate-800 tabular-nums">{fmtNumber(p.fundedAccounts)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">CAC</span>
          <span className="font-semibold text-slate-800 tabular-nums">{fmtCurrency(p.cac)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">ROI</span>
          <span className={cn("font-semibold tabular-nums", p.roi >= 0 ? "text-emerald-600" : "text-rose-600")}>{fmtX(p.roi)}</span>
        </div>
      </div>
    </div>
  );
}

export function CampaignsTab() {
  const { data, isLoading } = useAnalyticsQuery<CampaignsResponse>("campaigns");

  const totals = useMemo(() => {
    const rs = data?.rows ?? [];
    let budget = 0;
    let spend = 0;
    let funded = 0;
    let contribution = 0;
    for (const r of rs) {
      budget += r.budget;
      spend += r.spend;
      funded += r.fundedAccounts;
      contribution += r.contribution;
    }
    return { count: rs.length, budget, spend, funded, contribution };
  }, [data]);

  const blendedCac = safeDiv(totals.spend, totals.funded);
  const blendedRoi = safeDiv(totals.contribution - totals.spend, totals.spend);

  const channelCols: Column<CampaignsResponse["channelSummary"][number]>[] = [
    { key: "channel", header: "Channel", cell: (r) => <span className="font-medium text-slate-700">{r.channel}</span>, sortValue: (r) => r.channel },
    { key: "campaigns", header: "Campaigns", align: "right", cell: (r) => fmtNumber(r.campaigns), sortValue: (r) => r.campaigns },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
    { key: "fundedAccounts", header: "Funded", align: "right", cell: (r) => fmtNumber(r.fundedAccounts), sortValue: (r) => r.fundedAccounts },
    { key: "cac", header: "CAC", align: "right", cell: (r) => cacCell(r.fundedAccounts, r.cac), sortValue: (r) => r.cac },
    { key: "roi", header: "ROI", align: "right", cell: (r) => roiCell(r.roi), sortValue: (r) => r.roi },
  ];

  const campaignCols: Column<CampaignsResponse["rows"][number]>[] = [
    {
      key: "campaignTitle", header: "Campaign", width: "230px",
      cell: (r) => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <p className="text-[11px] text-slate-400">{r.campaignKey}</p>
        </div>
      ),
      sortValue: (r) => r.campaignTitle,
    },
    { key: "channelGroup", header: "Channel", cell: (r) => <span className="text-slate-600">{r.channelGroup}</span>, sortValue: (r) => r.channelGroup },
    { key: "initiativeType", header: "Initiative", cell: (r) => <span className="text-slate-600">{r.initiativeType}</span>, sortValue: (r) => r.initiativeType },
    {
      key: "product", header: "Product",
      cell: (r) => <span className="block max-w-[150px] truncate text-slate-600" title={r.product}>{r.product}</span>,
      sortValue: (r) => r.product,
    },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <Badge variant="outline" className={cn("text-[11px] font-medium", STATUS_STYLES[r.status] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
          {r.status}
        </Badge>
      ),
      sortValue: (r) => r.status,
    },
    { key: "budget", header: "Budget", align: "right", cell: (r) => fmtCurrency(r.budget, { compact: true }), sortValue: (r) => r.budget },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
    { key: "budgetPct", header: "Budget %", align: "right", cell: (r) => budgetPctCell(r), sortValue: (r) => r.budgetPct },
    { key: "impressions", header: "Impr.", align: "right", cell: (r) => fmtNumber(r.impressions, { compact: true }), sortValue: (r) => r.impressions },
    { key: "clicks", header: "Clicks", align: "right", cell: (r) => fmtNumber(r.clicks, { compact: true }), sortValue: (r) => r.clicks },
    { key: "ctr", header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr, 2), sortValue: (r) => r.ctr },
    { key: "submissions", header: "Subs", align: "right", cell: (r) => fmtNumber(r.submissions), sortValue: (r) => r.submissions },
    { key: "leads", header: "Leads", align: "right", cell: (r) => fmtNumber(r.leads), sortValue: (r) => r.leads },
    { key: "applications", header: "Apps", align: "right", cell: (r) => fmtNumber(r.applications), sortValue: (r) => r.applications },
    { key: "fundedAccounts", header: "Funded", align: "right", cell: (r) => <span className="font-semibold text-slate-700">{fmtNumber(r.fundedAccounts)}</span>, sortValue: (r) => r.fundedAccounts },
    { key: "cac", header: "CAC", align: "right", cell: (r) => cacCell(r.fundedAccounts, r.cac), sortValue: (r) => r.cac },
    { key: "contribution", header: "Contribution", align: "right", cell: (r) => fmtCurrency(r.contribution, { compact: true }), sortValue: (r) => r.contribution },
    { key: "roi", header: "ROI", align: "right", cell: (r) => roiCell(r.roi), sortValue: (r) => r.roi },
  ];

  const scatter = data?.scatter ?? [];
  const positiveRoi = scatter.filter((p) => p.roi >= 0);
  const negativeRoi = scatter.filter((p) => p.roi < 0);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Campaigns" value={fmtNumber(totals.count)} icon={Megaphone} loading={isLoading} accent="teal" description="matching filters" />
        <KpiCard label="Total Budget" value={fmtCurrency(totals.budget, { compact: true })} icon={Wallet} loading={isLoading} accent="cyan" description="planned budgets" />
        <KpiCard label="Total Spend" value={fmtCurrency(totals.spend, { compact: true })} icon={DollarSign} loading={isLoading} accent="slate" description="delivered to date" />
        <KpiCard label="Funded Accounts" value={fmtNumber(totals.funded)} icon={Users} loading={isLoading} accent="violet" description="across campaigns" />
        <KpiCard label="Blended CAC" value={fmtCurrency(blendedCac)} icon={Target} loading={isLoading} accent="amber" description="spend / funded" />
        <KpiCard label="Blended ROI" value={fmtX(blendedRoi)} icon={TrendingUp} loading={isLoading} accent="rose" description="(contribution - spend) / spend" />
      </div>

      {/* Monthly trend + channel spend distribution */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Monthly trend"
          subtitle="Spend, funded accounts and observed contribution by month"
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
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(v, n) => (n.includes("Funded") ? fmtNumber(v) : fmtCurrency(v, { compact: true }))}
                        labelFormatter={(m) => fmtMonth(String(m))}
                      />
                    }
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Bar yAxisId="left" dataKey="spend" name="Spend" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Line yAxisId="right" dataKey="fundedAccounts" name="Funded accounts" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
                  <Line yAxisId="left" dataKey="contribution" name="Contribution" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No monthly data for the selected filters" />
          )}
        </ChartCard>

        <ChartCard title="Spend by channel" subtitle="Channel-group spend distribution" loading={isLoading}>
          {data?.channelSummary?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.channelSummary} layout="vertical" margin={{ top: 5, right: 56, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} />
                  <YAxis type="category" dataKey="channel" width={88} {...AXIS} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Bar dataKey="spend" name="Spend" radius={[0, 3, 3, 0]} maxBarSize={18}>
                    {data.channelSummary.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList dataKey="spend" position="right" fontSize={10} fill="#475569" formatter={(v) => (typeof v === "number" ? fmtCurrency(v, { compact: true }) : String(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No channel data" />
          )}
        </ChartCard>
      </div>

      {/* Scatter + channel economics table */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Budget vs performance"
          subtitle="Spend vs funded accounts; bubble size = CAC, color = ROI sign"
          loading={isLoading}
        >
          {scatter.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="spend" name="Spend" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} />
                  <YAxis type="number" dataKey="fundedAccounts" name="Funded" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                  <ZAxis type="number" dataKey="cac" name="CAC" range={[50, 350]} />
                  <Tooltip content={<ScatterTip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Scatter name="Positive ROI" data={positiveRoi} fill={GOOD} fillOpacity={0.7} />
                  <Scatter name="Negative ROI" data={negativeRoi} fill={BAD} fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No campaign performance data" />
          )}
        </ChartCard>

        <ChartCard
          title="Channel summary"
          subtitle="Campaigns, spend, funded accounts, CAC and ROI by channel group"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={channelCols}
            rows={data?.channelSummary ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "spend", dir: "desc" }}
            rowKey={(r) => r.channel}
            emptyMessage="No channel data for the selected filters"
          />
        </ChartCard>
      </div>

      {/* Campaign master */}
      <ChartCard
        title="Campaign master"
        subtitle="Every campaign in the gold master with budgets, delivery, funnel outcomes and acquisition economics"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={campaignCols}
          rows={data?.rows ?? []}
          loading={isLoading}
          maxHeight="max-h-96"
          dense
          initialSort={{ key: "spend", dir: "desc" }}
          rowKey={(r) => r.campaignKey}
          emptyMessage="No campaigns match the current filters"
        />
      </ChartCard>
    </div>
  );
}
