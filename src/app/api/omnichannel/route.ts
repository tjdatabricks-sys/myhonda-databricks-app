import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/omnichannel — Direct Mail / Offline / Branch / Vendor
// (OmnichannelResponse contract; see src/lib/api-types.ts)
// Sources (gold_business): mart_direct_mail_performance_monthly,
// mart_offline_activity_monthly (EAV), mart_demo_paid_media_daily,
// mart_demo_submission_funnel, mart_demo_relationship_value_monthly,
// dim_branch, dim_vendor_campaign, dim_campaign +
// campaignChannelGroups() for the channel comparison.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { OmnichannelResponse } from "@/lib/api-types";
import {
  parseFilters,
  dmWhere,
  offlineWhere,
  paidMediaWhere,
  funnelWhere,
  relWhere,
  campaignChannelGroups,
} from "@/lib/server/filters";
import { monthKey, safeDiv, round2, round4, groupBy, bump, sumBy } from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

/** channel|metric pairs surfaced in channelActivity. */
const ACTIVITY_PAIRS = new Set([
  "Billboard|impressions",
  "DOOH|plays",
  "Broadcast TV|spots_aired",
  "Broadcast TV|estimated_reach",
  "Call Center|calls",
  "Branch Event|attendees",
  "Referral|referrals_completed",
]);

interface OfflineRow {
  observationMonth: Date;
  sourceChannel: string;
  resolvedCampaignKey: string | null;
  metric: string;
  metricValue: number;
}

/** Sum metricValue for one offline (sourceChannel, metric) pair. */
function offlineSum(rows: OfflineRow[], channel: string, metric: string): number {
  return sumBy(
    rows.filter((r) => r.sourceChannel === channel && r.metric === metric),
    (r) => r.metricValue
  );
}

