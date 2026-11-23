"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { FinanceResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE, NEUTRAL, GOOD, BAD } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtMonth } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, LabelList,
} from "recharts";
import { CreditCard, Receipt, BookOpenCheck, Scale, CheckCircle2, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

function varianceTone(v: number): string {
  if (v > 0) return "text-emerald-600";
  if (v < 0) return "text-rose-600";
  return "text-slate-500";
}

function reconStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("unmatched")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (s.includes("matched")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("pending") || s.includes("review")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("variance") || s.includes("escalat")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (s.includes("tolerance")) return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function lineResolutionClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("unresolv") || s.includes("unmatch")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (s.includes("resolv") || s.includes("match")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("pend")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function sourceTableLabel(sourceTable: string): string {
  return sourceTable.length > 20 ? `${sourceTable.slice(0, 19)}…` : sourceTable;
}

export function FinanceTab() {
  const { data, isLoading } = useAnalyticsQuery<FinanceResponse>("finance");
  const k = data?.kpis;

  const varianceCols: Column<FinanceResponse["varianceByCampaign"][number]>[] = [
    {
      key: "campaignTitle", header: "Campaign", cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <p className="text-[11px] text-slate-400">{r.campaignKey}</p>
        </div>
      ), sortValue: (r) => r.campaignTitle,
    },
    { key: "platformSpend", header: "Platform Spend", align: "right", cell: (r) => fmtCurrency(r.platformSpend, { compact: true }), sortValue: (r) => r.platformSpend },
    { key: "invoiced", header: "Invoiced", align: "right", cell: (r) => fmtCurrency(r.invoiced, { compact: true }), sortValue: (r) => r.invoiced },
    {
      key: "variance", header: "Variance", align: "right", cell: (r) => (
        <span className={cn("font-semibold tabular-nums", varianceTone(r.variance))}>
          {r.variance > 0 ? "+" : ""}{fmtCurrency(r.variance, { compact: true })}
        </span>
      ), sortValue: (r) => r.variance,
    },
    {
      key: "variancePct", header: "Variance %", align: "right", cell: (r) => (
        <span className={cn("font-semibold tabular-nums", varianceTone(r.variancePct))}>{fmtPct(r.variancePct)}</span>
      ), sortValue: (r) => r.variancePct,
    },
  ];

  const vendorLineCols: Column<FinanceResponse["vendorLines"][number]>[] = [
    { key: "sourceTable", header: "Source", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.sourceTable}</span> },
    { key: "platform", header: "Platform", cell: (r) => <span className="text-slate-600">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "period", header: "Period", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.period}</span> },
    { key: "campaignTitle", header: "Campaign", cell: (r) => <span className="block max-w-[150px] truncate text-slate-600">{r.campaignTitle}</span> },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
    { key: "impressions", header: "Impressions", align: "right", cell: (r) => fmtNumber(r.impressions, { compact: true }), sortValue: (r) => r.impressions },
    { key: "clicks", header: "Clicks", align: "right", cell: (r) => fmtNumber(r.clicks, { compact: true }), sortValue: (r) => r.clicks },
    { key: "cpc", header: "CPC", align: "right", cell: (r) => fmtCurrency(r.cpc), sortValue: (r) => r.cpc },
    {
      key: "status", header: "Resolution", cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", lineResolutionClass(r.status))}>{r.status}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Platform Spend" value={fmtCurrency(k?.platformSpend, { compact: true })} icon={CreditCard} loading={isLoading} accent="slate" description="vendor platform totals" />
        <KpiCard label="Invoiced" value={fmtCurrency(k?.invoiced, { compact: true })} icon={Receipt} loading={isLoading} accent="cyan" description="net invoice lines" />
        <KpiCard label="GL Posted" value={fmtCurrency(k?.glPosted, { compact: true })} icon={BookOpenCheck} loading={isLoading} accent="violet" description="posted to general ledger" />
        <KpiValueCard
          label="Invoice−GL Variance"
          value={fmtCurrency(k?.invoiceGlVariance, { compact: true })}
          valueClassName={k ? varianceTone(k.invoiceGlVariance) : undefined}
          icon={Scale}
          accent="amber"
          description="invoice net minus GL posted"
          loading={isLoading}
        />
        <KpiCard label="Reconciliation Rate" value={fmtPct(k?.reconciliationRate)} icon={CheckCircle2} loading={isLoading} accent="teal" description="share of finance links matched" />
        <KpiCard
          label="Pending Links"
          value={fmtNumber(k?.pendingLinks)}
          icon={Hourglass}
          loading={isLoading}
          accent="rose"
          description={`open variance ${fmtCurrency(k?.openVarianceUsd, { compact: true })}`}
        />
      </div>

      {/* Three-way reconciliation + status mix */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Three-way reconciliation"
          subtitle="Platform spend vs invoiced net vs GL posted by month, with invoice−GL variance on the right axis"
          loading={isLoading}
        >
          {data?.monthly?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={62} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={56} />
                  <Tooltip
                    content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} labelFormatter={(l) => fmtMonth(String(l))} />}
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Bar yAxisId="left" dataKey="platformSpend" name="Platform spend" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar yAxisId="left" dataKey="invoiceNet" name="Invoiced net" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Line yAxisId="left" dataKey="glNet" name="GL posted" stroke={CHART_COLORS[3]} strokeWidth={2.5} dot={false} />
                  <Line yAxisId="right" dataKey="variance" name="Variance" stroke={NEUTRAL} strokeWidth={1.8} strokeDasharray="5 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No reconciliation activity in the selected range" />
          )}
        </ChartCard>

        <ChartCard title="Reconciliation status mix" subtitle="Campaign-month linkage by reconciliation status" loading={isLoading}>
          {data?.statusMix?.length ? (
            <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-thin py-1 pr-1">
              {data.statusMix.map((s) => (
                <div key={s.status} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={cn("max-w-[72%] truncate text-[10.5px]", reconStatusClass(s.status))}>{s.status}</Badge>
                    <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">{fmtNumber(s.links)} links</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Invoiced</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700 tabular-nums">{fmtCurrency(s.invoiceNet, { compact: true })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">GL posted</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700 tabular-nums">{fmtCurrency(s.glNet, { compact: true })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No reconciliation statuses to show" />
          )}
        </ChartCard>
      </div>

      {/* Variance by campaign */}
      <ChartCard
        title="Variance by campaign"
        subtitle="Platform spend vs invoiced amounts by campaign, ranked by open variance"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={varianceCols}
          rows={data?.varianceByCampaign ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "variance", dir: "desc" }}
          rowKey={(r) => r.campaignKey}
          emptyMessage="No campaign variance in range"
        />
      </ChartCard>

      {/* Vendor media lines + GL vs invoice */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Vendor media lines"
          subtitle="Raw vendor delivery lines by source report with campaign linkage resolution"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={vendorLineCols}
            rows={data?.vendorLines ?? []}
            loading={isLoading}
            maxHeight="max-h-96"
            dense
            initialSort={{ key: "spend", dir: "desc" }}
            rowKey={(r, i) => `${r.sourceTable}-${r.period}-${i}`}
            emptyMessage="No vendor media lines in range"
          />
        </ChartCard>

        <ChartCard
          title="GL vs invoice by month"
          subtitle="Posted GL net vs invoiced net by month with invoice−GL variance bars"
          loading={isLoading}
        >
          {data?.glMonthly?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.glMonthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={62} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={56} />
                  <Tooltip
                    content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} labelFormatter={(l) => fmtMonth(String(l))} />}
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Bar yAxisId="right" dataKey="variance" name="Variance" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {data.glMonthly.map((m, i) => (
                      <Cell key={i} fill={m.variance >= 0 ? GOOD : BAD} />
                    ))}
                  </Bar>
                  <Line yAxisId="left" dataKey="invoiceNet" name="Invoiced net" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
                  <Line yAxisId="left" dataKey="glNet" name="GL posted" stroke={CHART_COLORS[3]} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No GL postings in the selected range" />
          )}
        </ChartCard>
      </div>

      {/* Spend by source table */}
      <ChartCard
        title="Spend by source table"
        subtitle="Vendor media spend and row counts by reporting source table"
        loading={isLoading}
      >
        {data?.sourceMix?.length ? (
          <div className="space-y-3 pt-1">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sourceMix} layout="vertical" margin={{ top: 5, right: 64, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} />
                  <YAxis
                    type="category"
                    dataKey="sourceTable"
                    width={128}
                    {...AXIS}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(v: string) => sourceTableLabel(v)}
                    interval={0}
                  />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Bar dataKey="spend" name="Spend" radius={[0, 3, 3, 0]} maxBarSize={18}>
                    {data.sourceMix.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList dataKey="spend" position="right" fontSize={10} fill="#475569" formatter={(v) => (typeof v === "number" ? fmtCurrency(v, { compact: true }) : String(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <Separator className="mb-2 bg-slate-100" />
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
                {data.sourceMix.map((s) => (
                  <div key={s.sourceTable} className="rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                    <p className="truncate font-mono text-[10px] text-slate-500" title={s.sourceTable}>{sourceTableLabel(s.sourceTable)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700 tabular-nums">{fmtNumber(s.rows)} rows</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState message="No source tables in range" />
        )}
      </ChartCard>
    </div>
  );
}
