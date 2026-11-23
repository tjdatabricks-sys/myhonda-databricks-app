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
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(v: string | null): Date | undefined {
  if (!v || !DATE_RE.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : d;
}

/** Parse global filters from the request URL (invalid/empty values are ignored). */
export async function parseFilters(req: Request): Promise<FilterParams> {
  const sp = new URL(req.url).searchParams;
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

// ---------- per-table where builders ----------

/** mart_demo_paid_media_daily — campaign + platform + day. */
export function paidMediaWhere(f: FilterParams): Where<RowModels["PaidMediaDaily"]> {
  const w: Where<RowModels["PaidMediaDaily"]> = {};
  if (f.campaign) w.campaignKey = f.campaign;
  if (f.platform) w.platform = f.platform;
  const d = dayRange(f);
  if (d) w.reportDate = d;
  return w;
}

/** mart_demo_submission_funnel — campaign (incl. UNATTRIBUTED) + platform + month. */
export function funnelWhere(f: FilterParams): Where<RowModels["SubmissionFunnelMart"]> {
  const w: Where<RowModels["SubmissionFunnelMart"]> = {};
  if (f.campaign) w.OR = [{ campaignKey: f.campaign }, { campaignKey: "UNATTRIBUTED" }];
  if (f.platform) w.platform = f.platform;
  const m = monthRange(f);
  if (m) w.submissionMonth = m;
  return w;
}

/** mart_website_engagement_daily — campaign (incl. unattributed NULLs) + day. */
export function webWhere(f: FilterParams): Where<RowModels["WebsiteEngagementDaily"]> {
  const w: Where<RowModels["WebsiteEngagementDaily"]> = {};
  if (f.campaign) {
    w.OR = [{ resolvedCampaignKey: f.campaign }, { resolvedCampaignKey: null }];
  }
  const d = dayRange(f);
  if (d) w.sessionDate = d;
  return w;
}

/** mart_email_engagement_daily — campaign + day. */
export function emailMartWhere(f: FilterParams): Where<RowModels["EmailEngagementDaily"]> {
  const w: Where<RowModels["EmailEngagementDaily"]> = {};
  if (f.campaign) w.resolvedCampaignKey = f.campaign;
  const d = dayRange(f);
  if (d) w.sendDt = d;
  return w;
}

/** mart_new_funded_customers_monthly — campaign + product + market + segment + month. */
export function newFundedWhere(f: FilterParams): Where<RowModels["NewFundedCustomersMonthly"]> {
  const w: Where<RowModels["NewFundedCustomersMonthly"]> = {};
  if (f.campaign) w.resolvedCampaignKey = f.campaign;
  if (f.product) w.productId = f.product;
  if (f.market) w.marketId = f.market;
  if (f.segment) w.segmentId = f.segment;
  const m = monthRange(f);
  if (m) w.acquisitionMonth = m;
  return w;
}

/** mart_demo_relationship_value_monthly — campaign + product + market + month. */
export function relWhere(f: FilterParams): Where<RowModels["RelationshipValueMonthly"]> {
  const w: Where<RowModels["RelationshipValueMonthly"]> = {};
  if (f.campaign) w.campaignKey = f.campaign;
  if (f.product) w.productId = f.product;
  if (f.market) w.marketId = f.market;
  const m = monthRange(f);
  if (m) w.valueMonth = m;
  return w;
}

/** mart_banking_funded_accounts_monthly — product + market + month. */
export function bankingWhere(f: FilterParams): Where<RowModels["BankingFundedAccountsMonthly"]> {
  const w: Where<RowModels["BankingFundedAccountsMonthly"]> = {};
  if (f.product) w.productId = f.product;
  if (f.market) w.marketId = f.market;
  const m = monthRange(f);
  if (m) w.openingMonth = m;
  return w;
}

/** mart_sales_target_attainment_monthly — product + market + month. */
export function targetWhere(f: FilterParams): Where<RowModels["SalesTargetAttainmentMonthly"]> {
  const w: Where<RowModels["SalesTargetAttainmentMonthly"]> = {};
  if (f.product) w.productId = f.product;
  if (f.market) w.marketId = f.market;
  const m = monthRange(f);
  if (m) w.targetMonth = m;
  return w;
}

/** mart_direct_mail_performance_monthly — campaign + month. */
export function dmWhere(f: FilterParams): Where<RowModels["DirectMailPerformanceMonthly"]> {
  const w: Where<RowModels["DirectMailPerformanceMonthly"]> = {};
  if (f.campaign) w.resolvedCampaignKey = f.campaign;
  const m = monthRange(f);
  if (m) w.mailMonth = m;
  return w;
}

/** mart_offline_activity_monthly — campaign (incl. unresolved) + month. */
export function offlineWhere(f: FilterParams): Where<RowModels["OfflineActivityMonthly"]> {
  const w: Where<RowModels["OfflineActivityMonthly"]> = {};
  if (f.campaign) w.OR = [{ resolvedCampaignKey: f.campaign }, { resolvedCampaignKey: null }];
  const m = monthRange(f);
  if (m) w.observationMonth = m;
  return w;
}

/** mart_vendor_media_daily — campaign + platform + day. */
export function vendorWhere(f: FilterParams): Where<RowModels["VendorMediaDaily"]> {
  const w: Where<RowModels["VendorMediaDaily"]> = {};
  if (f.campaign) w.resolvedCampaignKey = f.campaign;
  if (f.platform) w.platform = f.platform;
  const d = dayRange(f);
  if (d) w.reportDate = d;
  return w;
}

/** mart_campaign_attribution_coverage — platform + month. */
export function coverageWhere(f: FilterParams): Where<RowModels["CampaignAttributionCoverage"]> {
  const w: Where<RowModels["CampaignAttributionCoverage"]> = {};
  if (f.platform) w.platform = f.platform;
  const m = monthRange(f);
  if (m) w.reportMonth = m;
  return w;
}

/** mart_demo_finance_reconciliation_monthly — month. */
export function reconWhere(f: FilterParams): Where<RowModels["FinanceReconciliationMonthly"]> {
  const w: Where<RowModels["FinanceReconciliationMonthly"]> = {};
  const m = monthRange(f);
  if (m) w.spendMonth = m;
  return w;
}

/** mart_ecom_orders_monthly — month. */
export function ecomWhere(f: FilterParams): Where<RowModels["EcomOrdersMonthly"]> {
  const w: Where<RowModels["EcomOrdersMonthly"]> = {};
  const m = monthRange(f);
  if (m) w.orderMonth = m;
  return w;
}

/** mart_brand_survey_wave — campaign. */
export function brandWhere(f: FilterParams): Where<RowModels["BrandSurveyWave"]> {
  const w: Where<RowModels["BrandSurveyWave"]> = {};
  if (f.campaign) w.resolvedCampaignKey = f.campaign;
  return w;
}

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
