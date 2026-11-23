import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/funnel — submission-to-funded conversion funnel:
// stages, monthly trend, per-campaign conversion table and
// duplicate / CRM-match quality. (FunnelResponse contract)
//
// Source: mart_demo_submission_funnel (campaignKey, submissionMonth,
// platform, format grain; includes UNATTRIBUTED sentinel rows —
// kept for totals, excluded from the per-campaign table).
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { FunnelResponse } from "@/lib/api-types";
import { parseFilters, funnelWhere, paidMediaWhere } from "@/lib/server/filters";
import {
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

  const [martRows, paidRows] = await Promise.all([
    db.submissionFunnelMart.selectRows({
      where: funnelWhere(f),
      select: {
        campaignKey: true,
        campaignName: true,
        submissionMonth: true,
        platform: true,
        submissions: true,
        duplicateSubmissions: true,
        eligibleSubmissions: true,
        submissionsWithoutCrmMatch: true,
        submissionsWithLeads: true,
        submissionsWithQualifiedLeads: true,
        submissionsWithApplications: true,
        submissionsWithApprovedApplications: true,
        submissionsWithOpenedAccounts: true,
        submissionsWithFundedAccounts: true,
      },
    }),
    db.paidMediaDaily.selectRows({
      where: paidMediaWhere(f),
      select: { campaignKey: true, spendUsd: true },
    }),
  ]);

  const spendByCmp = new Map<string, number>();
  for (const r of paidRows) bump(spendByCmp, r.campaignKey, r.spendUsd);

  // ---------- stages ----------
  const stageData: { stage: string; value: number }[] = [
    { stage: "Submissions", value: sumBy(martRows, (r) => r.submissions) },
    { stage: "Leads", value: sumBy(martRows, (r) => r.submissionsWithLeads) },
    { stage: "Qualified leads", value: sumBy(martRows, (r) => r.submissionsWithQualifiedLeads) },
    { stage: "Applications", value: sumBy(martRows, (r) => r.submissionsWithApplications) },
    { stage: "Approved", value: sumBy(martRows, (r) => r.submissionsWithApprovedApplications) },
    { stage: "Opened accounts", value: sumBy(martRows, (r) => r.submissionsWithOpenedAccounts) },
    { stage: "Funded accounts", value: sumBy(martRows, (r) => r.submissionsWithFundedAccounts) },
  ];
  const stages = stageData.map((s, i) => ({
    stage: s.stage,
    value: s.value,
    rate: i === 0 ? 1 : round4(safeDiv(s.value, stageData[i - 1].value)),
  }));

  // ---------- monthly (complete month axis) ----------
  const byMonth = groupBy(martRows, (r) => monthKey(r.submissionMonth));
  const axis = monthAxis(f.from, f.to, martRows.map((r) => r.submissionMonth));
  const monthly = axis.map((m) => {
    const k = monthKey(m);
    const rows = byMonth.get(k) ?? [];
    return {
      month: k,
      submissions: sumBy(rows, (r) => r.submissions),
      leads: sumBy(rows, (r) => r.submissionsWithLeads),
      qualified: sumBy(rows, (r) => r.submissionsWithQualifiedLeads),
      applications: sumBy(rows, (r) => r.submissionsWithApplications),
      approved: sumBy(rows, (r) => r.submissionsWithApprovedApplications),
      opened: sumBy(rows, (r) => r.submissionsWithOpenedAccounts),
      funded: sumBy(rows, (r) => r.submissionsWithFundedAccounts),
    };
  });

  // ---------- by campaign (sentinel UNATTRIBUTED rows excluded) ----------
  const byCmp = groupBy(
    martRows.filter((r) => r.campaignKey !== "UNATTRIBUTED"),
    (r) => r.campaignKey
  );
  const byCampaign = Array.from(byCmp.entries())
    .map(([key, rows]) => {
      const platforms = new Set(rows.map((r) => r.platform));
      let platform = "Multi";
      if (platforms.size === 1) platform = platforms.values().next().value ?? "Multi";
      const submissions = sumBy(rows, (r) => r.submissions);
      const leads = sumBy(rows, (r) => r.submissionsWithLeads);
      const applications = sumBy(rows, (r) => r.submissionsWithApplications);
      const funded = sumBy(rows, (r) => r.submissionsWithFundedAccounts);
      const spend = spendByCmp.get(key) ?? 0;
      return {
        campaignKey: key,
        campaignTitle: rows[0].campaignName ?? key,
        platform,
        submissions,
        leads,
        applications,
        funded,
        leadRate: round4(safeDiv(leads, submissions)),
        appRate: round4(safeDiv(applications, leads)),
        fundedRate: round4(safeDiv(funded, applications)),
        spend: round2(spend),
        cac: round2(safeDiv(spend, funded)),
      };
    })
    .sort((a, b) => b.submissions - a.submissions);

  // ---------- duplicates / CRM match ----------
  const totalSubs = sumBy(martRows, (r) => r.submissions);
  const eligible = sumBy(martRows, (r) => r.eligibleSubmissions);
  const withoutCrm = sumBy(martRows, (r) => r.submissionsWithoutCrmMatch);
  const duplicates: FunnelResponse["duplicates"] = {
    submissions: totalSubs,
    duplicates: sumBy(martRows, (r) => r.duplicateSubmissions),
    eligible,
    withoutCrm,
    matchRate: round4(1 - safeDiv(withoutCrm, eligible)),
  };

  const res: FunnelResponse = { stages, monthly, byCampaign, duplicates };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
