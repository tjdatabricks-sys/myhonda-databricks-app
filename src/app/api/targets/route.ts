import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/targets — sales target attainment vs actuals by
// month, product and market, plan versions and the override
// candidate review queue.
// (TargetsResponse contract; see src/lib/api-types.ts)
// Sources: mart_sales_target_attainment_monthly,
// mart_demo_relationship_value_monthly,
// ref_sales_target_override_candidate, dim_product, dim_market.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Where, Comparison } from "@/lib/server/query";
import type { RowModels } from "@/lib/server/row-models";
import type { TargetsResponse } from "@/lib/api-types";
import { parseFilters, relWhere, targetWhere } from "@/lib/server/filters";
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

  // Override candidates: product/market filters apply; the date range is
  // intentionally ignored so the review queue always shows every candidate.
  const ovrWhere: Where<RowModels["SalesTargetOverrideCandidate"]> = {};
  if (f.product) ovrWhere.productId = f.product;
  if (f.market) ovrWhere.marketId = f.market;

  const [martRows, relRows, overrideRows, products, markets] = await Promise.all([
    db.salesTargetAttainmentMonthly.selectRows({
      where: targetWhere(f),
      select: {
        targetMonth: true,
        productId: true,
        marketId: true,
        planVersion: true,
        targetFundedAccounts: true,
        targetContributionUsd: true,
        fundedAccounts: true,
      },
    }),
    db.relationshipValueMonthly.selectRows({
      where: relWhere(f),
      select: { valueMonth: true, netRelationshipContributionUsd: true },
    }),
    db.salesTargetOverrideCandidate.selectRows({
      where: ovrWhere,
      select: {
        targetMonth: true,
        productId: true,
        marketId: true,
        overrideStatus: true,
        reason: true,
        selectedContributionUsd: true,
      },
    }),
    db.product.selectRows({ select: { productId: true, productName: true } }),
    db.market.selectRows({ select: { marketId: true, marketDisplayName: true } }),
  ]);

  const productName = new Map(products.map((p) => [p.productId, p.productName]));
  const marketName = new Map(markets.map((m) => [m.marketId, m.marketDisplayName]));

  // ---------- monthly aggregates ----------
  const monthTarget = new Map<string, number>();
  const monthActual = new Map<string, number>();
  const monthTargetContrib = new Map<string, number>();
  for (const r of martRows) {
    const k = monthKey(r.targetMonth);
    bump(monthTarget, k, r.targetFundedAccounts);
    bump(monthActual, k, r.fundedAccounts);
    bump(monthTargetContrib, k, r.targetContributionUsd);
  }
  const contribByMonth = new Map<string, number>();
  for (const r of relRows) {
    bump(contribByMonth, monthKey(r.valueMonth), r.netRelationshipContributionUsd);
  }

  // ---------- KPIs ----------
  const targetFunded = sumBy(martRows, (r) => r.targetFundedAccounts);
  const actualFunded = sumBy(martRows, (r) => r.fundedAccounts);
  const attainment = safeDiv(actualFunded, targetFunded);
  const targetContribution = sumBy(martRows, (r) => r.targetContributionUsd);
  const gap = actualFunded - targetFunded;
  const monthsTotal = monthTarget.size;
  let monthsOnTrack = 0;
  for (const [k, t] of monthTarget) {
    if ((monthActual.get(k) ?? 0) >= t) monthsOnTrack++;
  }

  // ---------- monthly ----------
  const axis = monthAxis(
    f.from,
    f.to,
    [...martRows.map((r) => r.targetMonth), ...relRows.map((r) => r.valueMonth)]
  );
  const monthly = axis.map((m) => {
    const k = monthKey(m);
    const t = monthTarget.get(k) ?? 0;
    const a = monthActual.get(k) ?? 0;
    return {
      month: k,
      targetFunded: t,
      actualFunded: a,
      targetContribution: round2(monthTargetContrib.get(k) ?? 0),
      actualContribution: round2(contribByMonth.get(k) ?? 0),
      attainment: round4(safeDiv(a, t)),
    };
  });

  // ---------- byProduct ----------
  const byProduct = Array.from(groupBy(martRows, (r) => r.productId).entries())
    .map(([productId, rows]) => {
      const target = sumBy(rows, (r) => r.targetFundedAccounts);
      const actual = sumBy(rows, (r) => r.fundedAccounts);
      return {
        productId,
        product: productName.get(productId) ?? productId,
        target,
        actual,
        attainment: round4(safeDiv(actual, target)),
        gap: actual - target,
      };
    })
    .sort((a, b) => b.target - a.target);

  // ---------- byMarket ----------
  const byMarket = Array.from(groupBy(martRows, (r) => r.marketId).entries())
    .map(([marketId, rows]) => {
      const target = sumBy(rows, (r) => r.targetFundedAccounts);
      const actual = sumBy(rows, (r) => r.fundedAccounts);
      return {
        marketId,
        market: marketName.get(marketId) ?? marketId,
        target,
        actual,
        attainment: round4(safeDiv(actual, target)),
        gap: actual - target,
      };
    })
    .sort((a, b) => b.target - a.target);

  // ---------- overrides (review queue) ----------
  const overrides = overrideRows
    .map((r) => ({
      month: monthKey(r.targetMonth),
      product: productName.get(r.productId) ?? r.productId,
      market: marketName.get(r.marketId) ?? r.marketId,
      status: r.overrideStatus,
      reason: r.reason ?? "",
      amount: round2(r.selectedContributionUsd),
    }))
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
    .slice(0, 40);

  // ---------- planVersions ----------
  const planVersions = Array.from(groupBy(martRows, (r) => r.planVersion).entries())
    .map(([planVersion, rows]) => ({
      planVersion,
      targetFunded: sumBy(rows, (r) => r.targetFundedAccounts),
      actualFunded: sumBy(rows, (r) => r.fundedAccounts),
    }))
    .sort((a, b) => a.planVersion.localeCompare(b.planVersion));

  const res: TargetsResponse = {
    kpis: {
      targetFunded,
      actualFunded,
      attainment: round4(attainment),
      targetContribution: round2(targetContribution),
      gap,
      monthsOnTrack,
      monthsTotal,
    },
    monthly,
    byProduct,
    byMarket,
    overrides,
    planVersions,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
