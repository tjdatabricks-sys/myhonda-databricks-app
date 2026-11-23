import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/filters — global filter options (campaigns, platforms,
// markets, products, segments, date range) + gold_business totals.
// (FiltersResponse contract; see src/lib/api-types.ts)
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { FiltersResponse } from "@/lib/api-types";
import { parseFilters, campaignChannelGroups } from "@/lib/server/filters";
import { dateKey } from "@/lib/server/helpers";
import { GOLD_TABLES } from "@/lib/server/gold-tables";

export const dynamic = "force-dynamic";

/** Warehouse repository for a PascalCase model name (e.g. "Branch" -> db.branch). */
function delegateFor(model: string): { countRows: () => Promise<number> } | undefined {
  return (db as unknown as Record<string, { countRows: () => Promise<number> }>)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ];
}

async function handleGet(req: Request) {
  const f = await parseFilters(req); // filters ignored: this endpoint lists all options
  void f;

  const [campaignRows, platformRows, markets, products, segments, dateAgg, fundedAgg] =
    await Promise.all([
      db.campaign.selectRows({
        select: { campaignKey: true, campaignTitle: true, initiativeType: true },
      }),
      db.paidMediaDaily.selectRows({ distinct: ["platform"], select: { platform: true } }),
      db.market.selectRows({
        orderBy: { marketId: "asc" },
        select: { marketId: true, marketDisplayName: true, regionId: true },
      }),
      db.product.selectRows({
        orderBy: { productId: "asc" },
        select: { productId: true, productName: true, productCategory: true },
      }),
      db.customerSegment.selectRows({
        orderBy: { segmentId: "asc" },
        select: { segmentId: true, segment: true, segmentGroup: true },
      }),
      db.paidMediaDaily.summarize({ _min: { reportDate: true }, _max: { reportDate: true } }),
      db.newFundedCustomersMonthly.summarize({ _sum: { newFundedCustomers: true } }),
    ]);

  const groups = await campaignChannelGroups();

  const campaigns = campaignRows
    .map((c) => ({
      campaignKey: c.campaignKey,
      campaignTitle: c.campaignTitle,
      initiativeType: c.initiativeType,
      channelGroup: groups.get(c.campaignKey) ?? "Paid Digital",
    }))
    .sort((a, b) => (a.campaignKey < b.campaignKey ? -1 : a.campaignKey > b.campaignKey ? 1 : 0));

  const platforms = platformRows.map((p) => p.platform).sort();

  // Row counts across every gold_business table (39 tables).
  const counts = await Promise.all(
    Object.values(GOLD_TABLES).map((def) => {
      const delegate = delegateFor(def.model);
      return delegate ? delegate.countRows() : Promise.resolve(0);
    })
  );
  const goldRows = counts.reduce((a, b) => a + b, 0);

  const res: FiltersResponse = {
    campaigns,
    platforms,
    markets,
    products,
    segments,
    dateRange: {
      min: dateAgg._min.reportDate ? dateKey(dateAgg._min.reportDate) : new Date().toISOString().slice(0, 10),
      max: dateAgg._max.reportDate ? dateKey(dateAgg._max.reportDate) : new Date().toISOString().slice(0, 10),
    },
    totals: {
      campaigns: campaigns.length,
      tables: Object.keys(GOLD_TABLES).length,
      goldRows,
      fundedAccounts: fundedAgg._sum.newFundedCustomers ?? 0,
    },
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
