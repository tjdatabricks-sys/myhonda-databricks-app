import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/finance — invoice vs GL reconciliation, vendor media
// lines and vendor-vs-model spend variance by campaign.
// (FinanceResponse contract; see src/lib/api-types.ts)
// Sources: mart_demo_finance_reconciliation_monthly,
// mart_vendor_media_daily, mart_demo_paid_media_daily, dim_campaign.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { FinanceResponse } from "@/lib/api-types";
import { parseFilters, paidMediaWhere, reconWhere, vendorWhere } from "@/lib/server/filters";
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

  const [reconRows, vendorRows, paidRows, campaigns] = await Promise.all([
    db.financeReconciliationMonthly.selectRows({
      where: reconWhere(f),
      select: {
        spendMonth: true,
        reconciliationStatus: true,
        financeLinks: true,
        invoiceNetUsd: true,
        glNetUsd: true,
        invoiceMinusGlUsd: true,
      },
    }),
    db.vendorMediaDaily.selectRows({
      where: vendorWhere(f),
      select: {
        resolvedCampaignKey: true,
        sourceTable: true,
        platform: true,
        reportDate: true,
        reportEndDate: true,
        campaignResolutionStatus: true,
        sourceRowCount: true,
        reportedImpressions: true,
        reportedClicks: true,
        spendAmount: true,
        costPerReportedClick: true,
        campaignName: true,
      },
      orderBy: [{ reportDate: "desc" }, { sourceTable: "asc" }, { sourceCampaignId: "asc" }],
    }),
    db.paidMediaDaily.selectRows({
      where: paidMediaWhere(f),
      select: { campaignKey: true, reportDate: true, spendUsd: true },
    }),
    db.campaign.selectRows({ select: { campaignKey: true, campaignTitle: true } }),
  ]);

  const campaignTitle = new Map(campaigns.map((c) => [c.campaignKey, c.campaignTitle]));

  // ---------- KPIs ----------
  const platformSpend = sumBy(paidRows, (r) => r.spendUsd);
  const invoiced = sumBy(reconRows, (r) => r.invoiceNetUsd);
  const glPosted = sumBy(reconRows, (r) => r.glNetUsd);
  const invoiceGlVariance = invoiced - glPosted;
  const matchedLinks = sumBy(
    reconRows.filter((r) => r.reconciliationStatus === "Matched"),
    (r) => r.financeLinks
  );
  const totalLinks = sumBy(reconRows, (r) => r.financeLinks);
  const reconciliationRate = safeDiv(matchedLinks, totalLinks);
  const openVarianceUsd = sumBy(
    reconRows.filter((r) => r.reconciliationStatus !== "Matched"),
    (r) => Math.abs(r.invoiceMinusGlUsd)
  );
  const pendingLinks = sumBy(
    reconRows.filter((r) => r.reconciliationStatus === "Pending Review"),
    (r) => r.financeLinks
  );

  // ---------- monthly (modeled platform spend vs invoice/GL) ----------
  const paidByMonth = new Map<string, number>();
  for (const r of paidRows) bump(paidByMonth, monthKey(r.reportDate), r.spendUsd);
  const reconByMonth = groupBy(reconRows, (r) => monthKey(r.spendMonth));
  const axis = monthAxis(
    f.from,
    f.to,
    [...reconRows.map((r) => r.spendMonth), ...paidRows.map((r) => r.reportDate)]
  );
  const monthly = axis.map((m) => {
    const k = monthKey(m);
    const rows = reconByMonth.get(k) ?? [];
    return {
      month: k,
      platformSpend: round2(paidByMonth.get(k) ?? 0),
      invoiceNet: round2(sumBy(rows, (r) => r.invoiceNetUsd)),
      glNet: round2(sumBy(rows, (r) => r.glNetUsd)),
      variance: round2(sumBy(rows, (r) => r.invoiceMinusGlUsd)),
    };
  });

  // ---------- statusMix ----------
  const reconByStatus = groupBy(reconRows, (r) => r.reconciliationStatus);
  const statusMix = Array.from(reconByStatus.entries())
    .map(([status, rows]) => ({
      status,
      links: sumBy(rows, (r) => r.financeLinks),
      invoiceNet: round2(sumBy(rows, (r) => r.invoiceNetUsd)),
      glNet: round2(sumBy(rows, (r) => r.glNetUsd)),
    }))
    .sort((a, b) => b.invoiceNet - a.invoiceNet);

  // ---------- vendorLines (latest vendor-reported media lines) ----------
  const vendorLines: FinanceResponse["vendorLines"] = vendorRows.slice(0, 40).map((r) => ({
    sourceTable: r.sourceTable,
    platform: r.platform,
    period: `${dateKey(r.reportDate)} → ${dateKey(r.reportEndDate)}`,
    campaignTitle: r.campaignName,
    spend: round2(r.spendAmount),
    impressions: r.reportedImpressions,
    clicks: r.reportedClicks,
    cpc: round2(r.costPerReportedClick),
    status: r.campaignResolutionStatus,
  }));

  // ---------- glMonthly ----------
  const glMonthly = Array.from(reconByMonth.entries())
    .map(([month, rows]) => ({
      month,
      glNet: round2(sumBy(rows, (r) => r.glNetUsd)),
      invoiceNet: round2(sumBy(rows, (r) => r.invoiceNetUsd)),
      variance: round2(sumBy(rows, (r) => r.invoiceMinusGlUsd)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ---------- varianceByCampaign (vendor invoiced vs modeled spend) ----------
  const modelSpendByCampaign = new Map<string, number>();
  for (const r of paidRows) bump(modelSpendByCampaign, r.campaignKey, r.spendUsd);
  const vendorSpendByCampaign = new Map<string, number>();
  const vendorNameByCampaign = new Map<string, string>();
  for (const r of vendorRows) {
    if (!r.resolvedCampaignKey) continue;
    bump(vendorSpendByCampaign, r.resolvedCampaignKey, r.spendAmount);
    if (!vendorNameByCampaign.has(r.resolvedCampaignKey)) {
      vendorNameByCampaign.set(r.resolvedCampaignKey, r.campaignName);
    }
  }
  const varianceByCampaign = Array.from(
    new Set([...modelSpendByCampaign.keys(), ...vendorSpendByCampaign.keys()])
  )
    .map((key) => {
      const model = modelSpendByCampaign.get(key) ?? 0;
      const vendor = vendorSpendByCampaign.get(key) ?? 0;
      const variance = vendor - model;
      return {
        campaignKey: key,
        campaignTitle: campaignTitle.get(key) ?? vendorNameByCampaign.get(key) ?? key,
        platformSpend: round2(model),
        invoiced: round2(vendor),
        variance: round2(variance),
        variancePct: round4(safeDiv(variance, model)),
      };
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 20);

  // ---------- sourceMix ----------
  const vendorBySource = groupBy(vendorRows, (r) => r.sourceTable);
  const sourceMix = Array.from(vendorBySource.entries())
    .map(([sourceTable, rows]) => ({
      sourceTable,
      spend: round2(sumBy(rows, (r) => r.spendAmount)),
      rows: sumBy(rows, (r) => r.sourceRowCount),
    }))
    .sort((a, b) => b.spend - a.spend);

  const res: FinanceResponse = {
    kpis: {
      platformSpend: round2(platformSpend),
      invoiced: round2(invoiced),
      glPosted: round2(glPosted),
      invoiceGlVariance: round2(invoiceGlVariance),
      reconciliationRate: round4(reconciliationRate),
      openVarianceUsd: round2(openVarianceUsd),
      pendingLinks,
    },
    monthly,
    statusMix,
    vendorLines,
    glMonthly,
    varianceByCampaign,
    sourceMix,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
