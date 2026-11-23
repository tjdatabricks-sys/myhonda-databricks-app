import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/brand — Brand-lift survey tracker: waves, pre/post
// lift by campaign, market and collection method, monthly
// timeline. (BrandResponse contract; see src/lib/api-types.ts)
// Survey date/market and campaign-linked platform/product filters apply.
// Awareness / consideration / recall are stored as decimals 0-1.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { BrandResponse } from "@/lib/api-types";
import { brandWhere, campaignChannelGroups, parseFilters } from "@/lib/server/filters";
import {
  dateKey,
  monthKey,
  safeDiv,
  round4,
  groupBy,
  bump,
  sumBy,
} from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

const PRE = "Pre-Wave";
const POST = "Post-Wave";

/** Mean of a numeric field over rows (0 for empty lists). */
function meanBy<T>(rows: T[], fn: (row: T) => number): number {
  if (!rows.length) return 0;
  return sumBy(rows, fn) / rows.length;
}

async function handleGet(req: Request) {
  const f = await parseFilters(req);

  const [rows, campaigns, markets, channelGroups] = await Promise.all([
    db.brandSurveyWave.selectRows({ where: brandWhere(f) }),
    db.campaign.selectRows({ select: { campaignKey: true, campaignTitle: true } }),
    db.market.selectRows({ select: { marketId: true, marketDisplayName: true } }),
    campaignChannelGroups(),
  ]);

  const title = new Map(campaigns.map((c) => [c.campaignKey, c.campaignTitle]));
  const marketName = new Map(markets.map((m) => [m.marketId, m.marketDisplayName]));

  // ---------- waves (metrics stored as decimals 0-1) ----------
  const waves: BrandResponse["waves"] = rows
    .map((r) => {
      const key = r.resolvedCampaignKey ?? r.campaignRef;
      return {
        waveId: r.surveyWaveId,
        campaignKey: key,
        campaignTitle: title.get(key) ?? key,
        market: marketName.get(r.marketCode) ?? r.marketCode,
        wave: r.measurementWave,
        date: dateKey(r.surveyDate),
        sampleSize: r.sampleSize,
        awareness: round4(r.brandAwarenessPct),
        consideration: round4(r.considerationPct),
        recall: round4(r.messageRecallPct),
        method: r.collectionMethod,
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.campaignKey.localeCompare(b.campaignKey) ||
        a.wave.localeCompare(b.wave)
    );

  // ---------- campaign-level pre/post pairs ----------
  interface CampaignPair {
    campaignKey: string;
    preAwareness: number;
    postAwareness: number;
    preConsideration: number;
    postConsideration: number;
    preRecall: number;
    postRecall: number;
    markets: Set<string>;
    postMethods: Set<string>;
  }

  const byCampaign = groupBy(rows, (r) => r.resolvedCampaignKey ?? r.campaignRef);
  const campaignPairs: CampaignPair[] = [];

  for (const [key, cRows] of byCampaign) {
    const pre = cRows.filter((r) => r.measurementWave === PRE);
    const post = cRows.filter((r) => r.measurementWave === POST);
    if (!pre.length || !post.length) continue;
    campaignPairs.push({
      campaignKey: key,
      preAwareness: meanBy(pre, (r) => r.brandAwarenessPct),
      postAwareness: meanBy(post, (r) => r.brandAwarenessPct),
      preConsideration: meanBy(pre, (r) => r.considerationPct),
      postConsideration: meanBy(post, (r) => r.considerationPct),
      preRecall: meanBy(pre, (r) => r.messageRecallPct),
      postRecall: meanBy(post, (r) => r.messageRecallPct),
      markets: new Set(cRows.map((r) => r.marketCode)),
      postMethods: new Set(post.map((r) => r.collectionMethod)),
    });
  }

  const lift: BrandResponse["lift"] = campaignPairs
    .map((p) => {
      const liftVal = p.postAwareness - p.preAwareness;
      return {
        campaignKey: p.campaignKey,
        campaignTitle: title.get(p.campaignKey) ?? p.campaignKey,
        channel: channelGroups.get(p.campaignKey) ?? "Brand",
        preAwareness: round4(p.preAwareness),
        postAwareness: round4(p.postAwareness),
        lift: round4(liftVal),
        relLift: round4(safeDiv(liftVal, p.preAwareness)),
        considerationLift: round4(p.postConsideration - p.preConsideration),
        recallLift: round4(p.postRecall - p.preRecall),
        markets: p.markets.size,
      };
    })
    .sort((a, b) => b.lift - a.lift);

  // ---------- by market: (campaign, market) pre/post pairs ----------
  const marketPairs = new Map<string, { pre: number[]; post: number[] }>();
  for (const [key, cRows] of byCampaign) {
    const byMarket = groupBy(cRows, (r) => r.marketCode);
    for (const [marketCode, mRows] of byMarket) {
      const pre = mRows.filter((r) => r.measurementWave === PRE);
      const post = mRows.filter((r) => r.measurementWave === POST);
      if (!pre.length || !post.length) continue;
      const entry = marketPairs.get(marketCode) ?? { pre: [], post: [] };
      entry.pre.push(meanBy(pre, (r) => r.brandAwarenessPct));
      entry.post.push(meanBy(post, (r) => r.brandAwarenessPct));
      marketPairs.set(marketCode, entry);
    }
  }

  const byMarket: BrandResponse["byMarket"] = Array.from(marketPairs.entries())
    .map(([marketCode, e]) => {
      const pre = meanBy(e.pre, (v) => v);
      const post = meanBy(e.post, (v) => v);
      return {
        market: marketName.get(marketCode) ?? marketCode,
        preAwareness: round4(pre),
        postAwareness: round4(post),
        lift: round4(post - pre),
      };
    })
    .sort((a, b) => b.lift - a.lift);

  // ---------- by collection method ----------
  const methodWaveCounts = new Map<string, number>();
  for (const r of rows) bump(methodWaveCounts, r.collectionMethod, 1);

  const methodLifts = new Map<string, number[]>();
  for (const p of campaignPairs) {
    const liftVal = p.postAwareness - p.preAwareness;
    for (const method of p.postMethods) {
      const list = methodLifts.get(method) ?? [];
      list.push(liftVal);
      methodLifts.set(method, list);
    }
  }

  const byMethod: BrandResponse["byMethod"] = Array.from(methodWaveCounts.entries())
    .map(([method, waveCount]) => {
      const lifts = methodLifts.get(method) ?? [];
      return {
        method,
        waves: waveCount,
        avgLift: lifts.length ? round4(meanBy(lifts, (v) => v)) : 0,
      };
    })
    .sort((a, b) => b.waves - a.waves || a.method.localeCompare(b.method));

  // ---------- monthly tracker timeline ----------
  const timeline: BrandResponse["timeline"] = Array.from(
    groupBy(rows, (r) => monthKey(r.surveyDate)).entries()
  )
    .map(([month, mRows]) => ({
      month,
      avgAwareness: round4(meanBy(mRows, (r) => r.brandAwarenessPct)),
      avgConsideration: round4(meanBy(mRows, (r) => r.considerationPct)),
      avgRecall: round4(meanBy(mRows, (r) => r.messageRecallPct)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const res: BrandResponse = { waves, lift, byMarket, byMethod, timeline };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
