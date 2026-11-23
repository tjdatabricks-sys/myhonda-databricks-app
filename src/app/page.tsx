"use client";

import { useState, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus } from "@/components/analytics/connection-status";
import { QueryErrors } from "@/components/analytics/query-errors";
import { FilterBar } from "@/components/analytics/filter-bar";
import {
  LayoutDashboard, Megaphone, MousePointerClick, ListFilter, MonitorSmartphone, RadioTower, Users,
  TrendingUp, Receipt, Flag, FlaskConical, Award, ShoppingCart, Database, ShieldCheck, Menu, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

import { OverviewTab } from "@/components/tabs/overview-tab";
import { CampaignsTab } from "@/components/tabs/campaigns-tab";
import { PaidMediaTab } from "@/components/tabs/paid-media-tab";
import { FunnelTab } from "@/components/tabs/funnel-tab";
import { DigitalTab } from "@/components/tabs/digital-tab";
import { OmnichannelTab } from "@/components/tabs/omnichannel-tab";
import { CustomersTab } from "@/components/tabs/customers-tab";
import { ContributionTab } from "@/components/tabs/contribution-tab";
import { FinanceTab } from "@/components/tabs/finance-tab";
import { TargetsTab } from "@/components/tabs/targets-tab";
import { ExperimentsTab } from "@/components/tabs/experiments-tab";
import { BrandTab } from "@/components/tabs/brand-tab";
import { EcomTab } from "@/components/tabs/ecom-tab";
import { SchemaTab } from "@/components/tabs/schema-tab";
import { GovernanceTab } from "@/components/tabs/governance-tab";

interface TabDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  group: string;
  description: string;
  hasFilters: boolean;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Control Tower", shortLabel: "Control Tower", icon: LayoutDashboard, group: "Executive", description: "Enterprise marketing performance at a glance — spend, funnel, acquisition economics and data health", hasFilters: true },
  { id: "campaigns", label: "Campaign Performance", shortLabel: "Campaigns", icon: Megaphone, group: "Marketing Performance", description: "Budget utilization, acquisition economics and ROI for every campaign in the gold campaign master", hasFilters: true },
  { id: "paid-media", label: "Paid Media", shortLabel: "Paid Media", icon: MousePointerClick, group: "Marketing Performance", description: "Cross-platform advertising performance — standardized spend, CTR, CPC, CPM and reach", hasFilters: true },
  { id: "funnel", label: "Acquisition Funnel", shortLabel: "Funnel", icon: ListFilter, group: "Marketing Performance", description: "End-to-end funnel from submission to funded account with stage conversion rates (UC01)", hasFilters: true },
  { id: "digital", label: "Digital Engagement", shortLabel: "Digital", icon: MonitorSmartphone, group: "Marketing Performance", description: "Website sessions, landing pages, device engagement and email performance (UC03)", hasFilters: true },
  { id: "omnichannel", label: "Omnichannel & Offline", shortLabel: "Omnichannel", icon: RadioTower, group: "Marketing Performance", description: "Direct mail, billboards, DOOH, TV, call center, branch and referral performance (UC05)", hasFilters: true },
  { id: "customers", label: "Customer Acquisition", shortLabel: "Customers", icon: Users, group: "Customers & Revenue", description: "Which segments, markets and products marketing acquires — and lead quality by campaign (UC06)", hasFilters: true },
  { id: "contribution", label: "Revenue & Contribution", shortLabel: "Contribution", icon: TrendingUp, group: "Customers & Revenue", description: "Relationship value, product contribution and campaign payback (UC07)", hasFilters: true },
  { id: "finance", label: "Finance Reconciliation", shortLabel: "Reconciliation", icon: Receipt, group: "Finance & Planning", description: "Platform spend vs vendor invoices vs GL postings with variance analysis (UC08)", hasFilters: true },
  { id: "targets", label: "Targets & Attainment", shortLabel: "Targets", icon: Flag, group: "Finance & Planning", description: "Plan versus actual funded accounts and contribution by product and market (UC09)", hasFilters: true },
  { id: "experiments", label: "Experiments", shortLabel: "Experiments", icon: FlaskConical, group: "Advanced Analytics", description: "A/B test results with conversion uplift and statistical confidence (UC04)", hasFilters: false },
  { id: "brand", label: "Brand Lift", shortLabel: "Brand Lift", icon: Award, group: "Advanced Analytics", description: "Brand awareness, consideration and message recall by survey wave (UC10)", hasFilters: false },
  { id: "ecom", label: "E-Commerce", shortLabel: "E-Commerce", icon: ShoppingCart, group: "Advanced Analytics", description: "Order revenue, categories and campaign ROAS from the supplemental e-commerce domain (UC11)", hasFilters: true },
  { id: "schema", label: "Schema Explorer", shortLabel: "Schema", icon: Database, group: "Data Platform", description: "Browse all 39 tables in the gold_business schema — dimensions, marts, reference data and lineage", hasFilters: false },
  { id: "governance", label: "Governance & Quality", shortLabel: "Governance", icon: ShieldCheck, group: "Data Platform", description: "Campaign resolution, source coverage, acceptance checks and the governed KPI dictionary", hasFilters: false },
];

