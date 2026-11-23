import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/paid-media — paid delivery KPIs (incl. 28-day unique
// reach), platform / daily / format breakdowns, per-campaign
// reach, ad registry and vendor-vs-model spend variance.
// (PaidMediaResponse contract)
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PaidMediaResponse } from "@/lib/api-types";
import {
  parseFilters,
  paidMediaWhere,
  funnelWhere,
  vendorWhere,
} from "@/lib/server/filters";
import {
  dateKey,
  safeDiv,
  round2,
  round4,
  groupBy,
  bump,
  sumBy,
} from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const f = await parseFilters(req);

  // Reach windows: 28-day dedupe windows; campaign filter only (no date filter).
  const reachWhere: { windowType: string; campaignKey?: string } = { windowType: "28-day" };
  if (f.campaign) reachWhere.campaignKey = f.campaign;

  const adWhere: { campaignKey?: string; platform?: string } = {};
  if (f.campaign) adWhere.campaignKey = f.campaign;
  if (f.platform) adWhere.platform = f.platform;

  const [paidRows, funnelRows, reachRows, adRows, vendorRows, campaigns] = await Promise.all([
    db.paidMediaDaily.selectRows({
      where: paidMediaWhere(f),
      select: {
        campaignKey: true,
        reportDate: true,
        platform: true,
        format: true,
        spendUsd: true,
        impressions: true,
        linkClicks: true,
        reportedResponseSubmissions: true,
      },
    }),
    db.submissionFunnelMart.selectRows({
      where: funnelWhere(f),
      select: { platform: true, submissionsWithFundedAccounts: true },
    }),
    db.paidReachWindow.selectRows({
      where: reachWhere,
      select: {
        campaignKey: true,
        campaignName: true,
        platform: true,
        uniqueReach: true,
        impressions: true,
      },
    }),
    db.paidAd.selectRows({
      where: adWhere,
      select: {
        adId: true,
        campaignKey: true,
        platform: true,
        format: true,
        marketId: true,
        effectiveStart: true,
        effectiveEnd: true,
        campaignResolutionStatus: true,
      },
    }),
    db.vendorMediaDaily.selectRows({
      where: vendorWhere(f),
      select: { platform: true, spendAmount: true },
    }),
    db.campaign.selectRows({ select: { campaignKey: true, campaignTitle: true } }),
  ]);

  const campaignTitle = new Map(campaigns.map((c) => [c.campaignKey, c.campaignTitle]));

  // ---------- KPIs ----------
  const spend = sumBy(paidRows, (r) => r.spendUsd);
  const impressions = sumBy(paidRows, (r) => r.impressions);
  const clicks = sumBy(paidRows, (r) => r.linkClicks);
  const conversions = sumBy(paidRows, (r) => r.reportedResponseSubmissions);
  const uniqueReach = sumBy(reachRows, (r) => r.uniqueReach);
  const reachImpressions = sumBy(reachRows, (r) => r.impressions);
  const kpis: PaidMediaResponse["kpis"] = {
    spend: round2(spend),
    impressions,
    clicks,
    ctr: round4(safeDiv(clicks, impressions)),
    cpc: round2(safeDiv(spend, clicks)),
    cpm: round2(safeDiv(spend, impressions) * 1000),
    conversions,
    cpConv: round2(safeDiv(spend, conversions)),
    uniqueReach,
    frequency: round2(safeDiv(reachImpressions, uniqueReach)),
  };

  // ---------- platform ----------
  const fundedByPlatform = new Map<string, number>();
  for (const r of funnelRows) bump(fundedByPlatform, r.platform, r.submissionsWithFundedAccounts);
  const paidByPlatform = groupBy(paidRows, (r) => r.platform);
  const platform = Array.from(paidByPlatform.entries())
    .map(([p, rows]) => {
      const pSpend = sumBy(rows, (r) => r.spendUsd);
      const pImpr = sumBy(rows, (r) => r.impressions);
      const pClicks = sumBy(rows, (r) => r.linkClicks);
      const pFunded = fundedByPlatform.get(p) ?? 0;
      return {
        platform: p,
        spend: round2(pSpend),
        impressions: pImpr,
        clicks: pClicks,
        ctr: round4(safeDiv(pClicks, pImpr)),
        cpc: round2(safeDiv(pSpend, pClicks)),
        cpm: round2(safeDiv(pSpend, pImpr) * 1000),
        submissions: sumBy(rows, (r) => r.reportedResponseSubmissions),
        fundedAccounts: pFunded,
        cac: round2(safeDiv(pSpend, pFunded)),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // ---------- daily ----------
  const paidByDate = groupBy(paidRows, (r) => dateKey(r.reportDate));
  const daily = Array.from(paidByDate.entries())
    .map(([date, rows]) => ({
      date,
      spend: round2(sumBy(rows, (r) => r.spendUsd)),
      impressions: sumBy(rows, (r) => r.impressions),
      clicks: sumBy(rows, (r) => r.linkClicks),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ---------- format ----------
  const paidByFormat = groupBy(paidRows, (r) => r.format);
  const format = Array.from(paidByFormat.entries())
    .map(([fmt, rows]) => {
      const fmtSpend = sumBy(rows, (r) => r.spendUsd);
      const fmtImpr = sumBy(rows, (r) => r.impressions);
      const fmtClicks = sumBy(rows, (r) => r.linkClicks);
      return {
        format: fmt,
        spend: round2(fmtSpend),
        impressions: fmtImpr,
        clicks: fmtClicks,
        ctr: round4(safeDiv(fmtClicks, fmtImpr)),
        cpc: round2(safeDiv(fmtSpend, fmtClicks)),
        submissions: sumBy(rows, (r) => r.reportedResponseSubmissions),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // ---------- reach (28-day windows, per campaign) ----------
  const reachByCmp = groupBy(reachRows, (r) => r.campaignKey);
  const reach = Array.from(reachByCmp.entries())
    .map(([key, rows]) => {
      const ur = sumBy(rows, (r) => r.uniqueReach);
      const imps = sumBy(rows, (r) => r.impressions);
      return {
        campaignKey: key,
        campaignTitle: rows[0].campaignName,
        platform: rows[0].platform,
        uniqueReach: ur,
        impressions: imps,
        frequency: round2(safeDiv(imps, ur)),
      };
    })
    .sort((a, b) => b.uniqueReach - a.uniqueReach || b.impressions - a.impressions)
    .slice(0, 20);

  // ---------- ad registry ----------
  const ads = adRows
    .map((a) => ({
      adId: a.adId,
      campaignKey: a.campaignKey,
      campaignTitle: campaignTitle.get(a.campaignKey) ?? a.campaignKey,
      platform: a.platform,
      format: a.format,
      market: a.marketId,
      effectiveStart: dateKey(a.effectiveStart),
      effectiveEnd: dateKey(a.effectiveEnd),
      resolutionStatus: a.campaignResolutionStatus,
    }))
    .sort((a, b) => (a.adId < b.adId ? -1 : a.adId > b.adId ? 1 : 0))
    .slice(0, 60);

  // ---------- vendor vs model ----------
  const modelSpendByPlatform = new Map<string, number>();
  for (const r of paidRows) bump(modelSpendByPlatform, r.platform, r.spendUsd);
  const vendorSpendByPlatform = new Map<string, number>();
  for (const r of vendorRows) bump(vendorSpendByPlatform, r.platform, r.spendAmount);
  const vendorVsModel = Array.from(
    new Set([...modelSpendByPlatform.keys(), ...vendorSpendByPlatform.keys()])
  )
    .map((p) => {
      const model = modelSpendByPlatform.get(p) ?? 0;
      const vendor = vendorSpendByPlatform.get(p) ?? 0;
      return {
        platform: p,
        modelSpend: round2(model),
        vendorSpend: round2(vendor),
        variancePct: round4(safeDiv(vendor - model, model)),
      };
    })
    .sort((a, b) => b.modelSpend - a.modelSpend || b.vendorSpend - a.vendorSpend);

  const res: PaidMediaResponse = { kpis, platform, daily, format, reach, ads, vendorVsModel };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
