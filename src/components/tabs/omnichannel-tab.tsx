"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { OmnichannelResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtMonth } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Mail, MailCheck, Signpost, MonitorPlay, Tv, PhoneCall, Users, Handshake, Building2, Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- offline channel activity helpers ----------

const CHANNEL_ORDER = ["Billboard", "DOOH", "Broadcast TV", "Call Center", "Branch Event", "Referral"];

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  Billboard: Signpost,
  DOOH: MonitorPlay,
  "Broadcast TV": Tv,
  "Call Center": PhoneCall,
  "Branch Event": Building2,
  Referral: Handshake,
};

const METRIC_LABELS: Record<string, string> = {
  impressions: "Impressions",
  attendees: "Attendees",
  estimated_reach: "Estimated reach",
  spots_aired: "Spots aired",
  calls: "Calls",
  plays: "Plays",
  referrals_completed: "Referrals completed",
};

function humanizeMetric(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Large-audience metrics render compact on the y-axis. */
function isCompactMetric(metric: string): boolean {
  return metric.includes("impression") || metric.includes("reach");
}

interface ActivityMetric {
  metric: string;
  monthly: { month: string; value: number }[];
}

interface ActivityChannel {
  channel: string;
  metrics: ActivityMetric[];
}

/** Compact monthly area chart tile for a single offline channel metric. */
function ActivityTile({ metric, monthly, colorIndex, className }: { metric: string; monthly: { month: string; value: number }[]; colorIndex: number; className?: string }) {
  const compact = isCompactMetric(metric);
  const label = humanizeMetric(metric);
  const color = CHART_COLORS[colorIndex % CHART_COLORS.length];
  const latest = monthly.length ? monthly[monthly.length - 1].value : null;
  return (
    <div className={cn("rounded-lg border border-slate-200 p-3", className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {latest != null ? (
          <p className="text-[11px] tabular-nums text-slate-500">
            latest <span className="font-semibold text-slate-700">{fmtNumber(latest, { compact })}</span>
          </p>
        ) : null}
      </div>
      {monthly.length ? (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v: number) => fmtNumber(v, { compact })} {...AXIS} width={48} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v, { compact })} labelFormatter={(l) => fmtMonth(String(l))} />} />
              <Area dataKey="value" name={label} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-10 text-center text-xs text-slate-400">No activity in range</p>
      )}
    </div>
  );
}

/** Small status pill: emerald when positive, amber when warning, rose when negative, slate otherwise. */
function toneBadge(value: string, positive: string[], warning: string[], negative: string[] = []) {
  const cls = positive.includes(value)
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : warning.includes(value)
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : negative.includes(value)
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "text-slate-500";
  return (
    <Badge variant="outline" className={cn("text-[10.5px]", cls)}>
      {value}
    </Badge>
  );
}

