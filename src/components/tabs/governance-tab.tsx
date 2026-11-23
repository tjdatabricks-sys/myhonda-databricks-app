"use client";

import { Fragment, useMemo } from "react";
import { useAnalyticsQuery } from "@/lib/api";
import type { GovernanceResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { fmtCurrency, fmtNumber, fmtPct, fmtDate, safeDiv } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { GitMerge, Link2, CheckCheck, ShieldCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LAYER_STYLES: Record<string, { card: string; badge: string; chip: string }> = {
  bronze: {
    card: "border-slate-200 bg-slate-50",
    badge: "border-slate-200 bg-white text-slate-600",
    chip: "border-slate-200 bg-white text-slate-600",
  },
  silver: {
    card: "border-amber-200 bg-amber-50",
    badge: "border-amber-200 bg-white text-amber-700",
    chip: "border-amber-200 bg-white text-amber-700",
  },
  gold: {
    card: "border-teal-200 bg-teal-50",
    badge: "border-teal-200 bg-white text-teal-700",
    chip: "border-teal-200 bg-white text-teal-700",
  },
};

const KIND_BADGES: Record<string, string> = {
  Dimension: "border-teal-200 bg-teal-50 text-teal-700",
  Fact: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Mart: "border-violet-200 bg-violet-50 text-violet-700",
  Bridge: "border-amber-200 bg-amber-50 text-amber-700",
  Audit: "border-rose-200 bg-rose-50 text-rose-700",
  Reference: "border-slate-200 bg-slate-100 text-slate-600",
};

function layerKey(layer: string): keyof typeof LAYER_STYLES {
  const l = layer.toLowerCase();
  if (l.includes("silver")) return "silver";
  if (l.includes("gold")) return "gold";
  return "bronze";
}

function tokenStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("approv")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("propos")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("reject") || s.includes("unresolved")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function resolutionStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("unresolved")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (s.includes("resolved") || s.includes("approved")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("proposed") || s.includes("pending")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export function GovernanceTab() {
  const { data, isLoading } = useAnalyticsQuery<GovernanceResponse>("governance", { withFilters: false });

  const crosswalk = data?.crosswalk;
  const resolutionRate = crosswalk ? safeDiv(crosswalk.resolved, crosswalk.total) : 0;
  const pendingRows = data?.unresolved?.reduce((sum, u) => sum + u.affectedRows, 0) ?? 0;
  const resolvedRows = data?.resolutionStatus?.filter((r) => r.status.toLowerCase() === "resolved").reduce((sum, r) => sum + r.rows, 0) ?? 0;
  const proposedRows = data?.resolutionStatus?.filter((r) => r.status.toLowerCase() === "proposed").reduce((sum, r) => sum + r.rows, 0) ?? 0;
  const reconciliationRate = safeDiv(resolvedRows, resolvedRows + proposedRows);
  const passedChecks = data?.acceptance?.filter((a) => a.status.toLowerCase() === "pass").length ?? 0;
  const totalChecks = data?.acceptance?.length ?? 0;

  const sourceCols: Column<GovernanceResponse["crosswalk"]["bySource"][number]>[] = [
    { key: "sourceSystem", header: "Source System", cell: (r) => <span className="font-medium text-slate-700">{r.sourceSystem}</span> },
    { key: "rows", header: "Rows", align: "right", cell: (r) => fmtNumber(r.rows, { compact: true }), sortValue: (r) => r.rows },
    { key: "resolved", header: "Resolved Mappings", align: "right", cell: (r) => fmtNumber(r.resolved), sortValue: (r) => r.resolved },
    {
      key: "resolvedPct", header: "Resolved %", align: "right", cell: (r) => {
        const pct = safeDiv(r.resolved, r.rows);
        return (
          <div className="flex items-center justify-end gap-2">
            <Progress value={pct * 100} className="h-1.5 w-14" />
            <span className={cn("font-semibold tabular-nums", pct >= 0.9 ? "text-emerald-600" : pct >= 0.7 ? "text-amber-600" : "text-rose-600")}>
              {fmtPct(pct)}
            </span>
          </div>
        );
      },
      sortValue: (r) => safeDiv(r.resolved, r.rows),
    },
  ];

  const unresolvedCols: Column<GovernanceResponse["unresolved"][number]>[] = [
    { key: "token", header: "Token", cell: (r) => <span className="font-mono text-[11px] text-slate-600">{r.token}</span> },
    { key: "system", header: "System", cell: (r) => <span className="text-slate-600">{r.system}</span> },
    {
      key: "status", header: "Status", cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", tokenStatusClass(r.status))}>{r.status}</Badge>
      ),
    },
    { key: "affectedRows", header: "Affected Rows", align: "right", cell: (r) => fmtNumber(r.affectedRows, { compact: true }), sortValue: (r) => r.affectedRows },
    { key: "modelTable", header: "Model Table", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.modelTable}</span> },
  ];

  const acceptanceCols: Column<GovernanceResponse["acceptance"][number]>[] = [
    { key: "checkId", header: "Check ID", cell: (r) => <span className="font-mono text-[11px] text-slate-600">{r.checkId}</span> },
    { key: "criterion", header: "Criterion", cell: (r) => <span className="block max-w-[260px] leading-snug whitespace-normal text-slate-600">{r.criterion}</span> },
    { key: "observed", header: "Observed", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.observed}</span> },
    { key: "expected", header: "Expected", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.expected}</span> },
    {
      key: "status", header: "Status", cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", r.status.toLowerCase() === "pass" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>
          {r.status}
        </Badge>
      ),
    },
  ];

  const resolutionCols: Column<GovernanceResponse["resolutionStatus"][number]>[] = [
    {
      key: "status", header: "Status", cell: (r) => (
        <Badge variant="outline" className={cn("text-[10px]", resolutionStatusClass(r.status))}>{r.status}</Badge>
      ),
    },
    { key: "rows", header: "Source Rows", align: "right", cell: (r) => fmtNumber(r.rows, { compact: true }), sortValue: (r) => r.rows },
    { key: "spend", header: "Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
  ];

  const coverageCols: Column<GovernanceResponse["coverage"][number]>[] = [
    { key: "platform", header: "Platform", cell: (r) => <span className="font-medium text-slate-700">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "months", header: "Months Covered", align: "right", cell: (r) => fmtNumber(r.months), sortValue: (r) => r.months },
    { key: "sourceRows", header: "Source Rows", align: "right", cell: (r) => fmtNumber(r.sourceRows, { compact: true }), sortValue: (r) => r.sourceRows },
    { key: "distinctCampaigns", header: "Distinct Campaigns", align: "right", cell: (r) => fmtNumber(r.distinctCampaigns), sortValue: (r) => r.distinctCampaigns },
    { key: "spend", header: "Attributed Spend", align: "right", cell: (r) => fmtCurrency(r.spend, { compact: true }), sortValue: (r) => r.spend },
  ];

  const kpiDictCols: Column<GovernanceResponse["kpiDictionary"][number]>[] = [
    { key: "kpi", header: "KPI", sortable: false, width: "22%", cell: (r) => <span className="font-medium text-slate-700">{r.kpi}</span> },
    { key: "definition", header: "Definition", sortable: false, cell: (r) => <span className="block max-w-[560px] leading-snug whitespace-normal text-slate-600">{r.definition}</span> },
    { key: "useCases", header: "Use Cases", sortable: false, cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.useCases}</span> },
  ];

  const fxLatest = useMemo(() => {
    const latest = new Map<string, GovernanceResponse["fxRates"][number]>();
    for (const rate of data?.fxRates ?? []) {
      const cur = latest.get(rate.pair);
      if (!cur || rate.date > cur.date) latest.set(rate.pair, rate);
    }
    return [...latest.values()].sort((a, b) => a.pair.localeCompare(b.pair));
  }, [data?.fxRates]);

  const useCaseDefault = data?.useCaseMap?.[0]?.useCase;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Resolution Rate" value={fmtPct(resolutionRate)} icon={GitMerge} loading={isLoading} accent="teal" description="crosswalk mappings resolved" />
        <KpiCard label="Pending Source Links" value={fmtNumber(pendingRows, { compact: true })} icon={Link2} loading={isLoading} accent="amber" description={`${fmtNumber(data?.unresolved?.length ?? 0)} unresolved tokens`} />
        <KpiCard label="Reconciliation Rate" value={fmtPct(reconciliationRate)} icon={CheckCheck} loading={isLoading} accent="violet" description="source rows resolved vs proposed" />
        <KpiCard label="Acceptance Checks Passed" value={`${fmtNumber(passedChecks)} / ${fmtNumber(totalChecks)}`} icon={ShieldCheck} loading={isLoading} accent="cyan" description="contract checks green" />
      </div>

      {/* Medallion lineage */}
      <ChartCard
        title="Medallion lineage"
        subtitle="Bronze source extracts through DQX-validated silver into the governed gold layer"
        loading={isLoading}
      >
        {data?.lineage?.length ? (
          <div className="flex flex-col items-stretch gap-2 py-1 lg:flex-row lg:items-start">
            {data.lineage.map((layer, i) => {
              const style = LAYER_STYLES[layerKey(layer.layer)];
              return (
                <Fragment key={layer.layer}>
                  {i > 0 ? (
                    <ChevronRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-slate-300 lg:mx-1 lg:rotate-0" aria-hidden="true" />
                  ) : null}
                  <div className={cn("flex-1 rounded-lg border p-3", style.card)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">{layer.layer}</p>
                      <Badge variant="outline" className={cn("shrink-0 text-[10px] tabular-nums", style.badge)}>
                        {layer.items.length} items
                      </Badge>
                    </div>
                    <div className="mt-2 flex max-h-44 flex-wrap gap-1 overflow-y-auto scrollbar-thin pr-1">
                      {layer.items.map((item) => (
                        <span key={item} className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", style.chip)}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        ) : (
          <EmptyState message="No lineage registered" />
        )}
      </ChartCard>

      {/* Resolution by source + unresolved tokens */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Campaign resolution by source system"
          subtitle="Crosswalk coverage of source rows into governed campaign keys"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={sourceCols}
            rows={data?.crosswalk?.bySource ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "rows", dir: "desc" }}
            rowKey={(r) => r.sourceSystem}
            emptyMessage="No source systems registered"
          />
        </ChartCard>

        <ChartCard
          title="Unresolved campaign tokens"
          subtitle="Source campaign tokens still awaiting crosswalk resolution"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={unresolvedCols}
            rows={data?.unresolved ?? []}
            loading={isLoading}
            maxHeight="max-h-80"
            dense
            initialSort={{ key: "affectedRows", dir: "desc" }}
            rowKey={(r, i) => `${r.token}-${r.system}-${i}`}
            emptyMessage="No unresolved tokens"
          />
        </ChartCard>
      </div>

      {/* Attribution coverage by platform + FX rates */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Attribution coverage by platform"
          subtitle="Months covered, source rows, distinct campaigns and attributed spend per platform"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={coverageCols}
            rows={data?.coverage ?? []}
            loading={isLoading}
            maxHeight="max-h-96"
            dense
            rowKey={(r) => r.platform}
            emptyMessage="No coverage data registered"
          />
        </ChartCard>

        <ChartCard title="FX rates" subtitle="Latest reference rate per currency pair" loading={isLoading}>
          {fxLatest.length ? (
            <div className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3 xl:grid-cols-2">
              {fxLatest.map((fx) => (
                <div key={fx.pair} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                  <p className="font-mono text-[11px] font-semibold text-teal-700">{fx.pair}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 tabular-nums">{fx.rate.toFixed(4)}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">as of {fmtDate(fx.date)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No FX rates registered" />
          )}
        </ChartCard>
      </div>

      {/* Acceptance checks + attribution coverage */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Acceptance checks"
          subtitle="Contract acceptance tests observed vs expected in the gold layer"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={acceptanceCols}
            rows={data?.acceptance ?? []}
            loading={isLoading}
            maxHeight="max-h-96"
            dense
            rowKey={(r) => r.checkId}
            emptyMessage="No acceptance checks registered"
          />
        </ChartCard>

        <ChartCard
          title="Attribution coverage"
          subtitle="Source rows and spend by campaign resolution status"
          loading={isLoading}
          noPadding
          contentClassName="px-4 pb-4 pt-1"
        >
          <DataTable
            columns={resolutionCols}
            rows={data?.resolutionStatus ?? []}
            loading={isLoading}
            maxHeight="max-h-96"
            dense
            initialSort={{ key: "rows", dir: "desc" }}
            rowKey={(r) => r.status}
            emptyMessage="No resolution status data"
          />
        </ChartCard>
      </div>

      {/* Use case to gold table map */}
      <ChartCard
        title="Use case to gold table map"
        subtitle="Which governed gold tables power each analytics use case"
        loading={isLoading}
        noPadding
        contentClassName="px-2 pb-2 pt-1"
      >
        {data?.useCaseMap?.length ? (
          <Accordion type="multiple" defaultValue={useCaseDefault ? [useCaseDefault] : []} className="px-2">
            {data.useCaseMap.map((uc) => (
              <AccordionItem key={uc.useCase} value={uc.useCase}>
                <AccordionTrigger className="px-3 hover:no-underline">
                  <span className="truncate text-left text-sm font-medium text-slate-700">{uc.useCase}</span>
                  <Badge variant="outline" className="mr-2 shrink-0 border-teal-200 bg-teal-50 text-[10px] text-teal-700 tabular-nums">
                    {uc.tables.length} tables
                  </Badge>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-4">
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {uc.tables.map((t) => (
                      <div key={t.table} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                        <span className="truncate font-mono text-[11px] text-slate-600">{t.table}</span>
                        <Badge variant="outline" className={cn("shrink-0 px-1 text-[9.5px]", KIND_BADGES[t.kind] ?? KIND_BADGES.Reference)}>
                          {t.kind}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <EmptyState message="No use case map registered" />
        )}
      </ChartCard>

      {/* Governed KPI dictionary */}
      <ChartCard
        title="Governed KPI dictionary"
        subtitle="Canonical metric definitions with the use cases they serve"
        loading={isLoading}
        noPadding
        contentClassName="px-4 pb-4 pt-1"
      >
        <DataTable
          columns={kpiDictCols}
          rows={data?.kpiDictionary ?? []}
          loading={isLoading}
          maxHeight="max-h-96"
          dense
          rowKey={(r) => r.kpi}
          emptyMessage="No KPI definitions registered"
        />
      </ChartCard>
    </div>
  );
}
