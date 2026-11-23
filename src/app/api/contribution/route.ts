import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/contribution — Relationship value & marketing ROI
// (ContributionResponse contract; see src/lib/api-types.ts)
// Sources (gold_business): mart_demo_relationship_value_monthly,
// mart_demo_paid_media_daily, mart_new_funded_customers_monthly,
// dim_product, dim_market.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ContributionResponse } from "@/lib/api-types";
import { parseFilters, relWhere, paidMediaWhere, newFundedWhere } from "@/lib/server/filters";
import { monthKey, safeDiv, round2, round4, groupBy, bump, sumBy } from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const f = await parseFilters(req);

  const [relRows, paidRows, nfRows, products, markets] = await Promise.all([
    db.relationshipValueMonthly.selectRows({
      where: relWhere(f),
      select: {
        campaignKey: true,
        valueMonth: true,
        productId: true,
        marketId: true,
        observedAccounts: true,
        netInterestIncomeUsd: true,
        netRelationshipContributionUsd: true,
        campaignName: true,
      },
    }),
    db.paidMediaDaily.selectRows({
      where: paidMediaWhere(f),
      select: { campaignKey: true, reportDate: true, spendUsd: true },
    }),
    db.newFundedCustomersMonthly.selectRows({
      where: newFundedWhere(f),
      select: { productId: true, marketId: true, newFundedCustomers: true },
    }),
    db.product.selectRows({ select: { productId: true, productName: true } }),
    db.market.selectRows({ select: { marketId: true, marketDisplayName: true } }),
  ]);

  const productName = new Map(products.map((p) => [p.productId, p.productName]));
  const marketName = new Map(markets.map((m) => [m.marketId, m.marketDisplayName]));

  // ---------- KPIs ----------
  const netContribution = sumBy(relRows, (r) => r.netRelationshipContributionUsd);
  const interestIncome = sumBy(relRows, (r) => r.netInterestIncomeUsd);
  const spend = sumBy(paidRows, (r) => r.spendUsd);
  const monthsCount = new Set(relRows.map((r) => monthKey(r.valueMonth))).size;

  // Customers: per campaign, observed accounts at the campaign's
  // latest valueMonth (one row per campaign-month in this mart).
  const lastMonthByCampaign = new Map<string, number>();
  for (const r of relRows) {
    const cur = lastMonthByCampaign.get(r.campaignKey);
    if (cur === undefined || r.valueMonth.getTime() > cur) {
      lastMonthByCampaign.set(r.campaignKey, r.valueMonth.getTime());
    }
  }
  const customers = sumBy(
    relRows.filter((r) => lastMonthByCampaign.get(r.campaignKey) === r.valueMonth.getTime()),
    (r) => r.observedAccounts
  );

  const monthlyRate = safeDiv(netContribution, monthsCount);
  const kpis: ContributionResponse["kpis"] = {
    netContribution: round2(netContribution),
    perCustomer: round2(safeDiv(netContribution, customers)),
    interestIncome: round2(interestIncome),
    otherIncome: round2(netContribution - interestIncome),
    roi: round4(safeDiv(netContribution - spend, spend)),
    estimated36m: round2(safeDiv(netContribution * 36, monthsCount)),
    paybackMonths: round2(safeDiv(spend, monthlyRate)),
  };

  // ---------- monthly (interest / other / net) ----------
  const monthly = Array.from(groupBy(relRows, (r) => monthKey(r.valueMonth)).entries())
    .map(([month, rows]) => {
      const interest = sumBy(rows, (r) => r.netInterestIncomeUsd);
      const net = sumBy(rows, (r) => r.netRelationshipContributionUsd);
      return {
        month,
        interest: round2(interest),
        other: round2(net - interest),
        net: round2(net),
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  // ---------- by product ----------
  const nfByProduct = new Map<string, number>();
  for (const r of nfRows) bump(nfByProduct, r.productId, r.newFundedCustomers);
  const byProduct = Array.from(groupBy(relRows, (r) => r.productId).entries())
    .map(([productId, rows]) => {
      const contribution = sumBy(rows, (r) => r.netRelationshipContributionUsd);
      const observed = sumBy(rows, (r) => r.observedAccounts);
      return {
        productId,
        product: productName.get(productId) ?? productId,
        customers: nfByProduct.get(productId) ?? 0,
        monthlyPerCustomer: round2(safeDiv(contribution, observed)),
        contribution: round2(contribution),
      };
    })
    .sort((a, b) => b.contribution - a.contribution);

  // ---------- by market ----------
  const nfByMarket = new Map<string, number>();
  for (const r of nfRows) bump(nfByMarket, r.marketId, r.newFundedCustomers);
  const byMarket = Array.from(groupBy(relRows, (r) => r.marketId).entries())
    .map(([marketId, rows]) => ({
      marketId,
      market: marketName.get(marketId) ?? marketId,
      contribution: round2(sumBy(rows, (r) => r.netRelationshipContributionUsd)),
      customers: nfByMarket.get(marketId) ?? 0,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  // ---------- by campaign + scatter ----------
  const spendByCampaign = new Map<string, number>();
  for (const r of paidRows) bump(spendByCampaign, r.campaignKey, r.spendUsd);
  const byCampaign = Array.from(groupBy(relRows, (r) => r.campaignKey).entries())
    .map(([campaignKey, rows]) => {
      const contribution = sumBy(rows, (r) => r.netRelationshipContributionUsd);
      const campaignSpend = spendByCampaign.get(campaignKey) ?? 0;
      const campaignMonths = new Set(rows.map((r) => monthKey(r.valueMonth))).size;
      return {
        campaignKey,
        campaignTitle: rows[0].campaignName,
        spend: round2(campaignSpend),
        contribution: round2(contribution),
        roi: round4(safeDiv(contribution - campaignSpend, campaignSpend)),
        estimated36m: round2(safeDiv(contribution * 36, campaignMonths)),
      };
    })
    .sort((a, b) => b.contribution - a.contribution);

  const scatter = byCampaign.map((c) => ({
    campaignKey: c.campaignKey,
    campaignTitle: c.campaignTitle,
    spend: c.spend,
    contribution: c.contribution,
    roi: c.roi,
  }));

  // ---------- cohort (cumulative spend vs contribution by month) ----------
  const spendByMonth = new Map<string, number>();
  for (const r of paidRows) bump(spendByMonth, monthKey(r.reportDate), r.spendUsd);
  const contribByMonth = new Map<string, number>();
  for (const r of relRows) bump(contribByMonth, monthKey(r.valueMonth), r.netRelationshipContributionUsd);
  const cohortMonths = Array.from(new Set(relRows.map((r) => monthKey(r.valueMonth)))).sort();
  let cumSpend = 0;
  let cumContribution = 0;
  const cohort = cohortMonths.map((cohortMonth, i) => {
    cumSpend += spendByMonth.get(cohortMonth) ?? 0;
    cumContribution += contribByMonth.get(cohortMonth) ?? 0;
    return {
      cohortMonth,
      cumulativeSpend: round2(cumSpend),
      cumulativeContribution: round2(cumContribution),
      estimated36m: round2(safeDiv(cumContribution * 36, i + 1)),
    };
  });

  const res: ContributionResponse = {
    kpis,
    monthly,
    byProduct,
    byMarket,
    byCampaign,
    scatter,
    cohort,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
