"use client";

import { useMemo, useState } from "react";
import { useAnalyticsQuery } from "@/lib/api";
import type { SchemaResponse, SchemaTableDto } from "@/lib/api-types";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtNumber } from "@/lib/format";
import { Database, Braces, PackageCheck, Hash, Search, Download, FolderDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportListResponse {
  tables: { table: string; columns: number; rows: number }[];
  count: number;
  totalRows: number;
}

const KIND_ORDER = ["Dimension", "Fact", "Mart", "Bridge", "Reference", "Audit", "Metadata"];

const KIND_BADGES: Record<string, string> = {
  Dimension: "border-teal-200 bg-teal-50 text-teal-700",
  Fact: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Mart: "border-violet-200 bg-violet-50 text-violet-700",
  Bridge: "border-amber-200 bg-amber-50 text-amber-700",
  Audit: "border-rose-200 bg-rose-50 text-rose-700",
  Reference: "border-slate-200 bg-slate-100 text-slate-600",
  Metadata: "border-slate-200 bg-slate-100 text-slate-600",
};

const TYPE_BADGES: Record<string, string> = {
  STRING: "border-slate-200 bg-slate-100 text-slate-600",
  INT: "border-cyan-200 bg-cyan-50 text-cyan-700",
  LONG: "border-cyan-200 bg-cyan-50 text-cyan-700",
  DOUBLE: "border-amber-200 bg-amber-50 text-amber-700",
  DECIMAL: "border-amber-200 bg-amber-50 text-amber-700",
  DATE: "border-violet-200 bg-violet-50 text-violet-700",
  BOOLEAN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARRAY: "border-rose-200 bg-rose-50 text-rose-700",
};

export function SchemaTab() {
  const { data, isLoading } = useAnalyticsQuery<SchemaResponse>("schema", { withFilters: false });
  const { data: exportList } = useAnalyticsQuery<ExportListResponse>("export", { withFilters: false });

  const exportableTables = useMemo(
    () => new Set((exportList?.tables ?? []).map((t) => t.table)),
    [exportList]
  );

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("All");
  const [domain, setDomain] = useState("all");
  const [selected, setSelected] = useState("dim_campaign");

  const tables = data?.tables ?? [];
  const stats = data?.stats;

  const domains = useMemo(() => [...new Set(tables.map((t) => t.domain))].sort(), [tables]);

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tables) counts.set(t.tableKind, (counts.get(t.tableKind) ?? 0) + 1);
    return counts;
  }, [tables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (kind !== "All" && t.tableKind !== kind) return false;
      if (domain !== "all" && t.domain !== domain) return false;
      if (!q) return true;
      return (
        t.tableName.toLowerCase().includes(q) ||
        t.note.toLowerCase().includes(q) ||
        t.domain.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
      );
    });
  }, [tables, search, kind, domain]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SchemaTableDto[]>();
    for (const t of filtered) {
      const list = groups.get(t.tableKind) ?? [];
      list.push(t);
      groups.set(t.tableKind, list);
    }
    return [...groups.entries()].sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a[0]);
      const bi = KIND_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.tableName === selected) ?? tables[0] ?? null,
    [tables, selected]
  );

  const martCols: Column<SchemaResponse["marts"][number]>[] = [
    { key: "martTable", header: "Mart table", cell: (r) => <span className="font-mono text-xs font-medium text-teal-700">{r.martTable}</span> },
    { key: "grainColumns", header: "Grain", cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.grainColumns}</span> },
    {
      key: "modelSources", header: "Model sources", cell: (r) => (
        <div className="flex max-w-[320px] flex-wrap gap-1">
          {r.modelSources.split(",").map((s) => (
            <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{s.trim()}</span>
          ))}
        </div>
      ),
    },
    { key: "rowCount", header: "Rows", align: "right", cell: (r) => fmtNumber(r.rowCount), sortValue: (r) => r.rowCount },
    {
      key: "metricNotes", header: "Metric notes", cell: (r) => (
        <span className="block max-w-[340px] whitespace-normal text-slate-600">{r.metricNotes}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats band */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={Database} label="Tables" value={stats ? fmtNumber(stats.tables) : "-"} accent="teal" loading={isLoading} />
        <MiniStat icon={Braces} label="Columns" value={stats ? fmtNumber(stats.columns) : "-"} accent="cyan" loading={isLoading} />
        <MiniStat icon={PackageCheck} label="Tables with rows" value={stats ? fmtNumber(stats.materialized) : "-"} accent="amber" loading={isLoading} />
        <MiniStat icon={Hash} label="Total Rows" value={stats ? fmtNumber(stats.totalRows, { compact: true }) : "-"} accent="violet" loading={isLoading} />
      </div>

      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-slate-900">Warehouse table exports</p>
          <p className="mt-1 text-xs text-slate-600">Download a table as CSV using its download button below. Exports contain the connected warehouse data and use the app's data permissions.</p>
        </CardContent>
      </Card>

      {/* Search + filters */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tables, columns or notes..."
                className="pl-8 text-sm"
                aria-label="Search schema tables"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger className="w-full min-w-[190px] text-sm xl:w-[230px]" aria-label="Filter by domain">
                  <SelectValue placeholder="All domains" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All domains</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="ml-auto shrink-0 text-[11px] text-slate-400 tabular-nums">
              {filtered.length} of {tables.length} tables
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {["All", ...KIND_ORDER.filter((k) => kindCounts.has(k)), ...[...kindCounts.keys()].filter((k) => !KIND_ORDER.includes(k))].map(
              (k, i) => (
                <button
                  key={`${k}-${i}`}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    kind === k
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {k}
                  <span className={cn("rounded-full px-1 text-[10px] tabular-nums", kind === k ? "bg-white/20" : "bg-slate-100 text-slate-500")}>
                    {k === "All" ? tables.length : kindCounts.get(k) ?? 0}
                  </span>
                </button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Browser: list + detail */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,340px)_1fr]">
        {/* Table list */}
        <Card>
          <CardContent className="p-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : grouped.length ? (
              <div className="max-h-[560px] space-y-3 overflow-y-auto scrollbar-thin pr-1" role="listbox" aria-label="Schema tables">
                {grouped.map(([groupKind, groupTables]) => (
                  <div key={groupKind}>
                    <p className="sticky top-0 z-10 bg-white/95 py-1 text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase backdrop-blur-sm">
                      {groupKind}
                      <span className="ml-1.5 rounded bg-slate-100 px-1 py-px text-[9.5px] text-slate-400 tabular-nums">{groupTables.length}</span>
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {groupTables.map((t) => (
                        <button
                          key={t.tableName}
                          type="button"
                          role="option"
                          aria-selected={selectedTable?.tableName === t.tableName}
                          onClick={() => setSelected(t.tableName)}
                          className={cn(
                            "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                            selectedTable?.tableName === t.tableName
                              ? "border-teal-300 bg-teal-50"
                              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate font-mono text-xs",
                                selectedTable?.tableName === t.tableName ? "font-semibold text-teal-800" : "text-slate-700"
                              )}
                            >
                              {t.tableName}
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              {exportableTables.has(t.tableName) ? (
                                <a
                                  href={`/api/export?table=${t.tableName}`}
                                  download
                                  aria-label={`Download ${t.tableName} CSV`}
                                  title="Download CSV"
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded p-0.5 text-slate-300 transition-colors hover:bg-teal-50 hover:text-teal-600"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              ) : null}
                              <Badge variant="outline" className="px-1 text-[9.5px] text-slate-500 tabular-nums">
                                {fmtNumber(t.rowCount, { compact: true })}
                              </Badge>
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">{t.domain}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No tables match your search" />
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card className="min-h-[560px]">
          <CardContent className="p-5">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : selectedTable ? (
              <TableDetail table={selectedTable} exportable={exportableTables.has(selectedTable.tableName)} />
            ) : (
              <EmptyState message="Select a table to inspect it" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mart catalog */}
      <Card>
        <Accordion type="single" collapsible>
          <AccordionItem value="mart-catalog" className="border-b-0">
            <AccordionTrigger className="px-5 pb-0 hover:no-underline">
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">Gold mart catalog</p>
                <p className="mt-0.5 text-xs font-normal text-slate-500">
                  Consumption marts with grain, model sources and metric notes
                </p>
              </div>
              <Badge variant="outline" className="mr-2 shrink-0 border-violet-200 bg-violet-50 text-violet-700">
                {data?.marts?.length ?? 0} marts
              </Badge>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <DataTable
                columns={martCols}
                rows={data?.marts ?? []}
                loading={isLoading}
                maxHeight="max-h-96"
                dense
                initialSort={{ key: "rowCount", dir: "desc" }}
                rowKey={(r) => r.martTable}
                emptyMessage="No marts registered"
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, accent, loading,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  accent: "teal" | "cyan" | "amber" | "violet";
  loading?: boolean;
}) {
  const accents: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600",
    cyan: "bg-cyan-50 text-cyan-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", accents[accent])}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
          <p className="truncate text-[11px] text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TableDetail({ table, exportable }: { table: SchemaTableDto; exportable: boolean }) {
  const materialized = !table.note.toLowerCase().includes("not materialized");
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-mono text-lg font-semibold break-words text-slate-900">{table.tableName}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[11px]", KIND_BADGES[table.tableKind] ?? KIND_BADGES.Metadata)}>
              {table.tableKind}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-[11px] text-slate-600">
              {table.domain}
            </Badge>
            {materialized ? (
              <Badge className="border-transparent bg-emerald-600 text-[11px] text-white">Materialized</Badge>
            ) : (
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] text-slate-500">Registered only</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 tabular-nums">
            {fmtNumber(table.rowCount)} rows
          </Badge>
          {exportable ? (
            <a
              href={`/api/export?table=${table.tableName}`}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
          ) : null}
        </div>
      </div>

      {/* Grain + note */}
      <div className="grid gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-[auto_1fr] sm:gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-400 uppercase">Grain</p>
          <p className="mt-0.5 font-mono text-xs text-slate-700">{table.grain && table.grain !== "-" ? table.grain : "n/a (not materialized)"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-400 uppercase">Note</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{table.note}</p>
        </div>
      </div>

      {/* Columns */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
          Columns <span className="ml-1 rounded bg-slate-100 px-1 py-px text-[9.5px] text-slate-500 tabular-nums">{table.columns.length}</span>
        </p>
        <div className="mt-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
          <div className="grid gap-1 sm:grid-cols-2">
            {table.columns.map((col) => (
              <div key={col.name} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-2 py-1">
                <span className="truncate font-mono text-[11px] text-slate-600">{col.name}</span>
                <Badge variant="outline" className={cn("shrink-0 px-1 text-[9.5px]", TYPE_BADGES[col.type] ?? TYPE_BADGES.STRING)}>
                  {col.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
