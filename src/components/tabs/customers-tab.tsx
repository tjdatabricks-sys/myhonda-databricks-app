"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { CustomersResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtMonth } from "@/lib/format";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, UserCheck, Clock, Smartphone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export function CustomersTab() {
  const { data, isLoading } = useAnalyticsQuery<CustomersResponse>("customers");
  const k = data?.kpis;
  const overallRate = k?.leadToCustomerRate ?? 0;
  const tenureValue = k ? `${fmtNumber(k.avgTenureMonths, { decimals: 1 })} mo` : "-";

  // Segment labels enriched with share for the donut legend / tooltip
  const segmentMix = (data?.bySegment ?? []).map((s) => ({ ...s, label: `${s.segment} · ${fmtPct(s.share, 0)}` }));

  const productCols: Column<CustomersResponse["byProduct"][number]>[] = [
    {
      key: "product",
      header: "Product",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.product}</p>
          <p className="text-[11px] text-slate-400">{r.productId}</p>
        </div>
      ),
      sortValue: (r) => r.product,
    },
    { key: "customers", header: "Customers", align: "right", cell: (r) => fmtNumber(r.customers), sortValue: (r) => r.customers },
    { key: "contribution", header: "Contribution", align: "right", cell: (r) => fmtCurrency(r.contribution, { compact: true }), sortValue: (r) => r.contribution },
  ];

  const marketCols: Column<CustomersResponse["byMarket"][number]>[] = [
    {
      key: "market",
      header: "Market",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.market}</p>
          <p className="text-[11px] text-slate-400">{r.marketId}</p>
        </div>
      ),
      sortValue: (r) => r.market,
    },
    { key: "region", header: "Region", cell: (r) => r.region, sortValue: (r) => r.region },
    { key: "customers", header: "Customers", align: "right", cell: (r) => fmtNumber(r.customers), sortValue: (r) => r.customers },
  ];

  const leadCols: Column<CustomersResponse["leadQuality"][number]>[] = [
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
    { key: "leads", header: "Leads", align: "right", cell: (r) => fmtNumber(r.leads), sortValue: (r) => r.leads },
    { key: "customers", header: "Customers", align: "right", cell: (r) => fmtNumber(r.customers), sortValue: (r) => r.customers },
    {
      key: "rate",
      header: "Conversion Rate",
      align: "right",
      cell: (r) => (
        <span className={cn("font-semibold tabular-nums", overallRate > 0 && r.rate >= overallRate ? "text-emerald-600" : "text-rose-600")}>
          {fmtPct(r.rate)}
        </span>
      ),
      sortValue: (r) => r.rate,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="New Funded Customers" value={fmtNumber(k?.newCustomers)} icon={UserPlus} loading={isLoading} accent="teal" description="in the selected range" />
        <KpiCard label="Lead to Customer Rate" value={fmtPct(k?.leadToCustomerRate)} icon={UserCheck} loading={isLoading} accent="cyan" description="leads that funded an account" />
        <KpiCard label="Avg Tenure" value={tenureValue} icon={Clock} loading={isLoading} accent="violet" description="months since first product" />
        <KpiCard label="Digital Banking Share" value={fmtPct(k?.digitalShare)} icon={Smartphone} loading={isLoading} accent="rose" description="enrolled in digital banking" />
        <KpiCard label="Email Opt-in" value={fmtPct(k?.emailOptInRate)} icon={Mail} loading={isLoading} accent="slate" description="marketing consent on file" />
      </div>

      {/* Monthly trend + segment mix */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="New customers by month" subtitle="Funded accounts opened per month" className="xl:col-span-2" loading={isLoading}>
          {data?.monthly?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="newCustomersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => fmtNumber(v, { decimals: 0 })} {...AXIS} width={44} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v, { decimals: 0 })} labelFormatter={(l) => fmtMonth(String(l))} />} />
                  <Area dataKey="newFundedCustomers" name="New funded customers" stroke={CHART_COLORS[0]} strokeWidth={2.5} fill="url(#newCustomersFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No new customers in range" />
          )}
        </ChartCard>

        <ChartCard title="Segment mix" subtitle="Share of funded customers by segment" loading={isLoading}>
          {segmentMix.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={segmentMix} dataKey="customers" nameKey="label" innerRadius="50%" outerRadius="75%" paddingAngle={2} strokeWidth={2}>
                    {segmentMix.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${fmtNumber(v)} customers`} />} />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={7} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No segment data in range" />
          )}
        </ChartCard>
      </div>

      {/* Acquisition by product / market */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Acquisition by product"
          subtitle="Funded customers and contribution by product"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={productCols}
            rows={data?.byProduct ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "customers", dir: "desc" }}
            rowKey={(r) => r.productId}
            emptyMessage="No product acquisition in range"
          />
        </ChartCard>

        <ChartCard
          title="Acquisition by market"
          subtitle="Funded customers by market and region"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={marketCols}
            rows={data?.byMarket ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "customers", dir: "desc" }}
            rowKey={(r) => r.marketId}
            emptyMessage="No market acquisition in range"
          />
        </ChartCard>
      </div>

      {/* Segment profiles */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Segment profiles</h3>
          <p className="mt-0.5 text-xs text-slate-500">Attitudinal and behavioral segments served by the portfolio</p>
        </div>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-3 h-5 w-40" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.segments?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.segments.map((s) => {
              const segStats = data.bySegment?.find((b) => b.segmentId === s.segmentId);
              return (
                <Card key={s.segmentId} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{s.segment}</p>
                        <Badge variant="outline" className="mt-1 text-[10.5px] text-slate-500">
                          {s.segmentGroup}
                        </Badge>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-semibold tabular-nums text-slate-900">{fmtNumber(s.customers)}</p>
                        <p className="text-[11px] text-slate-400">customers</p>
                      </div>
                    </div>
                    <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-slate-500">{s.description}</p>
                    <p className="mt-1.5 text-[11px] italic text-slate-400">{s.theme}</p>
                    {segStats ? (
                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                        <span className="text-slate-500">{fmtPct(segStats.share)} of funded base</span>
                        <span className="font-medium tabular-nums text-slate-600">{fmtNumber(segStats.customers)} customers</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState message="No segment profiles available" />
        )}
      </div>

      {/* Lead quality */}
      <ChartCard
        title="Lead quality by campaign"
        subtitle="Leads, funded customers and conversion rate against the blended lead-to-customer rate"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={leadCols}
          rows={data?.leadQuality ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "leads", dir: "desc" }}
          rowKey={(r) => r.campaignKey}
          emptyMessage="No lead attribution in range"
        />
      </ChartCard>
    </div>
  );
}
