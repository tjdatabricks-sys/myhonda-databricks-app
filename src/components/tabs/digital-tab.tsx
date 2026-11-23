"use client";

import { useAnalyticsQuery } from "@/lib/api";
import type { DigitalResponse } from "@/lib/api-types";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ChartCard, EmptyState } from "@/components/analytics/chart-card";
import { DataTable, type Column } from "@/components/analytics/data-table";
import { ChartTooltip } from "@/components/analytics/chart-tooltip";
import { CHART_COLORS, AXIS, GRID_STROKE } from "@/lib/chart-theme";
import { fmtNumber, fmtPct, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Globe, MousePointerClick, FileCheck2, Mail, MailOpen, MailCheck, MailWarning, MailX, Send,
  Share2, MessagesSquare, Link2, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact "Jul 4" tick label for daily ISO dates, without timezone drift. */
function fmtDay(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const m = MONTH_NAMES[Number(parts[1]) - 1];
  return m ? `${m} ${Number(parts[2])}` : iso;
}

/** Small status pill: emerald when positive, amber when warning, slate otherwise. */
function toneBadge(value: string, positive: string[], warning: string[]) {
  const cls = positive.includes(value)
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : warning.includes(value)
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "text-slate-500";
  return (
    <Badge variant="outline" className={cn("text-[10.5px]", cls)}>
      {value}
    </Badge>
  );
}

export function DigitalTab() {
  const { data, isLoading } = useAnalyticsQuery<DigitalResponse>("digital");
  const wk = data?.webKpis;
  const ek = data?.emailKpis;
  const sk = data?.socialKpis;
  const webSubmitRate = wk?.submitRate ?? 0;

  const attribution = data?.attribution ?? [];
  const attributionTotal = attribution.reduce((sum, a) => sum + a.sessions, 0);

  const socialPlatform = data?.socialPlatform ?? [];
  const socialPostsTotal = socialPlatform.reduce((sum, p) => sum + p.posts, 0);

  const landingCols: Column<DigitalResponse["landingPages"][number]>[] = [
    {
      key: "path",
      header: "Landing page",
      cell: (r) => (
        <span className="block max-w-[170px] truncate font-medium text-slate-700" title={r.path}>
          {r.path}
        </span>
      ),
      sortValue: (r) => r.path,
    },
    { key: "sessions", header: "Sessions", align: "right", cell: (r) => fmtNumber(r.sessions) },
    { key: "engagedRate", header: "Engaged", align: "right", cell: (r) => fmtPct(r.engagedRate) },
    {
      key: "submitRate",
      header: "Submit rate",
      align: "right",
      cell: (r) => (
        <span className={cn("font-semibold", webSubmitRate > 0 && r.submitRate >= webSubmitRate ? "text-emerald-600" : "text-slate-600")}>
          {fmtPct(r.submitRate, 2)}
        </span>
      ),
      sortValue: (r) => r.submitRate,
    },
  ];

  const emailCampaignCols: Column<DigitalResponse["emailCampaigns"][number]>[] = [
    {
      key: "campaign",
      header: "Campaign",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.campaignTitle}</p>
          <p className="text-[11px] text-slate-400">{r.campaignKey}</p>
        </div>
      ),
      sortValue: (r) => r.campaignTitle,
    },
    { key: "sends", header: "Sends", align: "right", cell: (r) => fmtNumber(r.sends) },
    { key: "openRate", header: "Open rate", align: "right", cell: (r) => fmtPct(r.openRate) },
    { key: "clickRate", header: "Click rate", align: "right", cell: (r) => fmtPct(r.clickRate, 2) },
    {
      key: "optOutRate",
      header: "Opt-out",
      align: "right",
      cell: (r) => (
        <span className={cn("font-medium", r.optOutRate >= 0.005 ? "text-rose-600" : "text-slate-500")}>{fmtPct(r.optOutRate, 2)}</span>
      ),
      sortValue: (r) => r.optOutRate,
    },
  ];

  const socialPlatformCols: Column<DigitalResponse["socialPlatform"][number]>[] = [
    { key: "platform", header: "Platform", cell: (r) => <span className="font-medium text-slate-700">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "posts", header: "Posts", align: "right", cell: (r) => fmtNumber(r.posts), sortValue: (r) => r.posts },
    {
      key: "share",
      header: "Share of posts",
      align: "right",
      cell: (r) => fmtPct(socialPostsTotal > 0 ? r.posts / socialPostsTotal : 0, 1),
      sortValue: (r) => (socialPostsTotal > 0 ? r.posts / socialPostsTotal : 0),
    },
  ];

  const socialCampaignCols: Column<DigitalResponse["socialCampaigns"][number]>[] = [
    {
      key: "postRef",
      header: "Post",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-700">{r.postRef}</p>
          <p className="text-[11px] text-slate-400">{r.theme}</p>
        </div>
      ),
      sortValue: (r) => r.postRef,
    },
    { key: "platform", header: "Platform", cell: (r) => <span className="text-slate-600">{r.platform}</span>, sortValue: (r) => r.platform },
    { key: "postType", header: "Type", cell: (r) => r.postType, sortValue: (r) => r.postType },
    { key: "publishDate", header: "Published", cell: (r) => <span className="text-slate-500">{fmtDate(r.publishDate)}</span>, sortValue: (r) => r.publishDate },
    { key: "goal", header: "Goal", cell: (r) => r.goal, sortValue: (r) => r.goal },
    {
      key: "campaignTitle",
      header: "Campaign",
      cell: (r) => (
        <span className="block max-w-[180px] truncate font-medium text-slate-700" title={r.campaignTitle}>
          {r.campaignTitle}
        </span>
      ),
      sortValue: (r) => r.campaignTitle,
    },
    { key: "legalStatus", header: "Legal", cell: (r) => toneBadge(r.legalStatus, ["Cleared"], ["Review Required"]), sortValue: (r) => r.legalStatus },
    { key: "resolutionStatus", header: "Resolution", cell: (r) => toneBadge(r.resolutionStatus, ["Resolved"], ["Pending"]), sortValue: (r) => r.resolutionStatus },
  ];

  return (
    <div className="space-y-4">
      {/* Shared KPI row across all three digital channels */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Sessions"
          value={fmtNumber(wk?.sessions)}
          icon={Globe}
          loading={isLoading}
          accent="teal"
          description={wk ? `${fmtNumber(wk.avgSessionsPerDay, { decimals: 0 })} / day average` : undefined}
        />
        <KpiCard label="Engaged Session Rate" value={fmtPct(wk?.engagedRate)} icon={MousePointerClick} loading={isLoading} accent="cyan" description="engaged / total sessions" />
        <KpiCard label="Web Submit Rate" value={fmtPct(wk?.submitRate, 2)} icon={FileCheck2} loading={isLoading} accent="violet" description="form submits / sessions" />
        <KpiCard
          label="Emails Delivered"
          value={fmtNumber(ek?.delivered, { compact: true })}
          icon={Mail}
          loading={isLoading}
          accent="amber"
          description={ek ? `${fmtPct(ek.deliveryRate)} delivery rate` : undefined}
        />
        <KpiCard label="Email Click Rate" value={fmtPct(ek?.clickRate, 2)} icon={MousePointerClick} loading={isLoading} accent="rose" description="clicks / delivered" />
        <KpiCard
          label="Social Posts"
          value={fmtNumber(sk?.posts)}
          icon={Share2}
          loading={isLoading}
          accent="slate"
          description={sk ? `${fmtNumber(sk.platforms)} platforms active` : undefined}
        />
      </div>

      <Tabs defaultValue="website" className="gap-4">
        <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="website" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Website
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            Social
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Website ---------------- */}
        <TabsContent value="website" className="space-y-4">
          <ChartCard title="Daily website traffic" subtitle="Sessions with engaged sessions and form submits (dual axis)" loading={isLoading}>
            {data?.webDaily?.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.webDaily} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDay} {...AXIS} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis yAxisId="left" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={52} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                    <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v)} labelFormatter={(l) => fmtDate(String(l))} />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                    <Area yAxisId="left" dataKey="sessions" name="Sessions" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.12} strokeWidth={2} />
                    <Line yAxisId="right" dataKey="engaged" name="Engaged sessions" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" dataKey="submits" name="Form submits" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No web sessions in range" />
            )}
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <ChartCard title="Top landing pages" subtitle="Sessions, engagement and submit rates by entry page" loading={isLoading}>
              <DataTable
                columns={landingCols}
                rows={data?.landingPages ?? []}
                loading={isLoading}
                maxHeight="max-h-72"
                dense
                initialSort={{ key: "sessions", dir: "desc" }}
                rowKey={(r) => r.path}
                emptyMessage="No landing page data in range"
              />
            </ChartCard>

            <ChartCard title="Sessions by device" subtitle="Share of sessions across device categories" loading={isLoading}>
              {data?.devices?.length ? (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.devices} dataKey="sessions" nameKey="device" innerRadius="50%" outerRadius="75%" paddingAngle={2} strokeWidth={2}>
                        {data.devices.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v)} />} />
                      <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={7} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No device data in range" />
              )}
            </ChartCard>

            <ChartCard title="Session attribution" subtitle="Campaign-attributed vs unattributed sessions with engagement quality" loading={isLoading}>
              {attribution.length ? (
                <div className="space-y-4 py-1">
                  {attribution.map((a, i) => {
                    const share = attributionTotal > 0 ? a.sessions / attributionTotal : 0;
                    return (
                      <div key={a.status}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-slate-600">{a.status}</span>
                          <span className="flex items-center gap-1.5 text-xs tabular-nums text-slate-500">
                            {fmtNumber(a.sessions)} sessions
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">{fmtPct(share, 0)}</span>
                          </span>
                        </div>
                        <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                          <div
                            role="img"
                            aria-label={`${a.status}: ${fmtNumber(a.sessions)} sessions, ${fmtPct(share, 0)} of total`}
                            className={cn(
                              "h-full rounded-md transition-all duration-500",
                              i === 0 ? "bg-gradient-to-r from-teal-600 to-teal-400" : "bg-slate-400"
                            )}
                            style={{ width: `${Math.max(1.5, share * 100)}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span>
                            Engaged rate <span className="font-semibold tabular-nums text-slate-700">{fmtPct(a.engagedRate)}</span>
                          </span>
                          <span>
                            Submit rate <span className="font-semibold tabular-nums text-slate-700">{fmtPct(a.submitRate, 2)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No attribution data in range" />
              )}
            </ChartCard>
          </div>
        </TabsContent>

        {/* ---------------- Email ---------------- */}
        <TabsContent value="email" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Emails Sent" value={fmtNumber(ek?.sent, { compact: true })} icon={Send} loading={isLoading} accent="teal" />
            <KpiCard label="Delivery Rate" value={fmtPct(ek?.deliveryRate)} icon={MailCheck} loading={isLoading} accent="cyan" />
            <KpiCard label="Open Rate" value={fmtPct(ek?.openRate)} icon={MailOpen} loading={isLoading} accent="violet" description="distorted by privacy features" />
            <KpiCard label="Click Rate" value={fmtPct(ek?.clickRate, 2)} icon={MousePointerClick} loading={isLoading} accent="amber" description="primary engagement signal" />
            <KpiCard label="Bounce Rate" value={fmtPct(ek?.bounceRate, 2)} icon={MailWarning} loading={isLoading} accent="rose" />
            <KpiCard label="Opt-out Rate" value={fmtPct(ek?.optOutRate, 2)} icon={MailX} loading={isLoading} accent="slate" />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p className="text-xs leading-relaxed text-amber-800">
              <span className="font-semibold">Measurement caution:</span> open rates are distorted by privacy features (e.g. Apple Mail Privacy
              Protection auto-fetching images). Treat opens as directional and use click rate as the primary email engagement signal.
            </p>
          </div>

          <ChartCard title="Daily email performance" subtitle="Sends with opens and clicks (dual axis)" loading={isLoading}>
            {data?.emailDaily?.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.emailDaily} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDay} {...AXIS} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis yAxisId="left" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={52} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtNumber(v, { compact: true })} {...AXIS} width={44} />
                    <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNumber(v)} labelFormatter={(l) => fmtDate(String(l))} />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7} />
                    <Bar yAxisId="left" dataKey="sent" name="Sent" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Line yAxisId="right" dataKey="opens" name="Opens" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" dataKey="clicks" name="Clicks" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No email sends in range" />
            )}
          </ChartCard>

          <ChartCard
            title="Email campaign performance"
            subtitle="Engagement and list health by campaign"
            loading={isLoading}
            noPadding
            contentClassName="px-4 pb-4 pt-1"
          >
            <DataTable
              columns={emailCampaignCols}
              rows={data?.emailCampaigns ?? []}
              loading={isLoading}
              maxHeight="max-h-80"
              initialSort={{ key: "sends", dir: "desc" }}
              rowKey={(r) => r.campaignKey}
              emptyMessage="No email campaigns in range"
            />
          </ChartCard>
        </TabsContent>

        {/* ---------------- Social ---------------- */}
        <TabsContent value="social" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Social Posts" value={fmtNumber(sk?.posts)} icon={MessagesSquare} loading={isLoading} accent="teal" description="organic posts published" />
            <KpiCard label="Platforms Active" value={fmtNumber(sk?.platforms)} icon={Share2} loading={isLoading} accent="cyan" description="distinct social platforms" />
            <KpiCard label="Resolved to Campaign" value={fmtPct(sk?.resolvedRate)} icon={Link2} loading={isLoading} accent="amber" description="posts linked to a campaign" />
            <KpiCard label="Legal Cleared" value={fmtPct(sk?.clearedRate)} icon={ShieldCheck} loading={isLoading} accent="violet" description="posts through legal review" />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <ChartCard title="Posts by platform" subtitle="Share of published posts across active platforms" className="xl:col-span-2" loading={isLoading}>
              {socialPlatform.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={socialPlatform} dataKey="posts" nameKey="platform" innerRadius="50%" outerRadius="75%" paddingAngle={2} strokeWidth={2}>
                        {socialPlatform.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip valueFormatter={(v) => `${fmtNumber(v)} posts`} />} />
                      <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={7} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No social activity in range" />
              )}
            </ChartCard>

            <ChartCard title="Platform scorecard" subtitle="Published posts and share by platform" className="xl:col-span-3" loading={isLoading}>
              <DataTable
                columns={socialPlatformCols}
                rows={socialPlatform}
                loading={isLoading}
                maxHeight="max-h-64"
                dense
                initialSort={{ key: "posts", dir: "desc" }}
                rowKey={(r) => r.platform}
                emptyMessage="No platform data in range"
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Social campaign registry"
            subtitle="Post metadata with campaign resolution and legal review status"
            loading={isLoading}
            noPadding
            contentClassName="px-4 pb-4 pt-1"
          >
            <DataTable
              columns={socialCampaignCols}
              rows={data?.socialCampaigns ?? []}
              loading={isLoading}
              maxHeight="max-h-80"
              dense
              initialSort={{ key: "publishDate", dir: "desc" }}
              rowKey={(r) => r.postRef}
              emptyMessage="No social campaigns in range"
            />
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
