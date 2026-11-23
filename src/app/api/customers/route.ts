import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/customers — Customer base & acquisition analytics
// (CustomersResponse contract; see src/lib/api-types.ts)
// Sources (gold_business): mart_new_funded_customers_monthly,
// dim_customer, dim_customer_segment, dim_market, dim_product,
// mart_demo_submission_funnel, mart_demo_paid_media_daily,
// mart_demo_relationship_value_monthly +
// campaignChannelGroups() for the channel rollup.
// ============================================================
import { NextResponse } from "next/server";
import type { Where, Comparison } from "@/lib/server/query";
import type { RowModels } from "@/lib/server/row-models";
import { db } from "@/lib/db";
import type { CustomersResponse } from "@/lib/api-types";
import {
  parseFilters,
  newFundedWhere,
  funnelWhere,
  paidMediaWhere,
  relWhere,
  campaignChannelGroups,
} from "@/lib/server/filters";
import { monthKey, safeDiv, round2, round4, groupBy, bump, sumBy } from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const f = await parseFilters(req);

  // dim_customer: segment + market filters apply; product filters do
  // not (customers are not product-scoped).
  const custWhere: Where<RowModels["Customer"]> = {};
  if (f.segment) custWhere.segmentId = f.segment;
  if (f.market) custWhere.marketId = f.market;

  const [nfRows, custRows, segDim, markets, products, funnelRows, paidRows, relRows, groups] =
    await Promise.all([
      db.newFundedCustomersMonthly.selectRows({
        where: newFundedWhere(f),
        select: {
          acquisitionMonth: true,
          productId: true,
          marketId: true,
          resolvedCampaignKey: true,
          newFundedCustomers: true,
        },
      }),
      db.customer.selectRows({
        where: custWhere,
        select: {
          segmentId: true,
          segment: true,
          marketId: true,
          regionId: true,
          relationshipTenureMonths: true,
          digitalBankingFlag: true,
          emailMarketingPermission: true,
        },
      }),
      db.customerSegment.selectRows(),
      db.market.selectRows({ select: { marketId: true, marketDisplayName: true } }),
      db.product.selectRows({ select: { productId: true, productName: true } }),
      db.submissionFunnelMart.selectRows({
        where: funnelWhere(f),
        select: {
          campaignKey: true,
          campaignName: true,
          submissionsWithLeads: true,
          submissionsWithFundedAccounts: true,
        },
      }),
      db.paidMediaDaily.selectRows({
        where: paidMediaWhere(f),
        select: { spendUsd: true },
      }),
      db.relationshipValueMonthly.selectRows({
        where: relWhere(f),
        select: { productId: true, netRelationshipContributionUsd: true },
      }),
      campaignChannelGroups(),
    ]);

  const segDimMap = new Map(segDim.map((s) => [s.segmentId, s]));
  const marketName = new Map(markets.map((m) => [m.marketId, m.marketDisplayName]));
  const productName = new Map(products.map((p) => [p.productId, p.productName]));
  const channelOf = (key: string): string => groups.get(key) ?? "Other";

  // ---------- KPIs ----------
  const newCustomers = sumBy(nfRows, (r) => r.newFundedCustomers);
  const funnelLeads = sumBy(funnelRows, (r) => r.submissionsWithLeads);
  const funnelFunded = sumBy(funnelRows, (r) => r.submissionsWithFundedAccounts);
  const paidSpend = sumBy(paidRows, (r) => r.spendUsd);
  const custCount = custRows.length;
  const tenureAvg = custCount
    ? sumBy(custRows, (r) => r.relationshipTenureMonths) / custCount
    : 0;
  const digitalCount = custRows.filter((r) => r.digitalBankingFlag).length;
  const optInCount = custRows.filter((r) => r.emailMarketingPermission).length;

  const kpis: CustomersResponse["kpis"] = {
    newCustomers,
    leadToCustomerRate: round4(safeDiv(funnelFunded, funnelLeads)),
    avgCac: round2(safeDiv(paidSpend, newCustomers)),
    avgTenureMonths: round2(tenureAvg),
    digitalShare: round4(safeDiv(digitalCount, custCount)),
    emailOptInRate: round4(safeDiv(optInCount, custCount)),
  };

  // ---------- monthly new funded customers ----------
  const monthly = Array.from(groupBy(nfRows, (r) => monthKey(r.acquisitionMonth)).entries())
    .map(([month, rows]) => ({
      month,
      newFundedCustomers: sumBy(rows, (r) => r.newFundedCustomers),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ---------- customer base by segment / market ----------
  const bySegment = Array.from(groupBy(custRows, (r) => r.segmentId).entries())
    .map(([segmentId, rows]) => ({
      segmentId,
      segment: rows[0].segment,
      segmentGroup: segDimMap.get(segmentId)?.segmentGroup ?? "",
      customers: rows.length,
      share: round4(safeDiv(rows.length, custCount)),
    }))
    .sort((a, b) => b.customers - a.customers);

  const byMarket = Array.from(groupBy(custRows, (r) => r.marketId).entries())
    .map(([marketId, rows]) => ({
      marketId,
      market: marketName.get(marketId) ?? marketId,
      customers: rows.length,
      region: rows[0].regionId,
    }))
    .sort((a, b) => b.customers - a.customers);

  // ---------- new funded by product / channel ----------
  const contribByProduct = new Map<string, number>();
  for (const r of relRows) bump(contribByProduct, r.productId, r.netRelationshipContributionUsd);
  const byProduct = Array.from(groupBy(nfRows, (r) => r.productId).entries())
    .map(([productId, rows]) => ({
      productId,
      product: productName.get(productId) ?? productId,
      customers: sumBy(rows, (r) => r.newFundedCustomers),
      contribution: round2(contribByProduct.get(productId) ?? 0),
    }))
    .sort((a, b) => b.customers - a.customers);

  const customersByChannel = new Map<string, number>();
  for (const r of nfRows) {
    if (r.resolvedCampaignKey === null) continue;
    bump(customersByChannel, channelOf(r.resolvedCampaignKey), r.newFundedCustomers);
  }
  const byChannel = Array.from(customersByChannel.entries())
    .map(([channel, customers]) => ({ channel, customers }))
    .sort((a, b) => b.customers - a.customers);

  // ---------- lead quality by campaign ----------
  const leadQuality = Array.from(
    groupBy(
      funnelRows.filter((r) => r.campaignKey !== "UNATTRIBUTED"),
      (r) => r.campaignKey
    ).entries()
  )
    .map(([campaignKey, rows]) => {
      const leads = sumBy(rows, (r) => r.submissionsWithLeads);
      const customers = sumBy(rows, (r) => r.submissionsWithFundedAccounts);
      return {
        campaignKey,
        campaignTitle: rows[0].campaignName,
        leads,
        customers,
        rate: round4(safeDiv(customers, leads)),
      };
    })
    .sort((a, b) => b.leads - a.leads);

  // ---------- segment registry ----------
  const custBySegId = new Map<string, number>();
  for (const r of custRows) bump(custBySegId, r.segmentId, 1);
  const segments = segDim
    .map((s) => ({
      segmentId: s.segmentId,
      segment: s.segment,
      segmentGroup: s.segmentGroup,
      description: s.segmentDescription,
      theme: s.suggestedMessageTheme,
      customers: custBySegId.get(s.segmentId) ?? 0,
    }))
    .sort((a, b) => a.segmentId.localeCompare(b.segmentId));

  const res: CustomersResponse = {
    kpis,
    monthly,
    bySegment,
    byMarket,
    byProduct,
    byChannel,
    leadQuality,
    segments,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
