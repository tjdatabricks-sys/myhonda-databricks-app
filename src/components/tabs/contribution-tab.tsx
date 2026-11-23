"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { ContributionResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE, GOOD, BAD, NEUTRAL } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtX, fmtMonth } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis, LabelList, ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, User, Percent, Receipt, TrendingUp, CalendarClock, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContributionTab() {
  const { data, isLoading } = useAnalyticsQuery<ContributionResponse>("contribution");
  const k = data?.kpis;
  const roi = k?.roi ?? 0;

  // Break-even diagonal end point for the spend vs contribution scatter
  const scatter = data?.scatter ?? [];
  const breakEvenMax =
    Math.max(0, ...scatter.flatMap((p) => [p.spend, p.contribution])) * 1.05 || 1;

  const campaignCols: Column<ContributionResponse["byCampaign"][number]>[] = [
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
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
    { key: "contribution", header: "Contribution", align: "right", cell: (r) => fmtCurrency(r.contribution, { compact: true }), sortValue: (r) => r.contribution },
    {
      key: "roi",
      header: "ROI",
      align: "right",
      cell: (r) => (
        <span className={cn("font-semibold tabular-nums", r.roi >= 1 ? "text-emerald-600" : r.roi >= 0 ? "text-amber-600" : "text-rose-600")}>
          {fmtX(r.roi)}
        </span>
      ),
      sortValue: (r) => r.roi,
    },
    { key: "estimated36m", header: "Est. 36-Mo", align: "right", cell: (r) => fmtCurrency(r.estimated36m, { compact: true }), sortValue: (r) => r.estimated36m },
  ];

  const productCols: Column<ContributionResponse["byProduct"][number]>[] = [
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
    { key: "monthlyPerCustomer", header: "Monthly / Customer", align: "right", cell: (r) => fmtCurrency(r.monthlyPerCustomer, { decimals: 2 }), sortValue: (r) => r.monthlyPerCustomer },
    { key: "contribution", header: "Contribution", align: "right", cell: (r) => fmtCurrency(r.contribution, { compact: true }), sortValue: (r) => r.contribution },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Net Contribution" value={fmtCurrency(k?.netContribution, { compact: true })} icon={DollarSign} loading={isLoading} accent="teal" description="interest + non-interest, net" />
        <KpiCard label="Per Customer" value={fmtCurrency(k?.perCustomer)} icon={User} loading={isLoading} accent="cyan" description="contribution / funded account" />
        <KpiCard label="Interest Income" value={fmtCurrency(k?.interestIncome, { compact: true })} icon={Percent} loading={isLoading} accent="amber" description="accrued in range" />
        <KpiCard label="Non-Interest Income" value={fmtCurrency(k?.otherIncome, { compact: true })} icon={Receipt} loading={isLoading} accent="violet" description="fees and other income, accrued" />
        {isLoading ? (
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
            </CardContent>
          </Card>
        ) : (
          <Card className="group transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium tracking-wide text-slate-500 uppercase">Blended ROI</p>
                  <p className={cn("mt-1.5 truncate text-2xl font-semibold tracking-tight", roi >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {fmtX(k?.roi)}
                  </p>
                </div>
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", roi >= 0 ? "bg-teal-50 text-teal-600" : "bg-rose-50 text-rose-600")}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="truncate text-[11px] text-slate-400">{roi >= 0 ? "above break-even" : "below break-even"}</span>
              </div>
            </CardContent>
          </Card>
        )}
        <KpiCard label="Est. 36-Mo Value" value={fmtCurrency(k?.estimated36m, { compact: true })} icon={CalendarClock} loading={isLoading} accent="slate" description="projected contribution" />
      </div>

      {/* Monthly contribution + payback */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Monthly contribution" subtitle="Interest and non-interest income with net contribution trend" className="xl:col-span-2" loading={isLoading}>
          {data?.monthly?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={56} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} labelFormatter={(l) => fmtMonth(String(l))} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Bar dataKey="interest" name="Interest income" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="other" name="Non-interest income" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Line dataKey="net" name="Net contribution" stroke={CHART_COLORS[3]} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No contribution accrued in range" />
          )}
        </ChartCard>

        {isLoading ? (
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-10 w-24" />
              <Skeleton className="mt-2 h-3 w-40" />
              <Skeleton className="mt-6 h-3 w-full" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-3 h-3 w-full" />
            </CardContent>
          </Card>
        ) : (
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Payback period</p>
                  <p className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900">
                    {k ? k.paybackMonths.toFixed(1) : "-"}
                    <span className="ml-1 text-base font-medium text-slate-400">mo</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">months to recover spend</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Hourglass size={18} />
                </div>
              </div>
              <Separator className="my-3" />
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Est. 36-mo value</span>
                  <span className="font-semibold tabular-nums text-slate-800">{fmtCurrency(k?.estimated36m, { compact: true })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Net contribution</span>
                  <span className="font-medium tabular-nums text-slate-700">{fmtCurrency(k?.netContribution, { compact: true })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Per customer</span>
                  <span className="font-medium tabular-nums text-slate-700">{fmtCurrency(k?.perCustomer)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scatter + cohort */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Contribution vs spend by campaign" subtitle="Each point is a campaign; points above the dashed line are past break-even" loading={isLoading}>
          {scatter.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="spend" name="Spend" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} />
                  <YAxis type="number" dataKey="contribution" name="Contribution" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={56} />
                  <ZAxis type="number" range={[56, 56]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={
                      <ChartTooltip
                        valueFormatter={(v) => fmtCurrency(v, { compact: true })}
                        labelFormatter={(l) => `Spend ${fmtCurrency(Number(l), { compact: true })}`}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={7} />
                  <ReferenceLine
                    segment={[{ x: 0, y: 0 }, { x: breakEvenMax, y: breakEvenMax }]}
                    stroke={NEUTRAL}
                    strokeDasharray="4 4"
                    label={{ value: "break-even", position: "end", fontSize: 10, fill: NEUTRAL }}
                  />
                  <Scatter name="At or above break-even" data={scatter.filter((p) => p.roi >= 0)} fill={GOOD} />
                  <Scatter name="Below break-even" data={scatter.filter((p) => p.roi < 0)} fill={BAD} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No campaign contribution data in range" />
          )}
        </ChartCard>

        <ChartCard title="Cohort payback" subtitle="Cumulative spend vs contribution with 36-month projected value" loading={isLoading}>
          {data?.cohort?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.cohort} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="cohortMonth" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={56} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} labelFormatter={(l) => fmtMonth(String(l))} />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                  <Line dataKey="cumulativeSpend" name="Cumulative spend" stroke="#94a3b8" strokeWidth={2} dot={false} />
                  <Line dataKey="cumulativeContribution" name="Cumulative contribution" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={false} />
                  <Line dataKey="estimated36m" name="Est. 36-mo value" stroke={CHART_COLORS[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No cohort data in range" />
          )}
        </ChartCard>
      </div>

      {/* Campaign detail */}
      <ChartCard
        title="Campaign contribution detail"
        subtitle="Spend, realized contribution, ROI and projected 36-month value by campaign"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={campaignCols}
          rows={data?.byCampaign ?? []}
          loading={isLoading}
          maxHeight="max-h-80"
          dense
          initialSort={{ key: "contribution", dir: "desc" }}
          rowKey={(r) => r.campaignKey}
          emptyMessage="No campaign contribution in range"
        />
      </ChartCard>

      {/* By product + by market */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Contribution by product"
          subtitle="Customers, monthly yield per customer and total contribution"
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
            initialSort={{ key: "contribution", dir: "desc" }}
            rowKey={(r) => r.productId}
            emptyMessage="No product contribution in range"
          />
        </ChartCard>

        <ChartCard title="Contribution by market" subtitle="Total contribution by market with customer counts" loading={isLoading}>
          {data?.byMarket?.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byMarket} layout="vertical" margin={{ top: 5, right: 56, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} />
                  <YAxis type="category" dataKey="market" width={96} {...AXIS} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v, { compact: true })} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Bar dataKey="contribution" name="Contribution" fill={CHART_COLORS[0]} radius={[0, 3, 3, 0]} maxBarSize={18}>
                    <LabelList dataKey="contribution" position="right" fontSize={10} fill="#475569" formatter={(v) => (typeof v === "number" ? fmtCurrency(v, { compact: true }) : String(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No market contribution in range" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
