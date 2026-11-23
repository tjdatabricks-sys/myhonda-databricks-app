"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { EcomResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtMonth } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList,
} from "recharts";
import { ShoppingCart, DollarSign, RotateCcw, TrendingUp, Receipt, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function orderStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("complet")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("transit")) return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (s.includes("refund")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (s.includes("return") || s.includes("pending")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function marginClass(margin: number): string {
  if (margin >= 0.4) return "text-emerald-600";
  if (margin >= 0.25) return "text-amber-600";
  return "text-rose-600";
}

export function EcomTab() {
  const { data, isLoading } = useAnalyticsQuery<EcomResponse>("ecom");
  const k = data?.kpis;

  const statusCols: Column<EcomResponse["statusMix"][number]>[] = [
    {
      key: "status", header: "Status", cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", orderStatusClass(r.status))}>{r.status}</Badge>
      ),
    },
    { key: "orders", header: "Orders", align: "right", cell: (r) => fmtNumber(r.orders), sortValue: (r) => r.orders },
    { key: "amount", header: "Amount", align: "right", cell: (r) => fmtCurrency(r.amount, { compact: true }), sortValue: (r) => r.amount },
    { key: "tax", header: "Tax", align: "right", cell: (r) => fmtCurrency(r.tax, { compact: true }), sortValue: (r) => r.tax },
    { key: "shipping", header: "Shipping", align: "right", cell: (r) => fmtCurrency(r.shipping, { compact: true }), sortValue: (r) => r.shipping },
  ];

  const catalogCols: Column<EcomResponse["catalog"][number]>[] = [
    { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs text-slate-500">{r.sku}</span> },
    {
      key: "name", header: "Product", cell: (r) => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate font-medium text-slate-700">{r.name}</p>
          <p className="text-[11px] text-slate-400">{r.brand}</p>
        </div>
      ), sortValue: (r) => r.name,
    },
    { key: "category", header: "Category", cell: (r) => <span className="text-slate-600">{r.category}</span>, sortValue: (r) => r.category },
    { key: "listPrice", header: "List Price", align: "right", cell: (r) => fmtCurrency(r.listPrice), sortValue: (r) => r.listPrice },
    { key: "unitCost", header: "Unit Cost", align: "right", cell: (r) => fmtCurrency(r.unitCost), sortValue: (r) => r.unitCost },
    {
      key: "margin", header: "Margin", align: "right", cell: (r) => (
        <span className={cn("font-semibold tabular-nums", marginClass(r.margin))}>{fmtPct(r.margin)}</span>
      ), sortValue: (r) => r.margin,
    },
    {
      key: "active", header: "Active", cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", r.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500")}>
          {r.active ? "Active" : "Inactive"}
        </Badge>
      ),
      sortValue: (r) => (r.active ? 1 : 0),
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Orders" value={fmtNumber(k?.orders)} icon={ShoppingCart} loading={isLoading} accent="teal" description="all statuses" />
        <KpiCard label="Net Sales" value={fmtCurrency(k?.netSales, { compact: true })} icon={DollarSign} loading={isLoading} accent="cyan" description="after returns" />
        <KpiCard label="Avg Order Value" value={fmtCurrency(k?.aov)} icon={Receipt} loading={isLoading} accent="amber" description="net basis" />
        <KpiCard label="Return Rate" value={fmtPct(k?.returnRate)} icon={RotateCcw} loading={isLoading} accent="rose" description="returned + refunded" />
        <KpiCard label="Gross Sales" value={fmtCurrency(k?.grossSales, { compact: true })} icon={TrendingUp} loading={isLoading} accent="violet" description="before returns" />
        <KpiCard
          label="Avg Tax &amp; Shipping"
          value={k ? fmtCurrency(k.avgTax + k.avgShipping) : "-"}
          icon={Coins}
          loading={isLoading}
          accent="slate"
          description={`tax ${fmtCurrency(k?.avgTax)} · shipping ${fmtCurrency(k?.avgShipping)} per order`}
        />
      </div>

      {/* Monthly orders + net sales */}
      <ChartCard title="Monthly performance" subtitle="Order volume and net sales by month" loading={isLoading}>
        {data?.monthly?.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} width={56} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v, n) => (n.includes("Net sales") ? fmtCurrency(v, { compact: true }) : fmtNumber(v))}
                      labelFormatter={(l) => fmtMonth(String(l))}
                    />
                  }
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Bar yAxisId="left" dataKey="orders" name="Orders" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line yAxisId="right" dataKey="net" name="Net sales" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No orders in the selected range" />
        )}
      </ChartCard>

      {/* Status mix + category economics */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Order status mix"
          subtitle="Orders, order amount, tax and shipping by fulfillment status"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={statusCols}
            rows={data?.statusMix ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "orders", dir: "desc" }}
            rowKey={(r) => r.status}
            emptyMessage="No orders to break down"
          />
        </ChartCard>

        <ChartCard title="Category economics" subtitle="Average list price by category (bars) with average product margin (labels)" loading={isLoading}>
          {data?.categoryPrices?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categoryPrices} layout="vertical" margin={{ top: 5, right: 56, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmtCurrency(v, { compact: true })} {...AXIS} />
                  <YAxis type="category" dataKey="category" width={88} {...AXIS} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtCurrency(v)} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                  <Bar dataKey="avgPrice" name="Avg list price" fill={CHART_COLORS[0]} radius={[0, 3, 3, 0]} maxBarSize={18}>
                    <LabelList dataKey="avgMargin" position="right" fontSize={10} fill="#475569" formatter={(v) => (typeof v === "number" ? fmtPct(v) : String(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No category data" />
          )}
        </ChartCard>
      </div>

      {/* Product catalog */}
      <ChartCard
        title="Product catalog"
        subtitle="SKU catalog with list price, unit cost, margin and active status"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={catalogCols}
          rows={data?.catalog ?? []}
          loading={isLoading}
          maxHeight="max-h-96"
          dense
          initialSort={{ key: "margin", dir: "desc" }}
          rowKey={(r) => r.sku}
          emptyMessage="No catalog items registered"
        />
      </ChartCard>
    </div>
  );
}