const GROUPS = ["Executive", "Marketing Performance", "Customers & Revenue", "Finance & Planning", "Advanced Analytics", "Data Platform"];

export default function Home() {
  const [activeId, setActiveId] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const active = useMemo(() => TABS.find((t) => t.id === activeId) ?? TABS[0], [activeId]);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1 },
        },
      }),
    []
  );

  const navContent = (onNavigate?: () => void) => (
    <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Report navigation">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{group}</p>
          <div className="space-y-0.5">
            {TABS.filter((t) => t.group === group).map((tab) => {
              const isActive = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveId(tab.id); onNavigate?.(); }}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-teal-500/15 text-teal-300"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-teal-400" : "text-slate-500 group-hover:text-slate-300")} />
                  <span className="truncate">{tab.label}</span>
                  {isActive ? <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-teal-500/60" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600 text-sm font-bold text-white shadow-lg shadow-teal-500/20">
        mh
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">myhonda Marketing IQ</p>
        <p className="truncate text-[11px] text-slate-500">Gold Layer Analytics</p>
      </div>
    </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <div className="flex flex-1">
          {/* Desktop sidebar */}
          <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-slate-950 lg:flex">
            {brand}
            {navContent()}
            <div className="border-t border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <p className="text-[11px] text-slate-500">Unity Catalog analytics</p>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-600">Bronze → Silver (DQX) → gold_business · 39 tables · 10 use cases</p>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Sticky header + filter bar wrapped together so the filter bar never slides under the header */}
            <div className="sticky top-0 z-40">
              <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="flex items-center gap-3 px-4 py-3 md:px-6">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <button className="rounded-md border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Open navigation">
                      <Menu className="h-4 w-4" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[260px] bg-slate-950 p-0 border-r-0">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <div className="flex h-full flex-col">
                      {brand}
                      {navContent(() => setMobileNavOpen(false))}
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 md:text-lg">{active.label}</h1>
                    <Badge variant="outline" className="hidden shrink-0 border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-500 sm:inline-flex">
                      {TABS.findIndex((t) => t.id === active.id) + 1} / {TABS.length}
                    </Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 md:line-clamp-2">{active.description}</p>
                </div>

                <div className="hidden shrink-0 items-center gap-2 xl:flex">
                  <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[10px] font-medium text-teal-700">Databricks App</Badge>
                </div>
              </div>
            </header>

            {active.hasFilters ? <FilterBar /> : null}
            </div>

            <main className="flex-1 px-4 py-5 md:px-6">
              <div className="mb-3"><ConnectionStatus /></div>
              <QueryErrors />
              <div key={activeId} className="animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
                {activeId === "overview" ? <OverviewTab /> : null}
                {activeId === "campaigns" ? <CampaignsTab /> : null}
                {activeId === "paid-media" ? <PaidMediaTab /> : null}
                {activeId === "funnel" ? <FunnelTab /> : null}
                {activeId === "digital" ? <DigitalTab /> : null}
                {activeId === "omnichannel" ? <OmnichannelTab /> : null}
                {activeId === "customers" ? <CustomersTab /> : null}
                {activeId === "contribution" ? <ContributionTab /> : null}
                {activeId === "finance" ? <FinanceTab /> : null}
                {activeId === "targets" ? <TargetsTab /> : null}
                {activeId === "experiments" ? <ExperimentsTab /> : null}
                {activeId === "brand" ? <BrandTab /> : null}
                {activeId === "ecom" ? <EcomTab /> : null}
                {activeId === "schema" ? <SchemaTab /> : null}
                {activeId === "governance" ? <GovernanceTab /> : null}
              </div>
            </main>

            {/* Footer */}
            <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
              <div className="flex flex-col items-start justify-between gap-2 text-[11px] text-slate-400 sm:flex-row sm:items-center">
                <p>
                  myhonda Marketing Intelligence · Gold Layer <span className="font-medium text-slate-500">v2.1.0</span> · gold_business: 39 tables / 10 use cases
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Connected gold data · validate modeled measures against your source definitions
                </p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}
