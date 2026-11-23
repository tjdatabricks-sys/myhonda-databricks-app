import { tableWhere } from "@/lib/server/filters";
import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/campaigns — dim_campaign roster enriched with paid,
// funnel and relationship-value metrics per campaign, monthly
// trend and channel summary. (CampaignsResponse contract)
//
// Row list filters: campaign + product. Market/platform/segment
// filters only affect metric aggregation (via the where builders).
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { CampaignsResponse } from "@/lib/api-types";
import {
  parseFilters,
  paidMediaWhere,
  funnelWhere,
  relWhere,
  campaignChannelGroups,
} from "@/lib/server/filters";
import {
  dateKey,
  monthKey,
  monthAxis,
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

  const campaignWhere = tableWhere("Campaign", f);

  const [campaigns, products, paidRows, funnelRows, relRows] = await Promise.all([
    db.campaign.selectRows({ where: campaignWhere, orderBy: { campaignKey: "asc" } }),
    db.product.selectRows({ select: { productId: true, productName: true } }),
    db.paidMediaDaily.selectRows({
      where: paidMediaWhere(f),
      select: {
        campaignKey: true,
        reportDate: true,
        spendUsd: true,
        impressions: true,
        linkClicks: true,
      },
    }),
    db.submissionFunnelMart.selectRows({
      where: funnelWhere(f),
      select: {
        campaignKey: true,
        submissionMonth: true,
        submissions: true,
        submissionsWithLeads: true,
        submissionsWithApplications: true,
        submissionsWithFundedAccounts: true,
      },
    }),
    db.relationshipValueMonthly.selectRows({
      // This report's product selection scopes the campaign roster as well as
      // contribution. Cross-sell rows from other campaign owners must not leak
      // into the monthly chart while being absent from the campaign table.
      where: { AND: [relWhere(f), ...(f.product ? [{ campaignKey: { in: f.productCampaigns ?? [] } }] : [])] },
      select: { campaignKey: true, valueMonth: true, netRelationshipContributionUsd: true },
    }),
  ]);

  const groups = await campaignChannelGroups();
  const productMap = new Map(products.map((p) => [p.productId, p.productName]));

  // ---------- per-campaign + monthly aggregates ----------
  const spendByCmp = new Map<string, number>();
  const spendM = new Map<string, number>();
  const imprByCmp = new Map<string, number>();
  const clicksByCmp = new Map<string, number>();
  for (const r of paidRows) {
    bump(spendByCmp, r.campaignKey, r.spendUsd);
    bump(spendM, monthKey(r.reportDate), r.spendUsd);
    bump(imprByCmp, r.campaignKey, r.impressions);
    bump(clicksByCmp, r.campaignKey, r.linkClicks);
  }
  const subsByCmp = new Map<string, number>();
  const leadsByCmp = new Map<string, number>();
  const appsByCmp = new Map<string, number>();
  const fundedByCmp = new Map<string, number>();
  const fundedM = new Map<string, number>();
  for (const r of funnelRows) {
    bump(fundedM, monthKey(r.submissionMonth), r.submissionsWithFundedAccounts);
    if (r.campaignKey === "UNATTRIBUTED") continue; // sentinel rows are not campaigns
    bump(subsByCmp, r.campaignKey, r.submissions);
    bump(leadsByCmp, r.campaignKey, r.submissionsWithLeads);
    bump(appsByCmp, r.campaignKey, r.submissionsWithApplications);
    bump(fundedByCmp, r.campaignKey, r.submissionsWithFundedAccounts);
  }
  const contribByCmp = new Map<string, number>();
  const contribM = new Map<string, number>();
  for (const r of relRows) {
    bump(contribByCmp, r.campaignKey, r.netRelationshipContributionUsd);
    bump(contribM, monthKey(r.valueMonth), r.netRelationshipContributionUsd);
  }

  const rows = campaigns.map((c) => {
    const spend = spendByCmp.get(c.campaignKey) ?? 0;
    const impressions = imprByCmp.get(c.campaignKey) ?? 0;
    const clicks = clicksByCmp.get(c.campaignKey) ?? 0;
    const funded = fundedByCmp.get(c.campaignKey) ?? 0;
    const contribution = contribByCmp.get(c.campaignKey) ?? 0;
    return {
      campaignKey: c.campaignKey,
      campaignTitle: c.campaignTitle,
      channelGroup: groups.get(c.campaignKey) ?? "Paid Digital",
      initiativeType: c.initiativeType,
      product: productMap.get(c.productId) ?? c.productId,
      status: c.approvalStatus,
      budget: round2(c.plannedBudgetNew),
      spend: round2(spend),
      budgetPct: round4(safeDiv(spend, c.plannedBudgetNew)),
      impressions,
      clicks,
      ctr: round4(safeDiv(clicks, impressions)),
      submissions: subsByCmp.get(c.campaignKey) ?? 0,
      leads: leadsByCmp.get(c.campaignKey) ?? 0,
      applications: appsByCmp.get(c.campaignKey) ?? 0,
      fundedAccounts: funded,
      cac: round2(safeDiv(spend, funded)),
      contribution: round2(contribution),
      roi: round4(safeDiv(contribution - spend, spend)),
      startDt: dateKey(c.startDt),
      endDt: dateKey(c.endDt),
    };
  });

  const scatter = rows
    .filter((r) => r.spend > 0)
    .map((r) => ({
      campaignKey: r.campaignKey,
      campaignTitle: r.campaignTitle,
      spend: r.spend,
      fundedAccounts: r.fundedAccounts,
      cac: r.cac,
      roi: r.roi,
    }));

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
      fundedAccounts: fundedM.get(k) ?? 0,
      contribution: round2(contribM.get(k) ?? 0),
    };
  });

  const byChannel = groupBy(rows, (r) => r.channelGroup);
  const channelSummary = Array.from(byChannel.entries())
    .map(([channel, list]) => {
      const spend = sumBy(list, (r) => r.spend);
      const funded = sumBy(list, (r) => r.fundedAccounts);
      const contribution = sumBy(list, (r) => r.contribution);
      return {
        channel,
        campaigns: list.length,
        spend: round2(spend),
        fundedAccounts: funded,
        cac: round2(safeDiv(spend, funded)),
        roi: round4(safeDiv(contribution - spend, spend)),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const res: CampaignsResponse = { rows, scatter, monthly, channelSummary };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