export function OmnichannelTab() {
  const { data, isLoading } = useAnalyticsQuery<OmnichannelResponse>("omnichannel");
  const k = data?.kpis;

  // Median cost-per-response across DM campaigns, used for relative cost coloring
  const dmCampaigns = data?.directMailCampaigns ?? [];
  const sortedCpr = dmCampaigns
    .map((c) => c.costPerResponse)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  const cprMedian = sortedCpr.length > 0 ? sortedCpr[Math.floor(sortedCpr.length / 2)] : 0;

  // Group the flat channel/metric series into one entry per channel (tab), metrics in API order
  const grouped: ActivityChannel[] = [];
  for (const entry of data?.channelActivity ?? []) {
    const existing = grouped.find((g) => g.channel === entry.channel);
    if (existing) existing.metrics.push({ metric: entry.metric, monthly: entry.monthly });
    else grouped.push({ channel: entry.channel, metrics: [{ metric: entry.metric, monthly: entry.monthly }] });
  }
  const activityChannels: ActivityChannel[] = CHANNEL_ORDER.map((name) => grouped.find((g) => g.channel === name))
    .filter((g): g is ActivityChannel => g != null)
    .concat(grouped.filter((g) => !CHANNEL_ORDER.includes(g.channel)));

  const dmCols: Column<OmnichannelResponse["directMailCampaigns"][number]>[] = [
    {
      key: "campaignTitle",
      header: "Campaign",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <p className="text-[11px] text-slate-400">{r.campaignKey}</p>
        </div>
      ),
      sortValue: (r) => r.campaignTitle,
    },
    { key: "jobs", header: "Jobs", align: "right", cell: (r) => fmtNumber(r.jobs), sortValue: (r) => r.jobs },
    { key: "delivered", header: "Delivered", align: "right", cell: (r) => fmtNumber(r.delivered), sortValue: (r) => r.delivered },
    { key: "responses", header: "Responses", align: "right", cell: (r) => fmtNumber(r.responses), sortValue: (r) => r.responses },
    { key: "responseRate", header: "Response Rate", align: "right", cell: (r) => fmtPct(r.responseRate), sortValue: (r) => r.responseRate },
    { key: "qrRate", header: "QR Rate", align: "right", cell: (r) => fmtPct(r.qrRate, 2), sortValue: (r) => r.qrRate },
    { key: "cost", header: "Cost", align: "right", cell: (r) => fmtCurrency(r.cost, { compact: true }), sortValue: (r) => r.cost },
    {
      key: "costPerResponse",
      header: "Cost / Response",
      align: "right",
      cell: (r) => (
        <span
          className={cn(
            "font-semibold tabular-nums",
            cprMedian > 0 && r.costPerResponse <= cprMedian
              ? "text-emerald-600"
              : cprMedian > 0 && r.costPerResponse <= cprMedian * 1.5
                ? "text-amber-600"
                : "text-rose-600"
          )}
        >
          {fmtCurrency(r.costPerResponse)}
        </span>
      ),
      sortValue: (r) => r.costPerResponse,
    },
  ];

  // One column per metric present in the payload, in delivery order
  const offlineRows = data?.offlineByCampaign ?? [];
  const offlineMetrics = [...new Set(offlineRows.flatMap((r) => r.metrics.map((m) => m.metric)))];
  const offlineCols: Column<OmnichannelResponse["offlineByCampaign"][number]>[] = [
    {
      key: "campaignTitle",
      header: "Campaign",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <Badge variant="outline" className="mt-0.5 text-[10px] text-slate-500">
            {r.channel}
          </Badge>
        </div>
      ),
      sortValue: (r) => r.campaignTitle,
    },
    ...offlineMetrics.map(
      (metric): Column<OmnichannelResponse["offlineByCampaign"][number]> => ({
        key: metric,
        header: humanizeMetric(metric),
        align: "right",
        cell: (r) =>
          fmtNumber(r.metrics.find((m) => m.metric === metric)?.value, isCompactMetric(metric) ? { compact: true } : undefined),
        sortValue: (r) => r.metrics.find((m) => m.metric === metric)?.value ?? 0,
      })
    ),
  ];

  const branchCols: Column<OmnichannelResponse["branchDirectory"][number]>[] = [
    { key: "branchCode", header: "Code", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.branchCode}</span>, sortValue: (r) => r.branchCode },
    { key: "branchName", header: "Branch", cell: (r) => <span className="font-medium text-slate-700">{r.branchName}</span>, sortValue: (r) => r.branchName },
    { key: "market", header: "Market", cell: (r) => <span className="text-slate-600">{r.market}</span>, sortValue: (r) => r.market },
    { key: "type", header: "Type", cell: (r) => r.type, sortValue: (r) => r.type },
    { key: "status", header: "Status", cell: (r) => toneBadge(r.status, ["Open"], [], ["Closed"]), sortValue: (r) => r.status },
  ];

  const vendorCols: Column<OmnichannelResponse["vendorCampaigns"][number]>[] = [
    {
      key: "campaign",
      header: "Campaign",
      cell: (r) => (
        <span className="block max-w-[220px] truncate font-medium text-slate-700" title={r.campaign}>
          {r.campaign}
        </span>
      ),
      sortValue: (r) => r.campaign,
    },
    { key: "platform", header: "Platform", cell: (r) => <span className="text-slate-600">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "vendorSystem", header: "Vendor System", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.vendorSystem}</span>, sortValue: (r) => r.vendorSystem },
    { key: "status", header: "Status", cell: (r) => toneBadge(r.status, ["Active"], ["Paused"]), sortValue: (r) => r.status },
    { key: "budget", header: "Budget", align: "right", cell: (r) => fmtCurrency(r.budget, { compact: true }), sortValue: (r) => r.budget },
    { key: "flight", header: "Flight", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.flight}</span>, sortValue: (r) => r.flight },
  ];

  return (
    <div className="space-y-4">
      {/* Offline KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="DM Delivered"
          value={fmtNumber(k?.dmDelivered, { compact: true })}
          icon={Mail}
          loading={isLoading}
          accent="teal"
          description="direct mail pieces delivered"
        />
        <KpiCard
          label="DM Response Rate"
          value={fmtPct(k?.dmResponseRate)}
          icon={MailCheck}
          loading={isLoading}
          accent="cyan"
          description={k ? `responses / delivered · QR scan ${fmtPct(k.qrScanRate)}` : undefined}
        />
        <KpiCard label="Billboard Impressions" value={fmtNumber(k?.billboardImpressions, { compact: true })} icon={Signpost} loading={isLoading} accent="amber" description="static out-of-home panels" />
        <KpiCard label="DOOH Plays" value={fmtNumber(k?.doohPlays, { compact: true })} icon={MonitorPlay} loading={isLoading} accent="violet" description="digital out-of-home networks" />
        <KpiCard label="TV Spots Aired" value={fmtNumber(k?.tvSpots, { compact: true })} icon={Tv} loading={isLoading} accent="rose" description="broadcast spots aired" />
        <KpiCard
          label="Call Center Calls"
          value={fmtNumber(k?.calls, { compact: true })}
          icon={PhoneCall}
          loading={isLoading}
          accent="slate"
          description={k ? `${fmtPct(k.connectedRate)} connected` : undefined}
        />
        <KpiCard label="Branch Attendees" value={fmtNumber(k?.branchAttendees, { compact: true })} icon={Users} loading={isLoading} accent="teal" description="across hosted branch events" />
        <KpiCard label="Referrals Completed" value={fmtNumber(k?.referralCompleted, { compact: true })} icon={Handshake} loading={isLoading} accent="cyan" description="successful referral conversions" />
      </div>

      {/* Channel economics */}
      <ChartCard title="Channel economics" subtitle="Spend and funded accounts by acquisition channel with blended CAC (dual axis)" loading={isLoading}>
        {data?.channelCompare?.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.channelCompare} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="channel" {...AXIS} interval={0} angle={-18} textAnchor="end" height={52} tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={56} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtNumber(v, { decimals: 0 })} {...AXIS} width={44} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v, n) => (n === "CAC" ? fmtCurrency(v) : n.includes("Spend") ? fmtCurrency(v, { compact: true }) : fmtNumber(v))}
                    />
                  }
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Bar yAxisId="left" dataKey="spend" name="Spend" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar yAxisId="right" dataKey="fundedAccounts" name="Funded accounts" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line yAxisId="right" dataKey="cac" name="CAC" stroke={CHART_COLORS[3]} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No channel data in range" />
        )}
      </ChartCard>

      {/* ---------------- Direct Mail ---------------- */}
      <ChartCard title="Direct mail volume and response" subtitle="Monthly delivered pieces with response trend (dual axis)" loading={isLoading}>
        {data?.directMailMonthly?.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.directMailMonthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={48} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtNumber(v)} {...AXIS} width={44} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v)} labelFormatter={(l) => fmtMonth(String(l))} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Bar yAxisId="left" dataKey="delivered" name="Delivered" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line yAxisId="right" dataKey="responses" name="Responses" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No direct mail jobs in range" />
        )}
      </ChartCard>

      <ChartCard
        title="Direct mail campaigns"
        subtitle="Jobs, response quality and cost efficiency by campaign"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={dmCols}
          rows={dmCampaigns}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "delivered", dir: "desc" }}
          rowKey={(r, i) => `${r.campaignKey}-dm-${i}`}
          emptyMessage="No direct mail campaigns in range"
        />
      </ChartCard>

      {/* ---------------- Offline channel activity ---------------- */}
      <ChartCard title="Offline channel activity" subtitle="Monthly delivery volume by offline channel and metric" loading={isLoading}>
        {activityChannels.length ? (
          <Tabs defaultValue={activityChannels[0].channel}>
            <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto sm:flex-wrap">
              {activityChannels.map((ch) => {
                const Icon = CHANNEL_ICONS[ch.channel] ?? Activity;
                return (
                  <TabsTrigger key={ch.channel} value={ch.channel} className="gap-1.5 text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    {ch.channel}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {activityChannels.map((ch) => (
              <TabsContent key={ch.channel} value={ch.channel} className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {ch.metrics.map((m, mi) => (
                    <ActivityTile
                      key={m.metric}
                      metric={m.metric}
                      monthly={m.monthly}
                      colorIndex={mi}
                      className={ch.metrics.length === 1 ? "md:col-span-2" : undefined}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <EmptyState message="No offline activity in range" />
        )}
      </ChartCard>

      {/* ---------------- Offline activity by campaign ---------------- */}
      <ChartCard
        title="Offline activity by campaign"
        subtitle="Delivery metrics per offline campaign, as reported by channel"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={offlineCols}
          rows={offlineRows}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          rowKey={(r, i) => `${r.campaignKey}-off-${i}`}
          emptyMessage="No offline campaign activity in range"
        />
      </ChartCard>

      {/* ---------------- Call Center ---------------- */}
      <ChartCard title="Monthly call volume" subtitle="Inbound calls with connected and converted outcomes (dual axis)" loading={isLoading}>
        {data?.callsMonthly?.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.callsMonthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={48} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtNumber(v)} {...AXIS} width={44} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v)} labelFormatter={(l) => fmtMonth(String(l))} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Bar yAxisId="left" dataKey="calls" name="Calls" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line yAxisId="right" dataKey="connected" name="Connected" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={false} />
                <Line yAxisId="right" dataKey="converted" name="Converted" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No call activity in range" />
        )}
      </ChartCard>

      {/* ---------------- Branch directory ---------------- */}
      <ChartCard
        title="Branch directory"
        subtitle="Branch network footprint by market, format and status"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={branchCols}
          rows={data?.branchDirectory ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "branchName", dir: "asc" }}
          rowKey={(r) => r.branchCode}
          emptyMessage="No branches in range"
        />
      </ChartCard>

      {/* ---------------- Vendor campaigns ---------------- */}
      <ChartCard
        title="Vendor campaigns"
        subtitle="Platform campaign buys with vendor system of record, budget and flight"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={vendorCols}
          rows={data?.vendorCampaigns ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "budget", dir: "desc" }}
          rowKey={(r, i) => `${r.campaign}-vc-${i}`}
          emptyMessage="No vendor campaigns in range"
        />
      </ChartCard>
    </div>
  );
}
