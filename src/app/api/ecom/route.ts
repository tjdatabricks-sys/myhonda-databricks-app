import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/ecom — E-commerce orders by month and status plus
// the product catalog with category price stats.
// (EcomResponse contract; see src/lib/api-types.ts)
// Sources: mart_ecom_orders_monthly (date filters only),
// dim_ecom_product (unfiltered).
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { EcomResponse } from "@/lib/api-types";
import { ecomWhere, parseFilters } from "@/lib/server/filters";
import { monthKey, safeDiv, round2, round4, groupBy, sumBy } from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

/** Statuses excluded from net sales. */
const NET_EXCLUDED = new Set(["Cancelled", "Returned", "Refunded"]);

/** Mean of a numeric field over rows (0 for empty lists). */
function meanBy<T>(rows: T[], fn: (row: T) => number): number {
  if (!rows.length) return 0;
  return sumBy(rows, fn) / rows.length;
}

async function handleGet(req: Request) {
  const f = await parseFilters(req); // only date filters apply

  const [orderRows, products] = await Promise.all([
    db.ecomOrdersMonthly.selectRows({
      where: ecomWhere(f),
      select: {
        orderMonth: true,
        orderStatus: true,
        orders: true,
        orderTotalAmount: true,
        orderTaxAmount: true,
        orderShippingAmount: true,
      },
    }),
    db.ecomProduct.selectRows(),
  ]);

  const netRows = orderRows.filter((r) => !NET_EXCLUDED.has(r.orderStatus));

  // ---------- KPIs ----------
  const orders = sumBy(orderRows, (r) => r.orders);
  const grossSales = sumBy(orderRows, (r) => r.orderTotalAmount);
  const netSales = sumBy(netRows, (r) => r.orderTotalAmount);
  const netOrders = sumBy(netRows, (r) => r.orders);
  const returnedOrders = sumBy(
    orderRows.filter((r) => r.orderStatus === "Returned" || r.orderStatus === "Refunded"),
    (r) => r.orders
  );
  const kpis: EcomResponse["kpis"] = {
    orders,
    grossSales: round2(grossSales),
    netSales: round2(netSales),
    aov: round2(safeDiv(netSales, netOrders)),
    returnRate: round4(safeDiv(returnedOrders, orders)),
    avgTax: round2(safeDiv(sumBy(orderRows, (r) => r.orderTaxAmount), orders)),
    avgShipping: round2(safeDiv(sumBy(orderRows, (r) => r.orderShippingAmount), orders)),
  };

  // ---------- monthly ----------
  const monthly = Array.from(groupBy(orderRows, (r) => monthKey(r.orderMonth)).entries())
    .map(([month, rows]) => ({
      month,
      orders: sumBy(rows, (r) => r.orders),
      gross: round2(sumBy(rows, (r) => r.orderTotalAmount)),
      net: round2(
        sumBy(
          rows.filter((r) => !NET_EXCLUDED.has(r.orderStatus)),
          (r) => r.orderTotalAmount
        )
      ),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ---------- statusMix ----------
  const statusMix = Array.from(groupBy(orderRows, (r) => r.orderStatus).entries())
    .map(([status, rows]) => ({
      status,
      orders: sumBy(rows, (r) => r.orders),
      amount: round2(sumBy(rows, (r) => r.orderTotalAmount)),
      tax: round2(sumBy(rows, (r) => r.orderTaxAmount)),
      shipping: round2(sumBy(rows, (r) => r.orderShippingAmount)),
    }))
    .sort((a, b) => b.orders - a.orders);

  // ---------- catalog ----------
  const catalog: EcomResponse["catalog"] = products
    .map((p) => ({
      sku: p.sku,
      name: p.productName,
      category: p.category,
      brand: p.brand,
      listPrice: round2(p.listPriceUsd),
      unitCost: round2(p.unitCostUsd),
      margin: round4(safeDiv(p.listPriceUsd - p.unitCostUsd, p.listPriceUsd)),
      active: p.isActive,
    }))
    .sort((a, b) => b.listPrice - a.listPrice);

  // ---------- categoryPrices ----------
  const categoryPrices = Array.from(groupBy(products, (p) => p.category).entries())
    .map(([category, rows]) => ({
      category,
      products: rows.length,
      avgPrice: round2(meanBy(rows, (p) => p.listPriceUsd)),
      avgMargin: round4(meanBy(rows, (p) => safeDiv(p.listPriceUsd - p.unitCostUsd, p.listPriceUsd))),
    }))
    .sort((a, b) => b.products - a.products);

  const res: EcomResponse = { kpis, monthly, statusMix, catalog, categoryPrices };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
