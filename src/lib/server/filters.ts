// ============================================================
// Global query-param filter parsing + per-table warehouse filter
// builders for the gold_business schema (39 tables from
// upload/07_gold_to_gold_business.csv). Shared by every
// analytics API route.
//
// Filter semantics:
//  - daily marts:   date column within [from 00:00, to 23:59:59]
//  - monthly marts: month-start within month-start(from)..month-start(to)
//  - mart_demo_website_engagement_daily keeps NULL resolved_campaign_key
//    rows ("unattributed") when a campaign filter is applied;
//    mart_demo_submission_funnel keeps its UNATTRIBUTED sentinel rows.
// ============================================================

import { db } from "@/lib/db";
import type { Where, Comparison } from "@/lib/server/query";
import type { RowModels } from "@/lib/server/row-models";
import { startOfMonthUTC } from "./helpers";
import { canonicalPlatform, platformAliases } from "@/lib/platforms";
import { parametersForReport } from "@/lib/filter-capabilities";
import { campaignsForPlatform, DATA_DATES } from "./filter-catalog";
import { GOLD_TABLES } from "./gold-tables";

export interface FilterParams {
  from?: Date;
  to?: Date;
  campaign?: string;
  platform?: string;
  market?: string;
  product?: string;
  segment?: string;
  /** dim_market.marketDisplayName for the selected market (join helper). */
  marketDisplay?: string;
  platformCampaigns?: string[];
  productCampaigns?: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(v: string | null): Date | undefined {
  if (!v || !DATE_RE.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : d;
}

/** Parse global filters from the request URL (invalid/empty values are ignored). */
export async function parseFilters(req: Request): Promise<FilterParams> {
  const url = new URL(req.url);
  const params = parametersForReport(url.pathname.split("/").pop() ?? "", Object.fromEntries(url.searchParams));
  const sp = new URLSearchParams(params);
  const get = (k: string): string | undefined => {
    const v = sp.get(k);
    return v !== null && v.trim() !== "" ? v.trim() : undefined;
  };
  const f: FilterParams = {
    from: parseDateParam(sp.get("from")),
    to: parseDateParam(sp.get("to")),
    campaign: get("campaign"),
    platform: get("platform"),
    market: get("market"),
    product: get("product"),
    segment: get("segment"),
  };
  if (f.platform) f.platform = canonicalPlatform(f.platform);
  await Promise.all([
    f.platform ? campaignsForPlatform(f.platform).then(keys => { f.platformCampaigns = keys; }) : undefined,
    f.product ? db.campaign.selectRows({ where: { productId: f.product }, select: { campaignKey: true } }).then(rows => { f.productCampaigns = rows.map(row => row.campaignKey); }) : undefined,
  ]);
  if (f.market) {
    const m = await db.market.findOne({ where: { marketId: f.market } });
    if (m) f.marketDisplay = m.marketDisplayName;
  }
  return f;
}

/** Inclusive daily range [from 00:00:00, to 23:59:59.999] (UTC). */
export function dayRange(f: FilterParams): Comparison<Date> | undefined {
  if (!f.from && !f.to) return undefined;
  const r: Comparison<Date> = {};
  if (f.from) r.gte = f.from;
  if (f.to) r.lte = new Date(f.to.getTime() + 86_399_999);
  return r;
}

/** Month-start range used for monthly/period tables. */
export function monthRange(f: FilterParams): Comparison<Date> | undefined {
  if (!f.from && !f.to) return undefined;
  const r: Comparison<Date> = {};
  if (f.from) r.gte = startOfMonthUTC(f.from);
  if (f.to) r.lte = startOfMonthUTC(f.to);
  return r;
}

// ---------- per-table filter compilation ----------
// Direct dimensions retain their own grain. Platform/product can also select
// linked campaigns when a campaign-keyed table has no direct dimension.
export function tableWhere<K extends keyof RowModels>(model: K, f: FilterParams): Where<RowModels[K]> {
  const entry = Object.entries(GOLD_TABLES).find(([, def]) => def.model === model);
  if (!entry) throw new Error(`Unknown model: ${model}`);
  const [table, def] = entry;
  const fields = new Set(Object.values(def.fields));
  const w: Record<string, unknown> = {};
  const and: object[] = [];
  const campaign = fields.has("campaignKey") ? "campaignKey" : fields.has("resolvedCampaignKey") ? "resolvedCampaignKey" : undefined;
  if (f.campaign && campaign) {
    if (table === "mart_demo_submission_funnel") w.OR = [{ campaignKey: f.campaign }, { campaignKey: "UNATTRIBUTED" }];
    else if (["mart_website_engagement_daily", "mart_offline_activity_monthly"].includes(table)) w.OR = [{ [campaign]: f.campaign }, { [campaign]: null }];
    else w[campaign] = f.campaign;
  }
  if (f.platform) {
    if (fields.has("platform")) w.platform = { normalizedIn: platformAliases(f.platform) };
    else if (campaign) and.push({ [campaign]: { in: f.platformCampaigns ?? [] } });
  }
  if (f.product) {
    if (fields.has("productId")) w.productId = f.product;
    else if (campaign) and.push({ [campaign]: { in: f.productCampaigns ?? [] } });
  }
  if (f.segment && fields.has("segmentId")) w.segmentId = f.segment;
  if (f.market) {
    const market = ["marketId", "marketCode", "addrMarket", "geographySourceValue", "marketName"].find(field => fields.has(field));
    if (market) w[market] = { normalizedIn: [f.market, ...(f.marketDisplay ? [f.marketDisplay] : [])] };
  }
  const intervals: Record<string, [string, string]> = {
    PaidReachWindow: ["windowStart", "windowEnd"], ExperimentVariantMart: ["windowStart", "windowEnd"],
    ExperimentVariantDim: ["windowStart", "windowEnd"], PaidAd: ["effectiveStart", "effectiveEnd"],
    VendorCampaign: ["flightStart", "flightEnd"], WebExperimentVariant: ["beginDate", "endDate"],
  };
  const interval = intervals[model];
  if (interval) {
    if (f.from) w[interval[1]] = { gte: f.from };
    if (f.to) w[interval[0]] = { lte: new Date(f.to.getTime() + 86399999) };
  } else {
    const dates: Record<string, string> = { SocialCampaign: "publishDt", SalesTargetOverrideCandidate: "targetMonth" };
    const column = DATA_DATES[table];
    const field = dates[model] ?? (column ? def.fields[column] : undefined);
    const range = field && (field.toLowerCase().includes("month") ? monthRange(f) : dayRange(f));
    if (field && range) w[field] = range;
  }
  if (and.length) w.AND = and;
  return w as Where<RowModels[K]>;
}

export function paidMediaWhere(f: FilterParams): Where<RowModels["PaidMediaDaily"]> { return tableWhere("PaidMediaDaily", f); }
export function funnelWhere(f: FilterParams): Where<RowModels["SubmissionFunnelMart"]> { return tableWhere("SubmissionFunnelMart", f); }
export function webWhere(f: FilterParams): Where<RowModels["WebsiteEngagementDaily"]> { return tableWhere("WebsiteEngagementDaily", f); }
export function emailMartWhere(f: FilterParams): Where<RowModels["EmailEngagementDaily"]> { return tableWhere("EmailEngagementDaily", f); }
export function newFundedWhere(f: FilterParams): Where<RowModels["NewFundedCustomersMonthly"]> { return tableWhere("NewFundedCustomersMonthly", f); }
export function relWhere(f: FilterParams): Where<RowModels["RelationshipValueMonthly"]> { return tableWhere("RelationshipValueMonthly", f); }
export function bankingWhere(f: FilterParams): Where<RowModels["BankingFundedAccountsMonthly"]> { return tableWhere("BankingFundedAccountsMonthly", f); }
export function targetWhere(f: FilterParams): Where<RowModels["SalesTargetAttainmentMonthly"]> { return tableWhere("SalesTargetAttainmentMonthly", f); }
export function dmWhere(f: FilterParams): Where<RowModels["DirectMailPerformanceMonthly"]> { return tableWhere("DirectMailPerformanceMonthly", f); }
export function offlineWhere(f: FilterParams): Where<RowModels["OfflineActivityMonthly"]> { return tableWhere("OfflineActivityMonthly", f); }
export function vendorWhere(f: FilterParams): Where<RowModels["VendorMediaDaily"]> { return tableWhere("VendorMediaDaily", f); }
export function coverageWhere(f: FilterParams): Where<RowModels["CampaignAttributionCoverage"]> { return tableWhere("CampaignAttributionCoverage", f); }
export function reconWhere(f: FilterParams): Where<RowModels["FinanceReconciliationMonthly"]> { return tableWhere("FinanceReconciliationMonthly", f); }
export function ecomWhere(f: FilterParams): Where<RowModels["EcomOrdersMonthly"]> { return tableWhere("EcomOrdersMonthly", f); }
export function brandWhere(f: FilterParams): Where<RowModels["BrandSurveyWave"]> { return tableWhere("BrandSurveyWave", f); }

// ---------- channel grouping ----------

/** Map an advertising platform to a business channel group. */
export function channelGroupForPlatform(platform: string): string {
  switch (platform) {
    case "Google Ads":
      return "Paid Search";
    case "Meta Ads":
    case "TikTok Ads":
    case "Reddit Ads":
    case "Pinterest Ads":
    case "Snapchat Ads":
      return "Paid Social";
    case "LinkedIn Ads":
      return "B2B Social";
    case "The Trade Desk":
    case "YouTube Ads":
      return "Programmatic & Video";
    default:
      return platform;
  }
}

/**
 * Build campaignKey -> channelGroup across the gold_business marts:
 * offline channels win (Direct Mail / Out-of-Home / Broadcast / Call Center),
 * otherwise the campaign's dominant paid platform decides.
 */
export async function campaignChannelGroups(): Promise<Map<string, string>> {
  const [dmRows, offlineRows, paidRows] = await Promise.all([
    db.directMailPerformanceMonthly.selectRows({ distinct: ['resolvedCampaignKey'], select: { resolvedCampaignKey: true } }),
    db.offlineActivityMonthly.selectRows({ distinct: ['resolvedCampaignKey', 'sourceChannel'], select: { resolvedCampaignKey: true, sourceChannel: true } }),
    db.paidMediaDaily.groupedSum(['campaignKey', 'platform'], ['spendUsd']),
  ]);
  const groups = new Map<string, string>();
  const spendByPlatform = new Map<string, Map<string, number>>();
  for (const r of paidRows) {
    const byPlat = spendByPlatform.get(r.campaignKey) ?? new Map<string, number>();
    byPlat.set(r.platform, (byPlat.get(r.platform) ?? 0) + r.spendUsd);
    spendByPlatform.set(r.campaignKey, byPlat);
  }
  for (const [key, byPlat] of spendByPlatform) {
    const top = [...byPlat.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) groups.set(key, channelGroupForPlatform(top[0]));
  }
  const channelRank: Record<string, number> = {
    "Direct Mail": 4, "Out-of-Home": 3, "Broadcast": 3, "Radio": 3, "Branch Event": 2, "Referral": 2, "Call Center": 1,
  };
  const bestOffline = new Map<string, { channel: string; rank: number }>();
  for (const r of offlineRows) {
    if (!r.resolvedCampaignKey) continue;
    const rank = channelRank[r.sourceChannel] ?? 1;
    const cur = bestOffline.get(r.resolvedCampaignKey);
    if (!cur || rank > cur.rank) bestOffline.set(r.resolvedCampaignKey, { channel: r.sourceChannel, rank });
  }
  for (const [key, v] of bestOffline) {
    groups.set(key, v.channel === "Radio" ? "Broadcast" : v.channel === "Billboard" || v.channel === "DOOH" ? "Out-of-Home" : v.channel);
  }
  for (const r of dmRows) {
    if (r.resolvedCampaignKey) groups.set(r.resolvedCampaignKey, "Direct Mail");
  }
  return groups;
}
