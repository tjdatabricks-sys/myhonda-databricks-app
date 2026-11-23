"use client";

import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useFilterStore, RANGE_LABELS } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { FiltersResponse } from "@/lib/api-types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarDays, FilterX, SlidersHorizontal } from "lucide-react";
import { FILTER_CAPABILITIES, type FilterKey } from '@/lib/filter-capabilities';

const ANY = "__any__";

export function FilterBar({ report }: { report: string }) {
  const store = useFilterStore();
  const { data: filters } = useQuery<FiltersResponse>({
    queryKey: ["filters"],
    queryFn: () => apiGet<FiltersResponse>("filters"),
    staleTime: 600_000,
  });

  useEffect(() => { if (filters?.dateRange) store.setDataRange(filters.dateRange); }, [filters?.dateRange, store.setDataRange]);

  const selectCls = "h-8 w-full text-xs";
  const capability = FILTER_CAPABILITIES[report];
  const supports = (filter: FilterKey) => capability?.supported.includes(filter) ?? false;
  const activeCount = [store.campaignKey, store.platform, store.marketId, store.productId, store.segmentId].filter(Boolean).length;

  return (
    <div className="border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
        </div>

        <div className="w-[164px]">
          <Select value={store.rangePreset} onValueChange={(v) => store.setRange(v as typeof store.rangePreset)}>
            <SelectTrigger aria-label="Date range" className={selectCls}><CalendarDays className="mr-1 h-3.5 w-3.5 text-slate-400" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[190px]">
          <Select disabled={!supports('campaign')} value={supports('campaign') ? store.campaignKey || ANY : ANY} onValueChange={(v) => store.setCampaign(v === ANY ? "" : v)}>
            <SelectTrigger aria-label="Campaign" title={!supports('campaign') ? 'Campaign is unavailable for this report' : undefined} className={selectCls}><SelectValue placeholder="All campaigns" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ANY} className="text-xs">All campaigns</SelectItem>
              {(filters?.campaigns ?? []).map((c) => (
                <SelectItem key={c.campaignKey} value={c.campaignKey} className="text-xs">
                  {c.campaignTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[140px]">
          <Select disabled={!supports('platform')} value={supports('platform') ? store.platform || ANY : ANY} onValueChange={(v) => store.setPlatform(v === ANY ? "" : v)}>
            <SelectTrigger aria-label="Platform" title={!supports('platform') ? 'Platform is unavailable for this report' : undefined} className={selectCls}><SelectValue placeholder="All platforms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY} className="text-xs">All platforms</SelectItem>
              {(filters?.platforms ?? []).map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[150px]">
          <Select disabled={!supports('market')} value={supports('market') ? store.marketId || ANY : ANY} onValueChange={(v) => store.setMarket(v === ANY ? "" : v)}>
            <SelectTrigger aria-label="Market" title={!supports('market') ? 'Market is unavailable for this report' : undefined} className={selectCls}><SelectValue placeholder="All markets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY} className="text-xs">All markets</SelectItem>
              {(filters?.markets ?? []).map((m) => (
                <SelectItem key={m.marketId} value={m.marketId} className="text-xs">{m.marketDisplayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[150px]">
          <Select disabled={!supports('product')} value={supports('product') ? store.productId || ANY : ANY} onValueChange={(v) => store.setProduct(v === ANY ? "" : v)}>
            <SelectTrigger aria-label="Product" title={!supports('product') ? 'Product is unavailable for this report' : undefined} className={selectCls}><SelectValue placeholder="All products" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY} className="text-xs">All products</SelectItem>
              {(filters?.products ?? []).map((p) => (
                <SelectItem key={p.productId} value={p.productId} className="text-xs">{p.productName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[150px]">
          <Select disabled={!supports('segment')} value={supports('segment') ? store.segmentId || ANY : ANY} onValueChange={(v) => store.setSegment(v === ANY ? "" : v)}>
            <SelectTrigger aria-label="Segment" title={!supports('segment') ? 'Segment is unavailable for this report' : undefined} className={selectCls}><SelectValue placeholder="All segments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY} className="text-xs">All segments</SelectItem>
              {(filters?.segments ?? []).map((s) => (
                <SelectItem key={s.segmentId} value={s.segmentId} className="text-xs">{s.segment}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeCount > 0 ? (
          <button
            onClick={store.clearDimensions}
            className="flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <FilterX className="h-3.5 w-3.5" />
            Clear ({activeCount})
          </button>
        ) : null}

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[10px] font-medium text-teal-700">
            Live warehouse
          </Badge>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] font-medium text-amber-700">
            39 gold tables
          </Badge>
        </div>
      </div>
      {capability ? <p className="mt-2 max-w-5xl text-[11px] leading-relaxed text-slate-500" data-testid="filter-scope">{capability.note} Disabled filters are unavailable for this report; saved selections resume on supported reports.</p> : null}
    </div>
  );
}
