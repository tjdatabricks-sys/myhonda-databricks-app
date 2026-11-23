import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/overview — control-tower KPIs, monthly trends, channel
// mix, funnel, platform table, top campaigns, attainment, data
// quality and computed insights. (OverviewResponse contract)
//
// Sources (gold_business): mart_demo_paid_media_daily,
// mart_demo_submission_funnel, mart_demo_relationship_value_monthly,
// mart_sales_target_attainment_monthly,
// mart_demo_finance_reconciliation_monthly,
// mart_campaign_attribution_coverage,
// mart_direct_mail_performance_monthly, dim_campaign.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { OverviewResponse } from "@/lib/api-types";
import {
  parseFilters,
  paidMediaWhere,
  funnelWhere,
  relWhere,
  targetWhere,
  reconWhere,
  coverageWhere,
  dmWhere,
  campaignChannelGroups,
} from "@/lib/server/filters";
import {
  monthKey,
  monthAxis,
  safeDiv,
  round2,
  round4,
  seriesDelta,
  groupBy,
  bump,
  sumBy,
  fmtMoney,
} from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const f = await parseFilters(req);

  const [paidRows, funnelRows, relRows, targetRows, reconRows, coverageRows, dmRows, campaigns] =
    await Promise.all([
      db.paidMediaDaily.selectRows({
        where: paidMediaWhere(f),
        select: {
          campaignKey: true,
          reportDate: true,
          platform: true,
          spendUsd: true,
          impressions: true,
          linkClicks: true,
          reportedResponseSubmissions: true,
        },
      }),
      db.submissionFunnelMart.selectRows({
        where: funnelWhere(f),
        select: {
          campaignKey: true,
          submissionMonth: true,
          platform: true,
          submissions: true,
          submissionsWithLeads: true,
          submissionsWithApplications: true,
          submissionsWithFundedAccounts: true,
        },
      }),
      db.relationshipValueMonthly.selectRows({
        where: relWhere(f),
        select: { campaignKey: true, valueMonth: true, netRelationshipContributionUsd: true },
      }),
      db.salesTargetAttainmentMonthly.selectRows({
        where: targetWhere(f),
        select: { targetFundedAccounts: true, fundedAccounts: true },
      }),
      db.financeReconciliationMonthly.selectRows({
        where: reconWhere(f),
        select: { reconciliationStatus: true, financeLinks: true, invoiceMinusGlUsd: true },
      }),
      db.campaignAttributionCoverage.selectRows({
        where: coverageWhere(f),
        select: { campaignResolutionStatus: true, sourceRowCount: true },
      }),
      db.directMailPerformanceMonthly.selectRows({
        where: dmWhere(f),
        select: { postageUsd: true },
      }),
      db.campaign.selectRows({ select: { campaignKey: true, campaignTitle: true } }),
    ]);

  const groups = await campaignChannelGroups();
  const campaignTitle = new Map(campaigns.map((c) => [c.campaignKey, c.campaignTitle]));

  // ---------- KPIs ----------
  const spend = sumBy(paidRows, (r) => r.spendUsd);
  const impressions = sumBy(paidRows, (r) => r.impressions);
  const clicks = sumBy(paidRows, (r) => r.linkClicks);
  const submissions = sumBy(funnelRows, (r) => r.submissions);
  const leads = sumBy(funnelRows, (r) => r.submissionsWithLeads);
  const applications = sumBy(funnelRows, (r) => r.submissionsWithApplications);
  const fundedAccounts = sumBy(funnelRows, (r) => r.submissionsWithFundedAccounts);
  const contribution = sumBy(relRows, (r) => r.netRelationshipContributionUsd);
  const cac = safeDiv(spend, fundedAccounts);
  const roi = safeDiv(contribution - spend, spend);

  // ---------- monthly series ----------
  const spendM = new Map<string, number>();
  for (const r of paidRows) bump(spendM, monthKey(r.reportDate), r.spendUsd);
  const leadsM = new Map<string, number>();
  const appsM = new Map<string, number>();
  const fundedM = new Map<string, number>();
  for (const r of funnelRows) {
    const k = monthKey(r.submissionMonth);
    bump(leadsM, k, r.submissionsWithLeads);
    bump(appsM, k, r.submissionsWithApplications);
    bump(fundedM, k, r.submissionsWithFundedAccounts);
  }
  const contribM = new Map<string, number>();
  for (const r of relRows) bump(contribM, monthKey(r.valueMonth), r.netRelationshipContributionUsd);

  const axis = monthAxis(f.from, f.to, [
    ...paidRows.map((r) => r.reportDate),
    ...funnelRows.map((r) => r.submissionMonth),
    ...relRows.map((r) => r.valueMonth),
  ]);
  const monthly = axis.map((m) => {
    const k = monthKey(m);
    return {
      month: k,
      spend: round2(spendM.get(k) ?? 0),
      leads: leadsM.get(k) ?? 0,
      applications: appsM.get(k) ?? 0,
      fundedAccounts: fundedM.get(k) ?? 0,
      contribution: round2(contribM.get(k) ?? 0),
    };
  });

  // ---------- deltas: last month present vs previous ----------
  const cacM = new Map<string, number>();
  for (const k of new Set([...spendM.keys(), ...fundedM.keys()])) {
    cacM.set(k, safeDiv(spendM.get(k) ?? 0, fundedM.get(k) ?? 0));
  }
  const deltas = {
    spend: seriesDelta(spendM),
    leads: seriesDelta(leadsM),
    fundedAccounts: seriesDelta(fundedM),
    cac: seriesDelta(cacM),
    contribution: seriesDelta(contribM),
  };

  // ---------- channel mix ----------
  // Paid spend via campaign -> channel group; Direct Mail postage added
  // separately (its spend never flows through the paid media mart).
  const spendByChannel = new Map<string, number>();
  for (const r of paidRows) {
    bump(spendByChannel, groups.get(r.campaignKey) ?? "Paid Digital", r.spendUsd);
  }
  bump(spendByChannel, "Direct Mail", sumBy(dmRows, (r) => r.postageUsd));
  const fundedByChannel = new Map<string, number>();
  for (const r of funnelRows) {
    if (r.campaignKey === "UNATTRIBUTED") continue;
    bump(fundedByChannel, groups.get(r.campaignKey) ?? "Paid Digital", r.submissionsWithFundedAccounts);
  }
  const channelMix = Array.from(
    new Set([...spendByChannel.keys(), ...fundedByChannel.keys()])
  )
    .map((channel) => {
      const chSpend = spendByChannel.get(channel) ?? 0;
      const chFunded = fundedByChannel.get(channel) ?? 0;
      return {
        channel,
        spend: round2(chSpend),
        fundedAccounts: chFunded,
        cac: round2(safeDiv(chSpend, chFunded)),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // ---------- funnel (paid delivery + submission chain) ----------
  const stageData: { stage: string; value: number }[] = [
    { stage: "Impressions", value: impressions },
    { stage: "Clicks", value: clicks },
    { stage: "Submissions", value: submissions },
    { stage: "Leads", value: leads },
    { stage: "Applications", value: applications },
    { stage: "Funded accounts", value: fundedAccounts },
  ];
  const funnel = stageData.map((s, i) => ({
    stage: s.stage,
    value: s.value,
    rate: i === 0 ? 1 : round4(safeDiv(s.value, stageData[i - 1].value)),
  }));

  // ---------- platform table ----------
  const paidByPlatform = groupBy(paidRows, (r) => r.platform);
  const fundedByPlatform = new Map<string, number>();
  for (const r of funnelRows) bump(fundedByPlatform, r.platform, r.submissionsWithFundedAccounts);
  const platformTable = Array.from(paidByPlatform.entries())
    .map(([platform, rows]) => {
      const pSpend = sumBy(rows, (r) => r.spendUsd);
      const pImpr = sumBy(rows, (r) => r.impressions);
      const pClicks = sumBy(rows, (r) => r.linkClicks);
      const pFunded = fundedByPlatform.get(platform) ?? 0;
      return {
        platform,
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

  // ---------- top campaigns ----------
  const spendByCmp = new Map<string, number>();
  for (const r of paidRows) bump(spendByCmp, r.campaignKey, r.spendUsd);
  const fundedByCmp = new Map<string, number>();
  for (const r of funnelRows) {
    if (r.campaignKey === "UNATTRIBUTED") continue;
    bump(fundedByCmp, r.campaignKey, r.submissionsWithFundedAccounts);
  }
  const contribByCmp = new Map<string, number>();
  for (const r of relRows) bump(contribByCmp, r.campaignKey, r.netRelationshipContributionUsd);

  const campaignStats = Array.from(
    new Set([...spendByCmp.keys(), ...fundedByCmp.keys(), ...contribByCmp.keys()])
  ).map((k) => {
    const cSpend = spendByCmp.get(k) ?? 0;
    const cFunded = fundedByCmp.get(k) ?? 0;
    const cContrib = contribByCmp.get(k) ?? 0;
    return {
      campaignKey: k,
      campaignTitle: campaignTitle.get(k) ?? k,
      channelGroup: groups.get(k) ?? "Paid Digital",
      spend: round2(cSpend),
      fundedAccounts: cFunded,
      cac: round2(safeDiv(cSpend, cFunded)),
      contribution: round2(cContrib),
      roi: round4(safeDiv(cContrib - cSpend, cSpend)),
    };
  });
  const topCampaigns = campaignStats
    .filter((c) => c.spend > 0 || c.fundedAccounts > 0)
    .sort((a, b) => b.fundedAccounts - a.fundedAccounts || b.spend - a.spend)
    .slice(0, 8);

  // ---------- attainment ----------
  const targetFunded = sumBy(targetRows, (r) => r.targetFundedAccounts);
  const actualFunded = sumBy(targetRows, (r) => r.fundedAccounts);
  const attainment = {
    targetFunded,
    actualFunded,
    pct: round4(safeDiv(actualFunded, targetFunded)),
  };

  // ---------- data quality ----------
  const resolvedRowCount = sumBy(
    coverageRows.filter((r) => r.campaignResolutionStatus === "Resolved"),
    (r) => r.sourceRowCount
  );
  const totalRowCount = sumBy(coverageRows, (r) => r.sourceRowCount);
  const pendingLinks = totalRowCount - resolvedRowCount;
  const resolvedPct = safeDiv(resolvedRowCount, totalRowCount);
  const financeLinksTotal = sumBy(reconRows, (r) => r.financeLinks);
  const financeLinksMatched = sumBy(
    reconRows.filter((r) => r.reconciliationStatus === "Matched"),
    (r) => r.financeLinks
  );
  const openVarianceUsd = sumBy(
    reconRows.filter((r) => r.reconciliationStatus !== "Matched"),
    (r) => Math.abs(r.invoiceMinusGlUsd)
  );
  const reconciliationRate = safeDiv(financeLinksMatched, financeLinksTotal);
  const dataQuality = {
    resolvedPct: round4(resolvedPct),
    pendingLinks,
    reconciliationRate: round4(reconciliationRate),
    openVarianceUsd: round2(openVarianceUsd),
  };

  // ---------- insights (computed, never hardcoded) ----------
  const insights: string[] = [];
  const qualifiedPlatforms = platformTable.filter((p) => p.fundedAccounts >= 20);
  if (qualifiedPlatforms.length > 0) {
    const best = qualifiedPlatforms.reduce((a, b) => (b.cac < a.cac ? b : a));
    insights.push(
      `${best.platform} delivered the lowest CPA at $${fmtMoney(best.cac)} among platforms with 20+ funded accounts`
    );
  }
  if (topCampaigns.length > 0) {
    insights.push(
      `Campaign '${topCampaigns[0].campaignTitle}' is the top funded-account driver with ${topCampaigns[0].fundedAccounts} accounts`
    );
  }
  if (targetFunded > 0) {
    insights.push(
      `Target attainment is ${(attainment.pct * 100).toFixed(1)}% — ${Math.max(
        0,
        targetFunded - actualFunded
      )} account gap remains`
    );
  }
  if (reconRows.length > 0) {
    insights.push(
      `Invoice-to-GL reconciliation is ${(reconciliationRate * 100).toFixed(1)}% matched with $${fmtMoney(
        openVarianceUsd
      )} open variance`
    );
  }
  insights.push(
    `Campaign resolution coverage is ${(resolvedPct * 100).toFixed(1)}%; ${pendingLinks} unresolved source links remain`
  );
  const bestRoi = campaignStats
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.roi - a.roi)[0];
  if (bestRoi && bestRoi.roi > 0) {
    insights.push(`Best observed ROI campaign: ${bestRoi.campaignTitle} at ${bestRoi.roi.toFixed(2)}x`);
  }

  const res: OverviewResponse = {
    kpis: {
      spend: round2(spend),
      impressions,
      clicks,
      submissions,
      leads,
      applications,
      fundedAccounts,
      cac: round2(cac),
      contribution: round2(contribution),
      roi: round4(roi),
      ctr: round4(safeDiv(clicks, impressions)),
      cpc: round2(safeDiv(spend, clicks)),
    },
    deltas,
    monthly,
    channelMix,
    funnel,
    platformTable,
    topCampaigns,
    attainment,
    dataQuality,
    insights,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