async function handleGet(req: Request) {
  const f = await parseFilters(req);

  const [dmRows, offlineRows, branches, vendors, paidRows, funnelRows, relRows, campaigns, groups] =
    await Promise.all([
      db.directMailPerformanceMonthly.selectRows({
        where: dmWhere(f),
        select: {
          mailMonth: true,
          resolvedCampaignKey: true,
          mailJobs: true,
          deliveredJobs: true,
          deliveredJobsWithResponse: true,
          deliveredJobsWithQrScan: true,
          linkedResponseEvents: true,
          postageUsd: true,
        },
      }),
      db.offlineActivityMonthly.selectRows({
        where: offlineWhere(f),
        select: {
          observationMonth: true,
          sourceChannel: true,
          resolvedCampaignKey: true,
          metric: true,
          metricValue: true,
        },
      }),
      db.branch.selectRows({
        select: {
          branchCode: true,
          branchName: true,
          marketName: true,
          branchType: true,
          openStatus: true,
        },
      }),
      db.vendorCampaign.selectRows({
        select: {
          sourceCampaignName: true,
          platform: true,
          mappingSourceSystem: true,
          campaignStatus: true,
          budgetAmount: true,
          flightStart: true,
          flightEnd: true,
        },
      }),
      db.paidMediaDaily.selectRows({
        where: paidMediaWhere(f),
        select: { campaignKey: true, spendUsd: true },
      }),
      db.submissionFunnelMart.selectRows({
        where: funnelWhere(f),
        select: { campaignKey: true, submissionsWithFundedAccounts: true },
      }),
      db.relationshipValueMonthly.selectRows({
        where: relWhere(f),
        select: { campaignKey: true, netRelationshipContributionUsd: true },
      }),
      db.campaign.selectRows({ select: { campaignKey: true, campaignTitle: true } }),
      campaignChannelGroups(),
    ]);

  const campaignTitle = new Map(campaigns.map((c) => [c.campaignKey, c.campaignTitle]));
  const channelOf = (key: string): string => groups.get(key) ?? "Other";

  // ---------- KPIs ----------
  const dmDelivered = sumBy(dmRows, (r) => r.deliveredJobs);
  const dmResponseJobs = sumBy(dmRows, (r) => r.deliveredJobsWithResponse);
  const dmQrJobs = sumBy(dmRows, (r) => r.deliveredJobsWithQrScan);
  const billboardImpressions = offlineSum(offlineRows, "Billboard", "impressions");
  const doohPlays = offlineSum(offlineRows, "DOOH", "plays");
  const tvSpots = offlineSum(offlineRows, "Broadcast TV", "spots_aired");
  const calls = offlineSum(offlineRows, "Call Center", "calls");
  const callsConnected = offlineSum(offlineRows, "Call Center", "calls_connected");
  const branchAttendees = offlineSum(offlineRows, "Branch Event", "attendees");
  const referralCompleted = offlineSum(offlineRows, "Referral", "referrals_completed");

  const kpis: OmnichannelResponse["kpis"] = {
    dmDelivered,
    dmResponseRate: round4(safeDiv(dmResponseJobs, dmDelivered)),
    qrScanRate: round4(safeDiv(dmQrJobs, dmDelivered)),
    billboardImpressions,
    doohPlays,
    tvSpots,
    calls,
    connectedRate: round4(safeDiv(callsConnected, calls)),
    branchAttendees,
    referralCompleted,
  };

  // ---------- direct mail ----------
  const directMailMonthly = Array.from(groupBy(dmRows, (r) => monthKey(r.mailMonth)).entries())
    .map(([month, rows]) => {
      const delivered = sumBy(rows, (r) => r.deliveredJobs);
      const responses = sumBy(rows, (r) => r.linkedResponseEvents);
      return {
        month,
        jobs: sumBy(rows, (r) => r.mailJobs),
        delivered,
        responses,
        qrScans: sumBy(rows, (r) => r.deliveredJobsWithQrScan),
        responseRate: round4(safeDiv(responses, delivered)),
        postage: round2(sumBy(rows, (r) => r.postageUsd)),
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const dmByCampaign = new Map<string, typeof dmRows>();
  for (const r of dmRows) {
    if (r.resolvedCampaignKey === null) continue;
    const list = dmByCampaign.get(r.resolvedCampaignKey);
    if (list) list.push(r);
    else dmByCampaign.set(r.resolvedCampaignKey, [r]);
  }
  const directMailCampaigns = Array.from(dmByCampaign.entries())
    .map(([campaignKey, rows]) => {
      const delivered = sumBy(rows, (r) => r.deliveredJobs);
      const responses = sumBy(rows, (r) => r.linkedResponseEvents);
      const cost = sumBy(rows, (r) => r.postageUsd);
      return {
        campaignKey,
        campaignTitle: campaignTitle.get(campaignKey) ?? campaignKey,
        jobs: sumBy(rows, (r) => r.mailJobs),
        delivered,
        responses,
        responseRate: round4(safeDiv(responses, delivered)),
        qrRate: round4(safeDiv(sumBy(rows, (r) => r.deliveredJobsWithQrScan), delivered)),
        cost: round2(cost),
        costPerResponse: round2(safeDiv(cost, responses)),
      };
    })
    .sort((a, b) => b.responses - a.responses);

  // ---------- offline channel activity ----------
  const activityRows = offlineRows.filter((r) =>
    ACTIVITY_PAIRS.has(`${r.sourceChannel}|${r.metric}`)
  );
  const channelActivity = Array.from(
    groupBy(activityRows, (r) => `${r.sourceChannel}|${r.metric}`).entries()
  )
    .map(([pairKey, rows]) => {
      const [channel, metric] = pairKey.split("|");
      const monthlyMap = new Map<string, number>();
      for (const r of rows) bump(monthlyMap, monthKey(r.observationMonth), r.metricValue);
      const monthly = Array.from(monthlyMap.entries())
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month));
      return { channel, metric, monthly };
    })
    .sort((a, b) => a.channel.localeCompare(b.channel) || a.metric.localeCompare(b.metric));

  // ---------- offline by campaign (top 12 by peak metric value) ----------
  const offByCampaignChannel = new Map<string, { campaignKey: string; channel: string; rows: OfflineRow[] }>();
  for (const r of offlineRows) {
    if (r.resolvedCampaignKey === null) continue;
    const key = `${r.resolvedCampaignKey}|${r.sourceChannel}`;
    const entry = offByCampaignChannel.get(key);
    if (entry) entry.rows.push(r);
    else offByCampaignChannel.set(key, { campaignKey: r.resolvedCampaignKey, channel: r.sourceChannel, rows: [r] });
  }
  const offlineByCampaign = Array.from(offByCampaignChannel.values())
    .map((entry) => {
      const metricMap = new Map<string, number>();
      for (const r of entry.rows) bump(metricMap, r.metric, r.metricValue);
      const metrics = Array.from(metricMap.entries())
        .map(([metric, value]) => ({ metric, value }))
        .sort((a, b) => a.metric.localeCompare(b.metric));
      const maxValue = metrics.reduce((m, x) => Math.max(m, x.value), 0);
      return {
        campaignKey: entry.campaignKey,
        campaignTitle: campaignTitle.get(entry.campaignKey) ?? entry.campaignKey,
        channel: entry.channel,
        metrics,
        maxValue,
      };
    })
    .sort((a, b) => b.maxValue - a.maxValue)
    .slice(0, 12)
    .map((entry) => ({
      campaignKey: entry.campaignKey,
      campaignTitle: entry.campaignTitle,
      channel: entry.channel,
      metrics: entry.metrics,
    }));

  // ---------- call center ----------
  const callRows = offlineRows.filter((r) => r.sourceChannel === "Call Center");
  const callsMonthly = Array.from(groupBy(callRows, (r) => monthKey(r.observationMonth)).entries())
    .map(([month, rows]) => ({
      month,
      calls: sumBy(rows.filter((r) => r.metric === "calls"), (r) => r.metricValue),
      connected: sumBy(rows.filter((r) => r.metric === "calls_connected"), (r) => r.metricValue),
      converted: sumBy(rows.filter((r) => r.metric === "calls_converted"), (r) => r.metricValue),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ---------- branch directory (no filters) ----------
  const branchDirectory = branches
    .map((b) => ({
      branchCode: b.branchCode,
      branchName: b.branchName,
      market: b.marketName,
      type: b.branchType,
      status: b.openStatus,
    }))
    .sort((a, b) => a.branchCode.localeCompare(b.branchCode));

  // ---------- vendor campaigns (top 30 by budget) ----------
  const vendorCampaigns = [...vendors]
    .sort((a, b) => b.budgetAmount - a.budgetAmount)
    .slice(0, 30)
    .map((v) => ({
      campaign: v.sourceCampaignName,
      platform: v.platform,
      vendorSystem: v.mappingSourceSystem,
      status: v.campaignStatus,
      budget: round2(v.budgetAmount),
      flight: `${monthKey(v.flightStart)} – ${monthKey(v.flightEnd)}`,
    }));

  // ---------- channel comparison ----------
  const spendByChannel = new Map<string, number>();
  for (const r of paidRows) bump(spendByChannel, channelOf(r.campaignKey), r.spendUsd);
  bump(spendByChannel, "Direct Mail", sumBy(dmRows, (r) => r.postageUsd));

  const fundedByChannel = new Map<string, number>();
  for (const r of funnelRows) {
    if (r.campaignKey === "UNATTRIBUTED") continue;
    bump(fundedByChannel, channelOf(r.campaignKey), r.submissionsWithFundedAccounts);
  }

  const contribByChannel = new Map<string, number>();
  for (const r of relRows) bump(contribByChannel, channelOf(r.campaignKey), r.netRelationshipContributionUsd);

  const channelCompare = Array.from(
    new Set([...spendByChannel.keys(), ...fundedByChannel.keys(), ...contribByChannel.keys()])
  )
    .map((channel) => {
      const spend = spendByChannel.get(channel) ?? 0;
      const fundedAccounts = fundedByChannel.get(channel) ?? 0;
      return {
        channel,
        spend: round2(spend),
        fundedAccounts,
        cac: round2(safeDiv(spend, fundedAccounts)),
        contribution: round2(contribByChannel.get(channel) ?? 0),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const res: OmnichannelResponse = {
    kpis,
    directMailMonthly,
    directMailCampaigns,
    channelActivity,
    offlineByCampaign,
    callsMonthly,
    branchDirectory,
    vendorCampaigns,
    channelCompare,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
