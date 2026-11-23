"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { FunnelResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE } from "@/lib/chart-theme";
import { fmtCurrency, fmtNumber, fmtPct, fmtMonth, safeDiv } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ListFilter, Users, FileCheck2, Landmark, Link2, Copy, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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

function DqStat({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-700">{value}</span>
      </div>
      <Progress value={Math.min(100, Math.max(0, pct))} className="h-1.5" />
    </div>
  );
}

export function FunnelTab() {
  const { data, isLoading } = useAnalyticsQuery<FunnelResponse>("funnel");
  const stages = data?.stages ?? [];

  const stageVal = (needle: string): number | undefined =>
    stages.find((s) => s.stage.toLowerCase().includes(needle))?.value;
  const submissions = stageVal("submission");
  const leads = stageVal("lead");
  const applications = stageVal("applic");
  const fundedAccounts = stageVal("funded");
  const d = data?.duplicates;

  const byCampaignCols: Column<FunnelResponse["byCampaign"][number]>[] = [
    {
      key: "campaignTitle", header: "Campaign",
      cell: (r) => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <p className="text-[11px] text-slate-400">{r.campaignKey}</p>
        </div>
      ),
      sortValue: (r) => r.campaignTitle,
    },
    { key: "platform", header: "Platform", cell: (r) => <span className="text-slate-600">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "submissions", header: "Submissions", align: "right", cell: (r) => fmtNumber(r.submissions), sortValue: (r) => r.submissions },
    { key: "leads", header: "Leads", align: "right", cell: (r) => fmtNumber(r.leads), sortValue: (r) => r.leads },
    { key: "leadRate", header: "Lead %", align: "right", cell: (r) => fmtPct(r.leadRate), sortValue: (r) => r.leadRate },
    { key: "applications", header: "Apps", align: "right", cell: (r) => fmtNumber(r.applications), sortValue: (r) => r.applications },
    { key: "appRate", header: "App %", align: "right", cell: (r) => fmtPct(r.appRate), sortValue: (r) => r.appRate },
    { key: "funded", header: "Funded", align: "right", cell: (r) => <span className="font-semibold text-slate-700">{fmtNumber(r.funded)}</span>, sortValue: (r) => r.funded },
    { key: "fundedRate", header: "Funded %", align: "right", cell: (r) => fmtPct(r.fundedRate), sortValue: (r) => r.fundedRate },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
    { key: "cac", header: "CAC", align: "right", cell: (r) => cacCell(r.funded, r.cac), sortValue: (r) => r.cac },
  ];

  const maxStageValue = stages[0]?.value ?? 1;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Submissions" value={fmtNumber(submissions)} icon={ListFilter} loading={isLoading} accent="teal" description="paid media submissions" />
        <KpiCard label="Leads" value={fmtNumber(leads)} icon={Users} loading={isLoading} accent="amber" description="identified from submissions" />
        <KpiCard label="Applications" value={fmtNumber(applications)} icon={FileCheck2} loading={isLoading} accent="violet" description="submitted applications" />
        <KpiCard label="Funded Accounts" value={fmtNumber(fundedAccounts)} icon={Landmark} loading={isLoading} accent="cyan" description="funded in range" />
        <KpiCard label="Match Rate" value={fmtPct(d?.matchRate)} icon={Link2} loading={isLoading} accent="slate" description="submissions matched to CRM" />
        <KpiCard label="Duplicate Submissions" value={fmtNumber(d?.duplicates)} icon={Copy} loading={isLoading} accent="rose" description="removed in dedupe" />
      </div>

      {/* Funnel + data quality */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Acquisition funnel"
          subtitle="Stage-by-stage conversion from submissions to funded accounts"
          className="xl:col-span-2"
          loading={isLoading}
        >
          {stages.length ? (
            <div className="py-1">
              {stages.map((stage, i) => {
                const width = Math.max(1.5, safeDiv(stage.value, maxStageValue) * 100);
                return (
                  <div key={stage.stage}>
                    {i > 0 ? (
                      <div className="flex items-center gap-1 py-0.5 pl-0.5 text-[10px] text-slate-400">
                        <ChevronDown className="h-3 w-3 text-slate-300" />
                        <span>{fmtPct(stage.rate)} of previous stage</span>
                      </div>
                    ) : null}
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">{stage.stage}</span>
                      <span className="flex items-center gap-1.5 text-xs tabular-nums text-slate-500">
                        {fmtNumber(stage.value)}
                        {i > 0 && stage.rate > 0 ? (
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">{fmtPct(stage.rate)}</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                      <div
                        role="img"
                        aria-label={`${stage.stage}: ${fmtNumber(stage.value)}${i > 0 ? `, ${fmtPct(stage.rate)} of previous stage` : ""}`}
                        className="h-full rounded-md bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No funnel data for the selected filters" />
          )}
        </ChartCard>

        <ChartCard title="Data quality" subtitle="Dedupe and CRM match integrity of the funnel" loading={isLoading}>
          {d ? (
            <div className="space-y-3.5 py-1">
              <DqStat label="Submissions" value={fmtNumber(d.submissions)} pct={100} />
              <DqStat label="Duplicates removed" value={fmtNumber(d.duplicates)} pct={safeDiv(d.duplicates, d.submissions) * 100} />
              <DqStat label="Eligible after dedupe" value={fmtNumber(d.eligible)} pct={safeDiv(d.eligible, d.submissions) * 100} />
              <DqStat label="Without CRM match" value={fmtNumber(d.withoutCrm)} pct={safeDiv(d.withoutCrm, d.eligible) * 100} />
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-600">CRM match rate</span>
                  <span className={cn("text-xs font-semibold tabular-nums", d.matchRate >= 0.9 ? "text-emerald-600" : "text-amber-600")}>
                    {fmtPct(d.matchRate)}
                  </span>
                </div>
                <Progress value={Math.min(100, Math.max(0, d.matchRate * 100))} className="h-1.5" />
              </div>
            </div>
          ) : (
            <EmptyState message="No data quality signals" />
          )}
        </ChartCard>
      </div>

      {/* Funnel by month */}
      <ChartCard title="Funnel by month" subtitle="Stage volumes by month across the acquisition journey" loading={isLoading}>
        {data?.monthly?.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} {...AXIS} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v)} labelFormatter={(m) => fmtMonth(String(m))} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Line dataKey="submissions" name="Submissions" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={false} />
                <Line dataKey="leads" name="Leads" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                <Line dataKey="applications" name="Applications" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
                <Line dataKey="funded" name="Funded" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No monthly funnel data" />
        )}
      </ChartCard>

      {/* Campaign funnel detail */}
      <ChartCard
        title="Campaign funnel detail"
        subtitle="Stage volumes, conversion rates and acquisition economics by campaign"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={byCampaignCols}
          rows={data?.byCampaign ?? []}
          loading={isLoading}
          maxHeight="max-h-96"
          dense
          initialSort={{ key: "submissions", dir: "desc" }}
          rowKey={(r) => r.campaignKey}
          emptyMessage="No campaign funnel data for the selected filters"
        />
      </ChartCard>
    </div>
  );
}
